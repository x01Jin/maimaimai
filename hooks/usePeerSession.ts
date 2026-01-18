import { useState, useRef, useCallback, useEffect } from "react";
import {
  GameState,
  ConnectionStatus,
  ClientAction,
  DataConnection,
  PeerError,
} from "../types";
import Peer from "peerjs";
import { getBeaconId } from "./peer/peerUtils";
import {
  getIdentity,
  saveHostState,
  loadHostState,
  generateUUID,
  saveIdentity,
  setActiveSession,
  getActiveSession,
  clearActiveSession,
} from "../utils/storage";
import {
  INITIAL_STATE,
  sessionUtils,
  processQueueState,
  createSystemMessage,
  hashState,
  finalizeState,
} from "../utils/sessionUtils";

// Sub-hooks
import { logger } from "./peer/peerUtils";
import { usePeerConnections } from "./peer/usePeerConnections";
import { usePeerLifecycle } from "./peer/usePeerLifecycle";
import { usePeerMessaging } from "./peer/usePeerMessaging";
import { usePeerCoordination } from "./peer/usePeerCoordination";

interface UsePeerSessionReturn {
  status: ConnectionStatus;
  isMod: boolean;
  gameState: GameState;
  myId: string;
  myUuid: string;
  createSession: (
    username: string,
    existingState?: GameState,
    recoverCode?: string,
  ) => Promise<string>;
  joinSession: (code: string, username: string) => Promise<void>;
  joinQueueMatch: (playerId?: string) => void;
  joinQueuePartner: (partnerId: string, playerId?: string) => void;
  requestSolo: (playerId?: string, playerName?: string) => void;
  castVote: (approve: boolean) => void;
  addCustomPlayer: (name: string) => void;
  removeCustomPlayer: (playerId: string) => void;
  leaveQueue: (queueId: string) => void;
  removeFromQueue: (queueId: string) => void;
  kickPlayer: (queueId: string, playerId: string) => void;
  reorderQueue: (queueIds: string[]) => void;
  finishTurn: (playerId?: string) => void;
  forceFinishTurn: () => void;
  sendMessage: (
    content: string,
    replyToId?: string,
    type?: "text" | "image" | "gif",
    metadata?: GameState["messages"][0]["metadata"],
  ) => void;
  addReaction: (messageId: string, emoji: string) => void;
  removeReaction: (messageId: string, emoji: string) => void;
  modDecision: (voteId: string, decision: "APPROVE" | "REJECT") => void;
  transferMod: (targetId: string) => void;
  disconnect: () => void;
  leaveSession: () => void;
  recoverSession: (code: string, username: string) => Promise<void>;
  error: string | null;
}

export type { UsePeerSessionReturn };

