import { useState, useEffect, useCallback, useRef } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";
import { YJS_CONFIG, ICE_SERVERS } from "../../constants";
import { ConnectionStatus } from "../../types";
import {
  getIdentity,
  saveIdentity,
  addRecentSession,
  setActiveSession,
  clearActiveSession,
  generateUUID,
} from "../../utils/storage";

export interface UseYjsSessionReturn {
  ydoc: Y.Doc | null;
  provider: WebrtcProvider | null;
  connectionStatus: ConnectionStatus;
  sessionCode: string;
  sessionName: string;
  isCreating: boolean;
  myUuid: string;
  myClientId: number;
  createSession: (username: string, code?: string) => void;
  joinSession: (code: string, username: string) => void;
  leaveSession: () => void;
  recoverSession: (code: string, username: string) => Promise<void>;
  error: string | null;
}

const generateCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export function useYjsSession(): UseYjsSessionReturn {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebrtcProvider | null>(null);
  const [persistence, setPersistence] = useState<IndexeddbPersistence | null>(
    null,
  );
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    ConnectionStatus.IDLE,
  );
  const [sessionCode, setSessionCode] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUuid] = useState(() => getIdentity().uuid || generateUUID());
  const [myClientId, setMyClientId] = useState(0);

  const cleanupRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (provider) {
      provider.destroy();
    }
    if (persistence) {
      persistence.destroy();
    }
    if (ydoc) {
      ydoc.destroy();
    }
    setProvider(null);
    setPersistence(null);
    setYdoc(null);
    setSessionCode("");
    setSessionName("");
    setIsCreating(false);
    setConnectionStatus(ConnectionStatus.IDLE);
    clearActiveSession();
  }, [provider, persistence, ydoc]);

  const initializeSession = useCallback(
    (code: string, username: string, isCreating: boolean) => {
      cleanup();
      setError(null);
      setIsCreating(isCreating);
      setConnectionStatus(ConnectionStatus.CONNECTING);

      try {
        const doc = new Y.Doc();
        const roomName = `${YJS_CONFIG.ROOM_PREFIX}${code.toUpperCase()}`;

        // IndexedDB persistence for offline support
        const idbPersistence = new IndexeddbPersistence(roomName, doc);

        idbPersistence.on("synced", () => {
          console.log("[Y.js] IndexedDB synced");
        });

        // WebRTC provider for P2P sync
        const webrtcProvider = new WebrtcProvider(roomName, doc, {
          signaling: [...YJS_CONFIG.SIGNALING_SERVERS],
          maxConns: YJS_CONFIG.MAX_CONNECTIONS,
          peerOpts: {
            config: {
              iceServers: ICE_SERVERS,
            },
          },
        });

        // Save identity
        saveIdentity(username, myUuid);

        // Track connection status
        webrtcProvider.on("synced", ({ synced }: { synced: boolean }) => {
          if (synced) {
            setConnectionStatus(ConnectionStatus.CONNECTED);
          }
        });

        webrtcProvider.on("status", ({ connected }: { connected: boolean }) => {
          console.log(`[Y.js] WebRTC connected: ${connected}`);
          // Only auto-connect for creators. Joining must wait for data/peers.
          if (connected && isCreating) {
            setConnectionStatus(ConnectionStatus.CONNECTED);
          }
        });

        webrtcProvider.on(
          "peers",
          ({ webrtcPeers }: { webrtcPeers: any[] }) => {
            // Update connection status based on peer count
            if (webrtcPeers.length > 0 || isCreating) {
              setConnectionStatus(ConnectionStatus.CONNECTED);
            }
          },
        );

        // Initialize session metadata in Y.Map if creating
        const metaMap = doc.getMap("meta");
        if (isCreating && !metaMap.get("sessionName")) {
          doc.transact(() => {
            metaMap.set("sessionName", code.toUpperCase());
            metaMap.set("createdAt", Date.now());
            metaMap.set("createdBy", myUuid);
          });
        }

        // Room validation for joining
        let joinValidationTimeout: NodeJS.Timeout | null = null;
        if (!isCreating) {
          joinValidationTimeout = setTimeout(() => {
            const hasData = metaMap.has("sessionName");
            const hasPlayers = doc.getMap("players").size > 0;

            if (!hasData && !hasPlayers) {
              setError("Session not found. Double check the code!");
              setConnectionStatus(ConnectionStatus.ERROR);
              cleanup();
            }
          }, 7000);
        }

        // Observe session name changes
        metaMap.observe(() => {
          const name = metaMap.get("sessionName") as string;
          if (name) {
            setSessionName(name);
            if (joinValidationTimeout) {
              clearTimeout(joinValidationTimeout);
              joinValidationTimeout = null;
            }
            if (!isCreating) {
              setConnectionStatus(ConnectionStatus.CONNECTED);
            }
          }
        });

        // Also clear timeout if players appear
        const playersMap = doc.getMap("players");
        playersMap.observe(() => {
          if (playersMap.size > 0 && joinValidationTimeout) {
            clearTimeout(joinValidationTimeout);
            joinValidationTimeout = null;
            if (!isCreating) {
              setConnectionStatus(ConnectionStatus.CONNECTED);
            }
          }
        });

        // Set initial session name
        const existingName = metaMap.get("sessionName") as string;
        if (existingName) {
          setSessionName(existingName);
          if (joinValidationTimeout) {
            clearTimeout(joinValidationTimeout);
            joinValidationTimeout = null;
          }
          if (!isCreating) {
            setConnectionStatus(ConnectionStatus.CONNECTED);
          }
        } else if (isCreating) {
          setSessionName(code.toUpperCase());
        }

        setYdoc(doc);
        setProvider(webrtcProvider);
        setPersistence(idbPersistence);
        setSessionCode(code.toUpperCase());
        setMyClientId(doc.clientID);

        // Persist session
        addRecentSession(code.toUpperCase());
        setActiveSession(code.toUpperCase());

        // If creating, we're immediately connected (even if alone)
        if (isCreating) {
          setConnectionStatus(ConnectionStatus.CONNECTED);
        }

        // Set connected after a timeout if no peers (solo session)
        const connectionTimeout = setTimeout(() => {
          setConnectionStatus((prev) => {
            if (prev === ConnectionStatus.CONNECTING) {
              if (!isCreating && !metaMap.has("sessionName")) {
                // Should have been handled by joinValidationTimeout, but as a fallback
                return prev;
              }
              return ConnectionStatus.CONNECTED;
            }
            return prev;
          });
        }, 10000);

        // Cleanup function
        cleanupRef.current = () => {
          if (joinValidationTimeout) clearTimeout(joinValidationTimeout);
          clearTimeout(connectionTimeout);
          webrtcProvider.destroy();
          idbPersistence.destroy();
          doc.destroy();
        };
      } catch (err) {
        console.error("[Y.js] Failed to initialize session:", err);
        setError(err instanceof Error ? err.message : "Failed to connect");
        setConnectionStatus(ConnectionStatus.ERROR);
      }
    },
    [cleanup, myUuid],
  );

  const createSession = useCallback(
    (username: string, code?: string) => {
      const sessionCode = code?.toUpperCase() || generateCode();
      initializeSession(sessionCode, username, true);
    },
    [initializeSession],
  );

  const joinSession = useCallback(
    (code: string, username: string) => {
      initializeSession(code.toUpperCase(), username, false);
    },
    [initializeSession],
  );

  const leaveSession = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const recoverSession = useCallback(
    async (code: string, username: string): Promise<void> => {
      initializeSession(code.toUpperCase(), username, false);
    },
    [initializeSession],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    ydoc,
    provider,
    connectionStatus,
    sessionCode,
    sessionName,
    isCreating,
    myUuid,
    myClientId,
    createSession,
    joinSession,
    leaveSession,
    recoverSession,
    error,
  };
}
