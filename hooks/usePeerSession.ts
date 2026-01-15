
import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'peerjs';
import { GameState, Player, ClientAction, HostMessage, ConnectionStatus, ChatMessage, QueueEntry } from '../types';
import { ID_PREFIX } from '../constants';
import { getIdentity, saveIdentity, addRecentSession, saveHostState, loadHostState, clearHostState } from '../utils/storage';
import { INITIAL_STATE, gameReducer, processQueueState, replacePlayerIdInGameState, createSystemMessage } from '../utils/gameReducer';

// Handle PeerJS import which might be default or named depending on bundler
const PeerConstructor = (Peer as any).default ?? Peer;
// Type alias for the connection
type DataConnection = any;

const generateShortCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

interface UsePeerSessionReturn {
  status: ConnectionStatus;
  isHost: boolean;
  gameState: GameState;
  myId: string;
  myUuid: string;
  hostSession: (username: string, existingState?: GameState, recoverCode?: string) => Promise<string>;
  joinSession: (code: string, username: string) => Promise<void>;
  joinQueueMatch: () => void;
  joinQueuePartner: (partnerId: string) => void;
  requestSolo: () => void;
  castVote: (approve: boolean) => void;
  leaveQueue: (queueId: string) => void;
  removeFromQueue: (queueId: string) => void;
  reorderQueue: (queueIds: string[]) => void;
  finishTurn: () => void;
  sendMessage: (content: string) => void;
  passHost: (targetId: string) => void;
  disconnect: () => void;
  leaveSession: () => void;
  error: string | null;
}