export const usePeerSession = (): UsePeerSessionReturn => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [myId, setMyId] = useState<string>("");
  const [myUuid, setMyUuid] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const gameStateRef = useRef<GameState>(INITIAL_STATE);
  const modPeerIdRef = useRef<string | null>(null);
  const lastModPulseRef = useRef<number>(Date.now());

  // Late-binding refs for circular dependencies
  const handleMessageRef = useRef<(msg: any, peerId: string) => void>(() => {});
  const connectToPeerRef = useRef<
    (targetId: string, isBeacon: boolean) => void
  >(() => {});
  const tryCaptureBeaconRef = useRef<(code: string) => void>(() => {});
  const electNewModRef = useRef<() => void>(() => {});

  // Sync refs
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const id = getIdentity();
    setMyUuid(id.uuid);
  }, []);

  // Persistence
  useEffect(() => {
    const isMeMod = gameState.players.find((p) => p.id === myId)?.isMod;
    if (isMeMod && gameState.sessionName) {
      saveHostState(gameState.sessionName, gameState);
    }
  }, [gameState, myId]);

  // Auto-recovery
  useEffect(() => {
    const activeSessionCode = getActiveSession();
    // Only attempt recovery if we are IDLE and have a stored session code
    if (activeSessionCode && status === ConnectionStatus.IDLE) {
      const identity = getIdentity();
      if (identity.name) {
        logger.log(`Attempting to auto-recover session: ${activeSessionCode}`);
        recoverSession(activeSessionCode, identity.name).catch((err) => {
          console.error("Auto-recovery failed:", err);
          clearActiveSession(); // Clear if recovery fails
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // 1. Connection Management
  const {
    connectionsRef,
    qualityMetricsRef,
    actionBufferRef,
    broadcast,
    sendTo,
    sendToServicePeers,
    registerConnection,
  } = usePeerConnections(myId, gameStateRef);

  // 2. State Updates
  const updateState = useCallback(
    (updater: (prev: GameState) => GameState, lastAction?: ClientAction) => {
      setGameState((prev) => {
        const next = updater(prev);
        const processed = processQueueState(next);
        const final = finalizeState(processed);
        const newHash = hashState(final);

        // Force self to be connected
        const selfIndex = final.players.findIndex((p) => p.id === myId);
        if (selfIndex !== -1 && !final.players[selfIndex].isConnected) {
          final.players[selfIndex].isConnected = true;
          final.players[selfIndex].lastSeen = Date.now();
        }

        final.stateHash = newHash;

        if (prev.stateHash !== newHash) {
          const iAmServicePeer = final.servicePeers.includes(myId);
          if (iAmServicePeer) {
            // Immediate broadcast - no debounce
            // Use setTimeout(..., 0) to push to next tick to avoid blocking render
            setTimeout(() => {
              broadcast({
                type: "SYNC_STATE",
                payload: { state: final, stateHash: newHash, lastAction },
              });
            }, 0);
          }
        }
        return final;
      });
    },
    [broadcast, myId],
  );

  const handleDisconnect = useCallback(
    (lostPeerId: string) => {
      updateState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.id === lostPeerId ? { ...p, isConnected: false } : p,
        ),
      }));

      if (lostPeerId === modPeerIdRef.current) {
        logger.warn("Mod disconnected. Triggering election...");
        electNewModRef.current();
      }
    },
    [updateState],
  );

  const setupConnectionListeners = useCallback(
    (conn: DataConnection, isBeacon = false) => {
      conn.on("open", () => registerConnection(conn));
      conn.on("data", (data: any) => handleMessageRef.current(data, conn.peer));
      conn.on("close", () => {
        connectionsRef.current.delete(conn.peer);
        if (!isBeacon) {
          handleDisconnect(conn.peer);
        } else {
          logger.log(`Beacon connection to ${conn.peer} closed.`);
        }
      });
      conn.on("error", (err: PeerError) =>
        logger.warn(`Connection error with ${conn.peer}: ${err.type}`),
      );
    },
    [registerConnection, handleDisconnect, connectionsRef],
  );

  const connectToPeer = useCallback(
    (targetId: string, isBeaconConnect: boolean) => {
      const peer = (lifecycle as any).peerRef.current; // Hacky but needed if not using refs
      if (!peer || targetId === myId || connectionsRef.current.has(targetId))
        return;

      logger.log(`Connecting to peer: ${targetId}`);
      const conn = peer.connect(targetId, { reliable: true });
      setupConnectionListeners(conn, isBeaconConnect);

      conn.on("open", () => {
        conn.send({
          type: "HELLO",
          payload: {
            player: {
              id: myId,
              uuid: myUuid,
              name: getIdentity().name,
              isMod: false,
              isConnected: true,
              joinedAt: Date.now(),
            },
          },
        });
      });
    },
    [myId, myUuid, setupConnectionListeners, connectionsRef],
  );

  // 3. Lifecycle
  const lifecycle = usePeerLifecycle({
    myUuid,
    setMyUuid,
    myId,
    setMyId,
    status,
    setStatus,
    gameStateRef,
    setGameState,
    modPeerIdRef,
    lastModPulseRef,
    setupConnectionListeners,
    connectToPeer: (tid, isB) => connectToPeerRef.current(tid, isB),
  });

  tryCaptureBeaconRef.current = lifecycle.tryCaptureBeacon;

  // 4. Messaging
  const { handleMessage } = usePeerMessaging({
    myId,
    myUuid,
    gameStateRef,
    setGameState,
    updateState,
    sendTo,
    broadcast,
    modPeerIdRef,
    lastModPulseRef,
    qualityMetricsRef,
    connectToPeer: (tid, isB) => connectToPeerRef.current(tid, isB),
    tryCaptureBeacon: (code) => tryCaptureBeaconRef.current(code),
    sessionCode: lifecycle.sessionCodeRef.current,
  });
  handleMessageRef.current = handleMessage;

  // 5. Coordination
  const becomeMod = useCallback(async () => {
    if (gameStateRef.current.players.find((p) => p.id === myId)?.isMod) return;

    logger.log("Promoting self to Mod");
    const myName =
      gameStateRef.current.players.find((p) => p.id === myId)?.name ||
      "Unknown";

    updateState((prev) => {
      const newState = {
        ...prev,
        players: prev.players.map((p) => ({ ...p, isMod: p.id === myId })),
        messages: [
          ...prev.messages,
          createSystemMessage(`Mod migrated to ${myName}.`),
        ],
        version: prev.version + 10,
      };
      newState.servicePeers = [myId];
      return newState;
    });

    modPeerIdRef.current = myId;
    lastModPulseRef.current = Date.now();
    broadcast({ type: "TRANSFER_MOD", payload: { newModId: myId } });
    tryCaptureBeaconRef.current(lifecycle.sessionCodeRef.current);
  }, [myId, updateState, broadcast, lifecycle.sessionCodeRef, gameStateRef]);

  const { electNewMod } = usePeerCoordination({
    myId,
    status,
    gameStateRef,
    connectionsRef,
    qualityMetricsRef,
    broadcast,
    updateState,
    becomeMod,
    modPeerIdRef,
    lastModPulseRef,
  });
  electNewModRef.current = electNewMod;

  // Implementation of connectToPeer that uses the current peerRef
  useEffect(() => {
    connectToPeerRef.current = (targetId: string, isBeaconConnect: boolean) => {
      const peer = lifecycle.peerRef.current;
      if (!peer || targetId === myId || connectionsRef.current.has(targetId))
        return;

      logger.log(`Connecting to peer: ${targetId}`);
      const conn = peer.connect(targetId, { reliable: true });
      setupConnectionListeners(conn, isBeaconConnect);

      conn.on("open", () => {
        conn.send({
          type: "HELLO",
          payload: {
            player: {
              id: myId,
              uuid: myUuid,
              name: getIdentity().name,
              isMod: false,
              isConnected: true,
              joinedAt: Date.now(),
            },
          },
        });
      });
    };
  }, [
    lifecycle.peerRef,
    myId,
    myUuid,
    setupConnectionListeners,
    connectionsRef,
  ]);

  // Actions
  const sendAction = useCallback(
    (action: ClientAction) => {
      const iAmServicePeer = gameStateRef.current.servicePeers.includes(myId);

      if (iAmServicePeer) {
        updateState((prev) => sessionUtils(prev, action, myId), action);
      } else {
        const availableServicePeers = gameStateRef.current.servicePeers
          .map((id) => ({ id, conn: connectionsRef.current.get(id) }))
          .filter((p) => p.conn && p.conn.open);

        if (availableServicePeers.length > 0) {
          const target =
            availableServicePeers[
              Math.floor(Math.random() * availableServicePeers.length)
            ];
          target.conn?.send({
            type: "ACTION",
            payload: { action, from: myId },
          });
        } else {
          logger.warn("No service peers available. Buffering action.");
          actionBufferRef.current.push(action);

          gameStateRef.current.servicePeers.forEach((peerId) => {
            if (peerId !== myId) connectToPeerRef.current(peerId, false);
          });
        }
      }
    },
    [myId, updateState, connectionsRef, actionBufferRef, gameStateRef],
  );

  const transferMod = (targetId: string) => {
    if (!gameState.players.find((p) => p.id === myId)?.isMod) return;

    logger.log(`Transferring mod to ${targetId}`);

    // Optimization: Only send full state to the target peer (New Mod)
    // Send a lightweight notification to everyone else
    sendTo(targetId, {
      type: "TRANSFER_MOD",
      payload: { newModId: targetId, state: gameStateRef.current },
    });

    broadcast(
      {
        type: "TRANSFER_MOD",
        payload: { newModId: targetId }, // No state payload for others
      },
      targetId, // Exclude target as we just sent to them
    );

    // Also process locally to update UI immediately
    handleMessageRef.current(
      {
        type: "TRANSFER_MOD",
        payload: { newModId: targetId, state: gameStateRef.current },
      },
      myId,
    );

    if (lifecycle.beaconRef.current) {
      lifecycle.beaconRef.current.destroy();
      lifecycle.beaconRef.current = null;
    }
  };

  const recoverSession = async (code: string, username: string) => {
    setStatus(ConnectionStatus.CONNECTING);
    setMyUuid(saveIdentity(username, myUuid).uuid);

    const beaconId = getBeaconId(code);
    const hasHostState = !!loadHostState(code);

    // Create a temporary peer to check for beacon existence
    const PeerConstructor = (Peer as any).default ?? Peer;
    const tempPeer = new PeerConstructor();

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        tempPeer.destroy();
        // If timeout and we were host, recover. Otherwise, fail.
        if (hasHostState) {
          logger.log("Recovery timeout: Resuming as Host.");
          lifecycle
            .createSession(username, undefined, code)
            .then((c) => {
              setActiveSession(c);
              resolve();
            })
            .catch((err) => {
              if (err.message === "BEACON_TAKEN") {
                logger.log("Beacon stolen during timeout. Joining instead.");
                lifecycle
                  .joinSession(code, username)
                  .then(resolve)
                  .catch(reject);
              } else {
                reject(err);
              }
            });
        } else {
          logger.error("Recovery timeout: Session unreachable.");
          setStatus(ConnectionStatus.ERROR);
          reject(new Error("Session unreachable."));
        }
      }, 6000); // 6s timeout for more reliable beacon check

      tempPeer.on("open", () => {
        const conn = tempPeer.connect(beaconId, { reliable: true });

        const errorHandler = (err: any) => {
          if (
            err.type === "peer-unavailable" &&
            err.message?.includes(beaconId)
          ) {
            clearTimeout(timeout);
            tempPeer.off("error", errorHandler);
            tempPeer.destroy();

            if (hasHostState) {
              logger.log("Beacon unavailable: Resuming as Host.");
              lifecycle
                .createSession(username, undefined, code)
                .then((c) => {
                  setActiveSession(c);
                  resolve();
                })
                .catch((err) => {
                  if (err.message === "BEACON_TAKEN") {
                    logger.log("Beacon stolen during check. Joining instead.");
                    lifecycle
                      .joinSession(code, username)
                      .then(resolve)
                      .catch(reject);
                  } else {
                    reject(err);
                  }
                });
            } else {
              logger.error("Beacon unavailable: Session unreachable.");
              setStatus(ConnectionStatus.ERROR);
              reject(new Error("Session unreachable."));
            }
          }
        };
        tempPeer.on("error", errorHandler);

        conn.on("open", () => {
          clearTimeout(timeout);
          tempPeer.off("error", errorHandler);
          tempPeer.destroy();
          // Beacon is alive, join instead
          lifecycle
            .joinSession(code, username)
            .then(() => {
              setActiveSession(code);
              resolve();
            })
            .catch(reject);
        });

        conn.on("error", () => {
          if (!hasHostState) return; // Wait for peer-unavailable or timeout for clients
          clearTimeout(timeout);
          tempPeer.off("error", errorHandler);
          tempPeer.destroy();
          lifecycle
            .createSession(username, undefined, code)
            .then((c) => {
              setActiveSession(c);
              resolve();
            })
            .catch((err) => {
              if (err.message === "BEACON_TAKEN") {
                logger.log("Beacon stolen during conn error. Joining instead.");
                lifecycle
                  .joinSession(code, username)
                  .then(resolve)
                  .catch(reject);
              } else {
                reject(err);
              }
            });
        });
      });

      tempPeer.on("error", (err: any) => {
        if (err.type !== "peer-unavailable") {
          clearTimeout(timeout);
          tempPeer.destroy();
          if (hasHostState) {
            lifecycle
              .createSession(username, undefined, code)
              .then((c) => {
                setActiveSession(c);
                resolve();
              })
              .catch((err) => {
                if (err.message === "BEACON_TAKEN") {
                  logger.log(
                    "Beacon stolen during peer error. Joining instead.",
                  );
                  lifecycle
                    .joinSession(code, username)
                    .then(resolve)
                    .catch(reject);
                } else {
                  reject(err);
                }
              });
          } else {
            setStatus(ConnectionStatus.ERROR);
            reject(new Error("Connection failed."));
          }
        }
      });
    });
  };

  // Public Methods
  const leaveSession = () => {
    clearActiveSession();
    const iAmMod = gameState.players.find((p) => p.id === myId)?.isMod;

    if (iAmMod && gameState.players.length > 1) {
      // Find valid candidates (connected, not me, not custom)
      const candidates = gameState.players
        .filter((p) => p.id !== myId && p.isConnected && !p.isCustom)
        .sort((a, b) => a.joinedAt - b.joinedAt);

      if (candidates.length > 0) {
        const successor = candidates[0];
        logger.log(`Leaving session. Handing over Mod to ${successor.name}`);
        transferMod(successor.id);
      } else {
        // Fallback to election logic if no obvious successor found
        electNewMod();
      }
    }
    // Give time for the transfer message to go out before killing connection
    setTimeout(() => lifecycle.disconnect(), 1000);
  };

  return {
    status,
    isMod: gameState.players.find((p) => p.id === myId)?.isMod || false,
    gameState,
    myId,
    myUuid,
    createSession: async (username, existingState, recoverCode) => {
      const code = await lifecycle.createSession(
        username,
        existingState,
        recoverCode,
      );
      setActiveSession(code);
      return code;
    },
    joinSession: async (code, username) => {
      await lifecycle.joinSession(code, username);
      setActiveSession(code);
    },
    disconnect: lifecycle.disconnect,
    leaveSession,
    transferMod,
    recoverSession,
    addCustomPlayer: (name) =>
      sendAction({ type: "ADD_CUSTOM_PLAYER", payload: { name } }),
    removeCustomPlayer: (playerId) =>
      sendAction({ type: "REMOVE_CUSTOM_PLAYER", payload: { playerId } }),
    joinQueueMatch: (playerId = myId) =>
      sendAction({ type: "JOIN_QUEUE_MATCH", payload: { playerId } }),
    joinQueuePartner: (partnerId, playerId = myId) =>
      sendAction({
        type: "JOIN_QUEUE_PARTNER",
        payload: { playerId, partnerId },
      }),
    requestSolo: (playerId = myId, playerName = getIdentity().name) =>
      sendAction({
        type: "REQUEST_SOLO",
        payload: { playerId, playerName },
      }),
    castVote: (approve) =>
      gameState.activeVote &&
      sendAction({
        type: "CAST_VOTE",
        payload: { voteId: gameState.activeVote.id, playerId: myId, approve },
      }),
    leaveQueue: (queueId) =>
      sendAction({ type: "LEAVE_QUEUE", payload: { playerId: myId, queueId } }),
    removeFromQueue: (queueId) =>
      sendAction({ type: "REMOVE_FROM_QUEUE", payload: { queueId } }),
    kickPlayer: (queueId, playerId) =>
      sendAction({ type: "KICK_PLAYER", payload: { playerId, queueId } }),
    reorderQueue: (queueIds) =>
      sendAction({ type: "REORDER_QUEUE", payload: { queueIds } }),
    finishTurn: (playerId = myId) =>
      gameState.currentSession &&
      sendAction({
        type: "FINISH_TURN",
        payload: { sessionId: gameState.currentSession.id, playerId },
      }),
    forceFinishTurn: () =>
      gameState.currentSession &&
      sendAction({
        type: "FORCE_FINISH_TURN",
        payload: { sessionId: gameState.currentSession.id },
      }),
    sendMessage: (content, replyToId, type = "text", metadata) =>
      (content.trim() || type !== "text") &&
      sendAction({
        type: "SEND_CHAT",
        payload: {
          content,
          senderId: myId,
          senderUuid: myUuid,
          senderName: getIdentity().name,
          messageId: generateUUID(),
          replyToId,
          type,
          metadata,
        },
      }),
    addReaction: (messageId, emoji) =>
      sendAction({
        type: "ADD_REACTION",
        payload: { messageId, playerId: myId, emoji },
      }),
    modDecision: (voteId, decision) =>
      sendAction({
        type: "MOD_DECISION",
        payload: {
          voteId,
          decision,
          modId: myId,
          modName: getIdentity().name,
        },
      }),
    removeReaction: (messageId, emoji) =>
      sendAction({
        type: "REMOVE_REACTION",
        payload: { messageId, playerId: myId, emoji },
      }),
    error,
  };
};
