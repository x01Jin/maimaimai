import React, { useCallback } from "react";
import { P2PMessage, GameState, ClientAction } from "../../types";
import {
  INITIAL_STATE,
  sessionUtils,
  finalizeState,
  mergeMessages,
} from "../../utils/sessionUtils";

interface MessagingProps {
  myId: string;
  myUuid: string;
  gameStateRef: React.MutableRefObject<GameState>;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updateState: (
    updater: (prev: GameState) => GameState,
    lastAction?: ClientAction,
  ) => void;
  sendTo: (peerId: string, msg: P2PMessage) => void;
  broadcast: (msg: P2PMessage, excludeId?: string) => void;
  modPeerIdRef: React.MutableRefObject<string | null>;
  lastModPulseRef: React.MutableRefObject<number>;
  qualityMetricsRef: React.MutableRefObject<Map<string, any>>;
  connectToPeer: (targetId: string, isBeacon: boolean) => void;
  tryCaptureBeacon: (code: string) => void;
  sessionCode: string;
}

export const usePeerMessaging = ({
  myId,
  gameStateRef,
  setGameState,
  updateState,
  sendTo,
  broadcast,
  modPeerIdRef,
  lastModPulseRef,
  qualityMetricsRef,
  connectToPeer,
  tryCaptureBeacon,
  sessionCode,
}: MessagingProps) => {
  const handleMessage = useCallback(
    async (msg: P2PMessage, peerId: string) => {
      if (peerId === modPeerIdRef.current) {
        lastModPulseRef.current = Date.now();
      }

      switch (msg.type) {
        case "HELLO": {
          const newPlayer = msg.payload.player;
          const iAmServicePeer =
            gameStateRef.current.servicePeers.includes(myId);
          if (iAmServicePeer) {
            updateState((prev) =>
              sessionUtils(
                prev,
                {
                  type: "JOIN_SESSION",
                  payload: { name: newPlayer.name, uuid: newPlayer.uuid },
                },
                peerId,
              ),
            );

            sendTo(peerId, {
              type: "PEER_DISCOVERY",
              payload: { peers: gameStateRef.current.players },
            });
          }
          break;
        }

        case "PEER_DISCOVERY": {
          const peers = msg.payload.peers;
          peers.forEach((p) => {
            if (p.id !== myId) {
              connectToPeer(p.id, false);
            }
          });
          break;
        }

        case "SYNC_STATE": {
          const { state: receivedState, stateHash, lastAction } = msg.payload;
          if (
            stateHash !== gameStateRef.current.stateHash &&
            receivedState.version > gameStateRef.current.version
          ) {
            const iAmServicePeer =
              gameStateRef.current.servicePeers.includes(myId);

            if (
              !iAmServicePeer &&
              lastAction &&
              receivedState.version === gameStateRef.current.version + 1
            ) {
              updateState((prev) => sessionUtils(prev, lastAction, peerId));
              return;
            }

            const incomingPlayers = Array.isArray(receivedState.players)
              ? receivedState.players
              : [];

            const mergedPlayers = incomingPlayers.map((p) => {
              const localPlayer = gameStateRef.current.players.find(
                (lp) => lp.id === p.id,
              );
              if (
                localPlayer?.isConnected &&
                !p.isConnected &&
                Date.now() - (localPlayer.lastSeen || 0) < 10000
              ) {
                return {
                  ...p,
                  isConnected: true,
                  lastSeen: localPlayer.lastSeen,
                };
              }
              return p;
            });

            const migratedState = finalizeState({
              ...INITIAL_STATE,
              ...receivedState,
              players: mergedPlayers,
              messages: mergeMessages(
                gameStateRef.current.messages,
                receivedState.messages,
              ),
            });
            setGameState(migratedState);

            const newMod = receivedState.players.find((p) => p.isMod);
            if (newMod) {
              modPeerIdRef.current = newMod.id;
              lastModPulseRef.current = Date.now();
            }
          }
          break;
        }

        case "ACTION": {
          const { action } = msg.payload;
          const iAmServicePeer =
            gameStateRef.current.servicePeers.includes(myId);
          if (iAmServicePeer) {
            console.log("Mod handling ACTION:", action);
            updateState((prev) => sessionUtils(prev, action, peerId));
          }
          break;
        }

        case "TRANSFER_MOD": {
          const { newModId, state: latestState } = msg.payload;

          const isMe = newModId === myId;
          const processUpdate = (prev: GameState) => {
            const base =
              latestState && latestState.version >= prev.version
                ? latestState
                : prev;
            const newModName =
              base.players.find((p) => p.id === newModId)?.name || "Unknown";
            const otherServicePeers = base.servicePeers.filter(
              (id) => id !== newModId,
            );
            return {
              ...base,
              players: base.players.map((p) => ({
                ...p,
                isMod: p.id === newModId,
              })),
              servicePeers: [newModId, ...otherServicePeers].slice(0, 3),
              messages: mergeMessages(prev.messages, [
                ...(latestState?.messages || []),
                {
                  id: `mod-transfer-${newModId}-${base.version + 100}`,
                  senderId: "system",
                  senderUuid: "system",
                  senderName: "System",
                  content: `Mod role transferred to ${newModName}`,
                  timestamp: Date.now(),
                  isSystem: true,
                },
              ]),
              version: base.version + 100,
            };
          };

          if (isMe) {
            updateState(processUpdate);
          } else {
            setGameState(processUpdate);
          }

          modPeerIdRef.current = newModId;
          lastModPulseRef.current = Date.now();

          if (isMe) {
            // Immediately broadcast heartbeat to prevent other peers from re-electing due to timeout
            broadcast({
              type: "HEARTBEAT",
              payload: { id: myId, timestamp: Date.now(), sequence: 0 },
            });
            tryCaptureBeacon(sessionCode);
            broadcast({
              type: "PEER_DISCOVERY",
              payload: { peers: gameStateRef.current.players },
            });
          } else {
            connectToPeer(newModId, false);
          }
          break;
        }

        case "HEARTBEAT": {
          const { timestamp, sequence } = msg.payload;
          sendTo(peerId, {
            type: "PONG",
            payload: { originalTimestamp: timestamp, sequence },
          });

          const player = gameStateRef.current.players.find(
            (p) => p.id === peerId,
          );
          const iAmServicePeer =
            gameStateRef.current.servicePeers.includes(myId);

          if (iAmServicePeer && player && !player.isConnected) {
            updateState((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.id === peerId
                  ? { ...p, lastSeen: Date.now(), isConnected: true }
                  : p,
              ),
            }));
          } else {
            setGameState((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.id === peerId
                  ? { ...p, lastSeen: Date.now(), isConnected: true }
                  : p,
              ),
            }));
          }
          break;
        }

        case "PONG": {
          const { originalTimestamp, sequence } = msg.payload;
          const latency = Date.now() - originalTimestamp;

          const metrics = qualityMetricsRef.current.get(peerId) || {
            latencies: [],
            jitter: 0,
            packetLoss: 0,
            pendingSequences: new Map(),
          };

          metrics.pendingSequences.delete(sequence);

          metrics.latencies.push(latency);
          if (metrics.latencies.length > 10) metrics.latencies.shift();

          const avgLatency =
            metrics.latencies.reduce((a, b) => a + b, 0) /
            metrics.latencies.length;
          const jitter =
            metrics.latencies.reduce(
              (sum, val) => sum + Math.abs(val - avgLatency),
              0,
            ) / metrics.latencies.length;
          metrics.jitter = jitter;

          qualityMetricsRef.current.set(peerId, metrics);
          break;
        }
      }
    },
    [
      myId,
      updateState,
      sendTo,
      broadcast,
      modPeerIdRef,
      lastModPulseRef,
      gameStateRef,
      setGameState,
      connectToPeer,
      tryCaptureBeacon,
      sessionCode,
      qualityMetricsRef,
    ],
  );

  return { handleMessage };
};