export const usePeerSession = (): UsePeerSessionReturn => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [myId, setMyId] = useState<string>('');
  const [myUuid, setMyUuid] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [migrationTarget, setMigrationTarget] = useState<string | null>(null);

  const peerRef = useRef<any>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const hostConnRef = useRef<DataConnection | null>(null);
  const sessionCodeRef = useRef<string>(''); // Keep track for reconnects
  const reconnectTimeoutRef = useRef<any>(null);

  // Use a ref to access the latest state inside callbacks/effects without staleness
  const gameStateRef = useRef<GameState>(INITIAL_STATE);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Load identity on mount
  useEffect(() => {
    const id = getIdentity();
    setMyUuid(id.uuid);
  }, []);

  // Save Host State on Change
  useEffect(() => {
    // Only save if we are the host and have a valid name
    if (isHost && gameState.sessionName) {
      saveHostState(gameState.sessionName, gameState);
    }
  }, [gameState, isHost]);

  const broadcastState = useCallback((state: GameState) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'SYNC_STATE', payload: state } as HostMessage);
      }
    });
  }, []);

  const updateHostState = useCallback((updater: (prev: GameState) => GameState) => {
    setGameState((prev) => {
      const interimState = updater(prev);
      const finalState = processQueueState(interimState);
      broadcastState(finalState);
      return finalState;
    });
  }, [broadcastState]);

  // --- Action Handlers ---

  const handleClientAction = useCallback((action: ClientAction, peerId: string) => {
    // Handle Special Control Actions that have side effects
    if (action.type === 'ACCEPT_HOST_MIGRATION') {
      const { newCode } = action.payload;
      // 1. Broadcast REDIRECT to everyone else
      connectionsRef.current.forEach(conn => {
        if (conn.open) {
          conn.send({ type: 'REDIRECT', payload: { newCode } } as HostMessage);
        }
      });
      // 2. Trigger self-migration
      setMigrationTarget(newCode);
      return;
    }

    // Handle Pure State Reducers
    updateHostState((prev) => gameReducer(prev, action, peerId));
  }, [updateHostState]);

  // --- Methods ---

  const hostSession = async (username: string, existingState?: GameState, recoverCode?: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      setStatus(ConnectionStatus.CONNECTING);

      // Save identity
      const idInfo = saveIdentity(username, myUuid);
      setMyUuid(idInfo.uuid);

      // Logic: If recovering, try the code. If invalid, reject.
      // If new session, generate code.
      const shortCode = recoverCode || generateShortCode();
      const peerId = `${ID_PREFIX}${shortCode}`;

      // Use PeerConstructor which handles default/named export
      const peer = new PeerConstructor(peerId);

      peer.on('open', (id: string) => {
        peerRef.current = peer;
        setIsHost(true);
        setMyId(id);
        setStatus(ConnectionStatus.CONNECTED);
        sessionCodeRef.current = shortCode;

        // Save to history
        addRecentSession(shortCode);

        // --- State Initialization Logic ---

        // 1. Recovering a previous crash/refresh
        const savedState = recoverCode ? loadHostState(recoverCode) : null;

        // 2. Migrating from another host
        const migrationState = existingState;

        const stateToLoad = migrationState || savedState;

        if (stateToLoad) {
          // We are taking over.
          // 1. Fix our own ID references in the inherited state
          // The state currently has our old client ID in queue/session. We need to swap it to our new Host ID.
          const me = stateToLoad.players.find(p => p.uuid === idInfo.uuid);
          let baseState = stateToLoad;

          if (me) {
            baseState = replacePlayerIdInGameState(stateToLoad, me.id, id);
          }

          // 2. Update Players list to reflect Host status
          const updatedPlayers = baseState.players.map(p =>
            p.uuid === idInfo.uuid
              ? { ...p, id, isHost: true, isConnected: true }
              : { ...p, isHost: false } // Demote old host if they are still in list (they likely left)
          );

          // 3. Add System Message for Migration
          const systemMsg = createSystemMessage(`${username} is now the host.`);
          const messages = [...baseState.messages, systemMsg];

          setGameState({ ...baseState, sessionName: shortCode, players: updatedPlayers, messages });
        } else {
          // Fresh Session
          const initialPlayer: Player = { id, uuid: idInfo.uuid, name: username, isHost: true, isConnected: true, joinedAt: Date.now() };
          setGameState({ ...INITIAL_STATE, players: [initialPlayer], sessionName: shortCode });
        }

        resolve(shortCode);
      });

      peer.on('connection', (conn: DataConnection) => {
        conn.on('open', () => {
          connectionsRef.current.set(conn.peer, conn);
          conn.send({ type: 'SYNC_STATE', payload: gameStateRef.current } as HostMessage);
        });

        conn.on('data', (data: any) => {
          handleClientAction(data as ClientAction, conn.peer);
        });

        conn.on('close', () => {
          connectionsRef.current.delete(conn.peer);
          // Handle disconnect - Soft disconnect
          updateHostState(prev => {
            return {
              ...prev,
              players: prev.players.map(p => p.id === conn.peer ? { ...p, isConnected: false } : p),
            };
          });
        });
      });

      peer.on('error', (err: any) => {
        if (err.type === 'unavailable-id') {
          if (recoverCode) {
            console.error("Session code still active, cannot recover immediately.");
            setError("Session code is busy. Try again in a few seconds.");
            setStatus(ConnectionStatus.ERROR);
            reject(err);
          } else {
            peer.destroy();
            hostSession(username, existingState).then(resolve).catch(reject);
          }
        } else {
          setError('Failed to start session.');
          setStatus(ConnectionStatus.ERROR);
          reject(err);
        }
      });
    });
  };

  const joinSession = async (code: string, username: string) => {
    // Clear any pending reconnects if user manually joins
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    return new Promise<void>((resolve, reject) => {
      setStatus(ConnectionStatus.CONNECTING);
      sessionCodeRef.current = code; // Store for auto-reconnect

      const idInfo = saveIdentity(username, myUuid);
      setMyUuid(idInfo.uuid);
      addRecentSession(code);

      const peer = new PeerConstructor();

      peer.on('open', (id: string) => {
        peerRef.current = peer;
        setMyId(id);

        const hostPeerId = `${ID_PREFIX}${code.toUpperCase()}`;
        const conn = peer.connect(hostPeerId);

        conn.on('open', () => {
          hostConnRef.current = conn;
          setStatus(ConnectionStatus.CONNECTED);
          setIsHost(false);
          conn.send({ type: 'JOIN_SESSION', payload: { name: username, uuid: idInfo.uuid } } as ClientAction);
          resolve();
        });

        conn.on('data', async (data: any) => {
          const msg = data as HostMessage;
          if (msg.type === 'SYNC_STATE') {
            setGameState(msg.payload);
          } else if (msg.type === 'PREPARE_MIGRATION') {
            // We are being asked to become the Host
            const oldState = msg.payload.state;
            setStatus(ConnectionStatus.MIGRATING);
            // Close current client connection
            peer.destroy();
            // Start hosting with inherited state
            try {
              const newCode = await hostSession(username, oldState);

              const tempPeer = new PeerConstructor();
              tempPeer.on('open', () => {
                const confConn = tempPeer.connect(hostPeerId);
                confConn.on('open', () => {
                  confConn.send({ type: 'ACCEPT_HOST_MIGRATION', payload: { newCode } } as ClientAction);
                  setTimeout(() => tempPeer.destroy(), 2000);
                });
              });

            } catch (e) {
              console.error("Migration failed", e);
              setError("Failed to take over host.");
            }

          } else if (msg.type === 'REDIRECT') {
            // We are being told to move to a new session
            const { newCode } = msg.payload;
            setStatus(ConnectionStatus.MIGRATING);
            // Clear reconnect timeout so we don't try to go back to old host
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            sessionCodeRef.current = '';

            peer.destroy();
            // Auto-join new
            await joinSession(newCode, username);
          }
        });

        conn.on('close', () => {
          // CRITICAL: Check sessionCodeRef to see if this disconnect was intentional (user left)
          // If sessionCodeRef is empty, it means we called disconnect() manually.
          if (!sessionCodeRef.current) return;
          if (status === ConnectionStatus.MIGRATING) return;

          setStatus(ConnectionStatus.RECONNECTING);
          console.log("Connection lost. Reconnecting in 3s...");

          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            // Retry joining if we still want to be in this session
            if (sessionCodeRef.current === code) {
              joinSession(code, username).catch(e => console.log("Reconnect attempt failed", e));
            }
          }, 3000);
        });

        setTimeout(() => {
          if (!conn.open && status === ConnectionStatus.CONNECTING) {
            conn.close();
          }
        }, 5000);
      });

      peer.on('error', (err: any) => {
        if (status === ConnectionStatus.CONNECTED) return;

        console.error("Peer Error", err);
        if (status === ConnectionStatus.CONNECTING) {
          setStatus(ConnectionStatus.ERROR);
          setError('Connection failed. Host may be offline.');
          reject(err);
        }
      });
    });
  };

  const passHost = (targetId: string) => {
    const conn = connectionsRef.current.get(targetId);
    if (conn) {
      conn.send({ type: 'PREPARE_MIGRATION', payload: { state: gameStateRef.current } } as HostMessage);
    }
  };

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    // Explicitly clear sessionCode so on('close') handlers know not to reconnect
    sessionCodeRef.current = '';

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    setGameState(INITIAL_STATE);
    setStatus(ConnectionStatus.IDLE);
    setMyId('');
    setIsHost(false);
    setError(null);
  }, []);

  const leaveSession = useCallback(() => {
    const currentStatus = isHost;

    if (currentStatus) {
      // Logic: Pick a random connected player (not self) to pass host to
      const connectedPlayers = gameStateRef.current.players.filter(p => p.id !== myId && p.isConnected);

      if (connectedPlayers.length > 0) {
        const randomTarget = connectedPlayers[Math.floor(Math.random() * connectedPlayers.length)];
        console.log("Auto-passing host to", randomTarget.name);
        passHost(randomTarget.id);

        // Give it a split second to send the message before cutting connection
        setTimeout(() => {
          disconnect();
        }, 200);
        return;
      }
    }

    disconnect();
  }, [isHost, myId, disconnect]);

  const sendAction = (action: ClientAction) => {
    if (isHost) handleClientAction(action, myId);
    else hostConnRef.current?.send(action);
  };

  const joinQueueMatch = () => sendAction({ type: 'JOIN_QUEUE_MATCH', payload: { playerId: myId } });
  const joinQueuePartner = (partnerId: string) => sendAction({ type: 'JOIN_QUEUE_PARTNER', payload: { playerId: myId, partnerId } });
  const requestSolo = () => sendAction({ type: 'REQUEST_SOLO', payload: { playerId: myId, playerName: '' } });
  const castVote = (approve: boolean) => gameState.activeVote && sendAction({ type: 'CAST_VOTE', payload: { voteId: gameState.activeVote.id, playerId: myId, approve } });
  const finishTurn = () => gameState.currentSession && sendAction({ type: 'FINISH_TURN', payload: { sessionId: gameState.currentSession.id, playerId: myId } });

  // Updated leaveQueue to require queueId
  const leaveQueue = (queueId: string) => sendAction({ type: 'LEAVE_QUEUE', payload: { playerId: myId, queueId } });
  const removeFromQueue = (queueId: string) => sendAction({ type: 'REMOVE_FROM_QUEUE', payload: { queueId } });
  const reorderQueue = (queueIds: string[]) => sendAction({ type: 'REORDER_QUEUE', payload: { queueIds } });

  // Send message now includes UUID for identity persistence
  const sendMessage = (content: string) => content.trim() && sendAction({
    type: 'SEND_CHAT',
    payload: { content, senderId: myId, senderUuid: myUuid, senderName: '' }
  });

  // --- Effects ---

  // Handle self-migration for the original host
  useEffect(() => {
    if (migrationTarget) {
      const performMigration = async () => {
        // Use Ref to get the latest state (avoid stale closures)
        const currentName = gameStateRef.current.sessionName;
        if (currentName) {
          clearHostState(currentName);
        }

        // Notify UI we are moving
        setStatus(ConnectionStatus.MIGRATING);

        // Stop acting as host
        setIsHost(false);

        // Allow some time for the Redirect messages to be flushed before destroying connection
        await new Promise(resolve => setTimeout(resolve, 500));

        // Destroy old host peer to release the ID/Code
        sessionCodeRef.current = ''; // Prevent auto-reconnect on destroy
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
        }

        // Wait a bit for Peer cleanup
        await new Promise(resolve => setTimeout(resolve, 500));

        // Join new session
        const myName = gameStateRef.current.players.find(p => p.uuid === myUuid)?.name || 'Player';
        // Reset ID so we get a fresh client ID
        setMyId('');

        await joinSession(migrationTarget, myName);

        setMigrationTarget(null);
      };

      performMigration();
    }
  }, [migrationTarget]);

  return {
    status,
    isHost,
    gameState,
    myId,
    myUuid,
    hostSession,
    joinSession,
    joinQueueMatch,
    joinQueuePartner,
    requestSolo,
    castVote,
    finishTurn,
    leaveQueue,
    removeFromQueue,
    reorderQueue,
    sendMessage,
    passHost,
    disconnect,
    leaveSession,
    error
  };
};
