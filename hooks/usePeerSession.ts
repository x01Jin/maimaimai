import { useState, useRef, useCallback, useEffect } from "react";
import {
  GameState,
  ConnectionStatus,
  ClientAction,
  DataConnection,
  PeerError,
} from "../types";
import { getIdentity, saveHostState, generateUUID } from "../utils/storage";
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
  joinQueueMatch: () => void;
  joinQueuePartner: (partnerId: string) => void;
  requestSolo: () => void;
  castVote: (approve: boolean) => void;
  leaveQueue: (queueId: string) => void;
  removeFromQueue: (queueId: string) => void;
  kickPlayer: (queueId: string, playerId: string) => void;
  reorderQueue: (queueIds: string[]) => void;
  finishTurn: () => void;
  forceFinishTurn: () => void;
  sendMessage: (content: string) => void;
  transferMod: (targetId: string) => void;
  disconnect: () => void;
  leaveSession: () => void;
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
  const broadcastDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
            if (broadcastDebounceRef.current)
              clearTimeout(broadcastDebounceRef.current);
            broadcastDebounceRef.current = setTimeout(() => {
              broadcast({
                type: "SYNC_STATE",
                payload: { state: final, stateHash: newHash, lastAction },
              });
            }, 100);
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
    broadcast({
      type: "TRANSFER_MOD",
      payload: { newModId: targetId, state: gameStateRef.current },
    });
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

  // Public Methods
  const leaveSession = () => {
    const iAmMod = gameState.players.find((p) => p.id === myId)?.isMod;
    if (iAmMod && gameState.players.length > 1) {
      electNewMod();
    }
    setTimeout(() => lifecycle.disconnect(), 500);
  };

  return {
    status,
    isMod: gameState.players.find((p) => p.id === myId)?.isMod || false,
    gameState,
    myId,
    myUuid,
    createSession: lifecycle.createSession,
    joinSession: lifecycle.joinSession,
    disconnect: lifecycle.disconnect,
    leaveSession,
    transferMod,
    joinQueueMatch: () =>
      sendAction({ type: "JOIN_QUEUE_MATCH", payload: { playerId: myId } }),
    joinQueuePartner: (partnerId) =>
      sendAction({
        type: "JOIN_QUEUE_PARTNER",
        payload: { playerId: myId, partnerId },
      }),
    requestSolo: () =>
      sendAction({
        type: "REQUEST_SOLO",
        payload: { playerId: myId, playerName: getIdentity().name },
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
    finishTurn: () =>
      gameState.currentSession &&
      sendAction({
        type: "FINISH_TURN",
        payload: { sessionId: gameState.currentSession.id, playerId: myId },
      }),
    forceFinishTurn: () =>
      gameState.currentSession &&
      sendAction({
        type: "FORCE_FINISH_TURN",
        payload: { sessionId: gameState.currentSession.id },
      }),
    sendMessage: (content) =>
      content.trim() &&
      sendAction({
        type: "SEND_CHAT",
        payload: {
          content,
          senderId: myId,
          senderUuid: myUuid,
          senderName: getIdentity().name,
          messageId: generateUUID(),
        },
      }),
    error,
  };
};
