import React, { useCallback, useRef, useState } from "react";
import Peer from "peerjs";
import {
  ConnectionStatus,
  GameState,
  PeerInstance,
  PeerError,
  DataConnection,
} from "../../types";
import { NETWORK_CONFIG, ID_PREFIX } from "../../constants";
import {
  INITIAL_STATE,
  replacePlayerIdInGameState,
  hashState,
} from "../../utils/sessionUtils";
import {
  saveIdentity,
  loadHostState,
  addRecentSession,
  getIdentity,
} from "../../utils/storage";
import { logger, generateShortCode, getBeaconId } from "./peerUtils";

const PeerConstructor = (Peer as any).default ?? Peer;

interface LifecycleProps {
  myUuid: string;
  setMyUuid: (uuid: string) => void;
  myId: string;
  setMyId: (id: string) => void;
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
  gameStateRef: React.MutableRefObject<GameState>;
  setGameState: (state: GameState) => void;
  modPeerIdRef: React.MutableRefObject<string | null>;
  lastModPulseRef: React.MutableRefObject<number>;
  setupConnectionListeners: (conn: DataConnection, isBeacon?: boolean) => void;
  connectToPeer: (targetId: string, isBeacon: boolean) => void;
}

export const usePeerLifecycle = ({
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
  connectToPeer,
}: LifecycleProps) => {
  const peerRef = useRef<PeerInstance | null>(null);
  const beaconRef = useRef<PeerInstance | null>(null);
  const sessionCodeRef = useRef<string>("");
  const capturingBeaconRef = useRef<string | null>(null);

  const tryCaptureBeacon = useCallback(
    (code: string, attempt = 0) => {
      const beaconId = getBeaconId(code);

      if (
        beaconRef.current ||
        (capturingBeaconRef.current === beaconId && attempt === 0)
      )
        return;

      if (attempt === 0) {
        logger.log(`Attempting to capture beacon: ${beaconId}`);
        capturingBeaconRef.current = beaconId;
      }

      const beacon = new PeerConstructor(beaconId, {
        config: NETWORK_CONFIG.PEERJS_CONFIG,
      });

      beacon.on("open", () => {
        logger.log(`Beacon captured: ${beaconId}`);
        beaconRef.current = beacon;
        capturingBeaconRef.current = null;
        beacon.on("connection", (conn: DataConnection) =>
          setupConnectionListeners(conn, true),
        );
      });

      beacon.on("error", (err: PeerError) => {
        beacon.destroy();

        if (err.type === "unavailable-id" || err.type === "network") {
          if (attempt < NETWORK_CONFIG.BEACON_RETRY_ATTEMPTS) {
            const delay =
              attempt < 3 ? 500 : NETWORK_CONFIG.BEACON_RETRY_DELAY_MS;
            logger.warn(
              `Beacon ID ${beaconId} ${err.type} error. Retrying in ${delay}ms... (Attempt ${attempt + 1})`,
            );
            setTimeout(() => tryCaptureBeacon(code, attempt + 1), delay);
          } else {
            logger.error(
              `Failed to capture beacon ${beaconId} after ${attempt} attempts: ${err.type}`,
            );
            capturingBeaconRef.current = null;
          }
        } else {
          logger.error(`Fatal beacon error: ${err.type}`);
          capturingBeaconRef.current = null;
        }
      });
    },
    [setupConnectionListeners],
  );

  const createSession = async (
    username: string,
    existingState?: GameState,
    recoverCode?: string,
  ): Promise<string> => {
    setStatus(ConnectionStatus.CONNECTING);
    const idInfo = saveIdentity(username, myUuid);
    setMyUuid(idInfo.uuid);

    const code = recoverCode || generateShortCode();
    sessionCodeRef.current = code;

    const peer = new PeerConstructor(undefined, {
      config: NETWORK_CONFIG.PEERJS_CONFIG,
    });

    return new Promise((resolve, reject) => {
      peer.on("open", (id: string) => {
        setMyId(id);
        peerRef.current = peer;

        let initialState = existingState || INITIAL_STATE;
        if (!existingState) {
          initialState = {
            ...INITIAL_STATE,
            sessionName: code,
            players: [
              {
                id,
                uuid: idInfo.uuid,
                name: username,
                isMod: true,
                isConnected: true,
                joinedAt: Date.now(),
                lastSeen: Date.now(),
              },
            ],
            servicePeers: [id],
          };
        } else if (recoverCode) {
          const saved = loadHostState(recoverCode);
          if (saved)
            initialState = replacePlayerIdInGameState(
              saved,
              saved.players.find((p) => p.isMod)?.id || "",
              id,
            );
        }

        initialState.stateHash = hashState(initialState);
        setGameState(initialState);
        modPeerIdRef.current = id;
        lastModPulseRef.current = Date.now();
        setStatus(ConnectionStatus.CONNECTED);
        addRecentSession(code);
        tryCaptureBeacon(code);
        resolve(code);
      });

      peer.on("connection", (conn: DataConnection) =>
        setupConnectionListeners(conn, false),
      );
      peer.on("error", (err: PeerError) => {
        logger.error(err.type);
        if (err.type === "network-disconnected") {
          setStatus(ConnectionStatus.RECONNECTING);
          setTimeout(() => peer.reconnect(), 2000);
        } else {
          setStatus(ConnectionStatus.ERROR);
          reject(err);
        }
      });
    });
  };

  const joinSession = async (codeInput: string, username: string) => {
    const code = codeInput.toUpperCase();
    setStatus(ConnectionStatus.CONNECTING);
    const idInfo = saveIdentity(username, myUuid);
    setMyUuid(idInfo.uuid);
    sessionCodeRef.current = code;

    const peer = new PeerConstructor(undefined, {
      config: NETWORK_CONFIG.PEERJS_CONFIG,
    });

    return new Promise<void>((resolve, reject) => {
      peer.on("open", (id: string) => {
        setMyId(id);
        peerRef.current = peer;

        const beaconId = getBeaconId(code);
        connectToPeer(beaconId, true);

        const timeout = setTimeout(() => {
          if (status === ConnectionStatus.CONNECTING) {
            setStatus(ConnectionStatus.ERROR);
            reject(new Error("Connection timed out"));
          }
        }, 10000);

        const interval = setInterval(() => {
          if (gameStateRef.current.sessionName === code && id !== "") {
            clearInterval(interval);
            clearTimeout(timeout);
            addRecentSession(code);
            resolve();
          }
        }, 100);
      });

      peer.on("connection", (conn: DataConnection) =>
        setupConnectionListeners(conn, false),
      );
      peer.on("error", (err: PeerError) => {
        // Filter out non-fatal peer-unavailable errors (e.g. offline peers in discovery list)
        if (err.type === "peer-unavailable") {
          const beaconId = getBeaconId(code);
          // Only fail if we can't connect to the beacon
          if (err.message && err.message.includes(beaconId)) {
            logger.error(`Beacon unavailable: ${beaconId}`);
            setStatus(ConnectionStatus.ERROR);
            reject(err);
          } else {
            logger.warn(
              `Ignored non-critical peer error during join: ${err.message}`,
            );
          }
          return;
        }

        logger.error(`Peer Error: ${err.type}`);
        if (err.type === "network-disconnected") {
          setStatus(ConnectionStatus.RECONNECTING);
          setTimeout(() => peer.reconnect(), 2000);
        } else {
          setStatus(ConnectionStatus.ERROR);
          reject(err);
        }
      });
    });
  };

  const disconnect = useCallback(() => {
    if (peerRef.current) peerRef.current.destroy();
    if (beaconRef.current) beaconRef.current.destroy();

    peerRef.current = null;
    beaconRef.current = null;
    modPeerIdRef.current = null;
    sessionCodeRef.current = "";

    setGameState(INITIAL_STATE);
    setStatus(ConnectionStatus.IDLE);
  }, [setGameState, setStatus, modPeerIdRef]);

  return {
    peerRef,
    beaconRef,
    sessionCodeRef,
    tryCaptureBeacon,
    createSession,
    joinSession,
    disconnect,
  };
};
