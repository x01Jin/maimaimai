import { useState, useRef, useCallback, useEffect } from 'react';
// @ts-ignore
import { Peer, DataConnection } from 'peerjs';
import { GameState, Player, ClientAction, HostMessage, ConnectionStatus, ChatMessage, QueueEntry, Vote } from '../types';
import { ID_PREFIX } from '../constants';
import { getIdentity, saveIdentity, addRecentSession } from '../utils/storage';

const generateShortCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

const INITIAL_STATE: GameState = {
  players: [],
  queue: [],
  currentSession: null,
  messages: [],
  sessionName: '',
  activeVote: null,
};

interface UsePeerSessionReturn {
  status: ConnectionStatus;
  isHost: boolean;
  gameState: GameState;
  myId: string;
  myUuid: string;
  hostSession: (username: string, existingState?: GameState) => Promise<string>;
  joinSession: (code: string, username: string) => Promise<void>;
  joinQueueMatch: () => void;
  joinQueuePartner: (partnerId: string) => void;
  requestSolo: () => void;
  castVote: (approve: boolean) => void;
  leaveQueue: () => void;
  removeFromQueue: (queueId: string) => void;
  finishTurn: () => void;
  sendMessage: (content: string) => void;
  passHost: (targetId: string) => void;
  disconnect: () => void;
  error: string | null;
}

export const usePeerSession = (): UsePeerSessionReturn => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [myId, setMyId] = useState<string>('');
  const [myUuid, setMyUuid] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const hostConnRef = useRef<DataConnection | null>(null);

  // Load identity on mount
  useEffect(() => {
    const id = getIdentity();
    setMyUuid(id.uuid);
  }, []);

  const broadcastState = useCallback((state: GameState) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'SYNC_STATE', payload: state } as HostMessage);
      }
    });
  }, []);

  const createSystemMessage = (content: string): ChatMessage => ({
    id: crypto.randomUUID(),
    senderId: 'system',
    senderName: 'System',
    content,
    timestamp: Date.now(),
    isSystem: true
  });

  const processQueueState = (state: GameState): GameState => {
    let newState = { ...state };
    if (!newState.currentSession && newState.queue.length > 0) {
      const [next, ...rest] = newState.queue;
      newState.currentSession = next;
      newState.queue = rest;

      // Get names for start message
      const names = next.playerIds.map(id => newState.players.find(p => p.id === id)?.name || 'Unknown');

      const systemMsg = createSystemMessage(`Now Playing: ${names.join(' & ')}`);
      newState.messages = [...newState.messages, systemMsg];
    }
    return newState;
  };

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
    switch (action.type) {
      case 'JOIN_SESSION':
        updateHostState((prev) => {
          const { name, uuid } = action.payload;

          // Reconnection Logic
          const existingPlayerIndex = prev.players.findIndex(p => p.uuid === uuid);
          if (existingPlayerIndex !== -1) {
            const players = [...prev.players];
            players[existingPlayerIndex] = {
              ...players[existingPlayerIndex],
              id: peerId, // Update Peer ID
              isConnected: true, // Mark online
              name: name // Update name if changed
            };

            const systemMsg = createSystemMessage(`${name} reconnected.`);

            return { ...prev, players, messages: [...prev.messages, systemMsg] };
          }

          // New Join Logic
          const newPlayer: Player = {
            id: peerId,
            uuid: uuid,
            name: name,
            isHost: false,
            isConnected: true,
            joinedAt: Date.now(),
          };
          const systemMsg = createSystemMessage(`${name} joined the session.`);

          return {
            ...prev,
            players: [...prev.players, newPlayer],
            messages: [...prev.messages, systemMsg]
          };
        });
        break;

      case 'ACCEPT_HOST_MIGRATION':
        // A client has successfully started a new session and is ready to take over
        const { newCode } = action.payload;
        // Broadcast REDIRECT to everyone
        connectionsRef.current.forEach(conn => {
          if (conn.open) {
            conn.send({ type: 'REDIRECT', payload: { newCode } } as HostMessage);
          }
        });
        break;

      case 'JOIN_QUEUE_MATCH':
        updateHostState((prev) => {
          const playerName = prev.players.find(p => p.id === action.payload.playerId)?.name || 'Unknown';

          const availableMatchIndex = prev.queue.findIndex(q =>
            q.type === 'MATCH' &&
            q.playerIds.length < 2 &&
            !q.playerIds.includes(action.payload.playerId)
          );
          let newQueue = [...prev.queue];
          let msg = '';

          if (availableMatchIndex !== -1) {
            const entry = newQueue[availableMatchIndex];
            newQueue[availableMatchIndex] = { ...entry, playerIds: [...entry.playerIds, action.payload.playerId] };
            msg = `${playerName} joined the match queue.`;
          } else {
            newQueue.push({
              id: crypto.randomUUID(),
              type: 'MATCH',
              playerIds: [action.payload.playerId],
              timestamp: Date.now()
            });
            msg = `${playerName} joined the match queue.`;
          }
          return {
            ...prev,
            queue: newQueue,
            messages: [...prev.messages, createSystemMessage(msg)]
          };
        });
        break;

      case 'JOIN_QUEUE_PARTNER':
        updateHostState((prev) => {
          const p1 = prev.players.find(p => p.id === action.payload.playerId)?.name || 'Unknown';
          const p2 = prev.players.find(p => p.id === action.payload.partnerId)?.name || 'Unknown';

          return {
            ...prev,
            queue: [...prev.queue, {
              id: crypto.randomUUID(),
              type: 'PARTNER',
              playerIds: [action.payload.playerId, action.payload.partnerId],
              timestamp: Date.now()
            }],
            messages: [...prev.messages, createSystemMessage(`${p1} & ${p2} joined the queue.`)]
          };
        });
        break;

      case 'REQUEST_SOLO':
        updateHostState((prev) => {
          if (prev.activeVote) return prev;
          // Count only connected players for quorum?
          const onlinePlayers = prev.players.filter(p => p.isConnected).length;
          const required = Math.ceil(onlinePlayers / 2);

          // No message yet, message on vote pass or initiation? 
          // Let's add initiation message
          const requester = prev.players.find(p => p.id === action.payload.playerId)?.name || 'Unknown';

          return {
            ...prev,
            activeVote: {
              id: crypto.randomUUID(),
              requesterId: action.payload.playerId,
              requesterName: action.payload.playerName,
              approvals: [],
              required,
              createdAt: Date.now()
            },
            messages: [...prev.messages, createSystemMessage(`${requester} requested Solo play.`)]
          };
        });
        break;

      case 'CAST_VOTE':
        updateHostState((prev) => {
          if (!prev.activeVote || prev.activeVote.id !== action.payload.voteId || !action.payload.approve || prev.activeVote.approvals.includes(action.payload.playerId)) return prev;
          const newApprovals = [...prev.activeVote.approvals, action.payload.playerId];
          const passed = newApprovals.length >= prev.activeVote.required;
          let updates: Partial<GameState> = { activeVote: passed ? null : { ...prev.activeVote, approvals: newApprovals } };
          if (passed) {
            updates.queue = [...prev.queue, {
              id: crypto.randomUUID(),
              type: 'SOLO',
              playerIds: [prev.activeVote.requesterId],
              timestamp: Date.now()
            }];
            updates.messages = [...prev.messages, createSystemMessage(`Solo request by ${prev.activeVote.requesterName} passed!`)];
          }
          return { ...prev, ...updates };
        });
        break;

      case 'FINISH_TURN':
        updateHostState((prev) => {
          if (prev.currentSession?.id === action.payload.sessionId) {
            const names = prev.currentSession.playerIds.map(id => prev.players.find(p => p.id === id)?.name || 'Unknown').join(' & ');
            return {
              ...prev,
              currentSession: null,
              messages: [...prev.messages, createSystemMessage(`${names} finished playing.`)]
            };
          }
          return prev;
        });
        break;

      case 'LEAVE_QUEUE':
        updateHostState((prev) => {
          const player = prev.players.find(p => p.id === action.payload.playerId);
          const name = player?.name || 'Unknown';
          let newQueue: QueueEntry[] = [];

          prev.queue.forEach(q => {
            if (q.playerIds.includes(action.payload.playerId)) {
              if (q.type === 'MATCH' && q.playerIds.length > 1) {
                newQueue.push({ ...q, playerIds: q.playerIds.filter(id => id !== action.payload.playerId) });
              }
            } else {
              newQueue.push(q);
            }
          });
          return {
            ...prev,
            queue: newQueue,
            messages: [...prev.messages, createSystemMessage(`${name} left the queue.`)]
          };
        });
        break;

      case 'REMOVE_FROM_QUEUE':
        updateHostState((prev) => ({
          ...prev,
          queue: prev.queue.filter(q => q.id !== action.payload.queueId),
          messages: [...prev.messages, createSystemMessage('An entry was removed from the queue.')]
        }));
        break;

      case 'SEND_CHAT':
        updateHostState((prev) => ({
          ...prev,
          messages: [...prev.messages, {
            id: crypto.randomUUID(),
            senderId: action.payload.senderId,
            senderName: action.payload.senderName,
            content: action.payload.content,
            timestamp: Date.now()
          }]
        }));
        break;
    }
  }, [updateHostState]);

  // --- Methods ---

  const hostSession = async (username: string, existingState?: GameState): Promise<string> => {
    return new Promise((resolve, reject) => {
      setStatus(ConnectionStatus.CONNECTING);

      // Save identity
      const idInfo = saveIdentity(username, myUuid);
      setMyUuid(idInfo.uuid);

      const shortCode = generateShortCode();
      const peerId = `${ID_PREFIX}${shortCode}`;

      const peer = new Peer(peerId);

      peer.on('open', (id: string) => {
        peerRef.current = peer;
        setIsHost(true);
        setMyId(id);
        setStatus(ConnectionStatus.CONNECTED);

        // Save to history
        addRecentSession(shortCode);

        // Init state - if migration, use existing, else fresh
        if (existingState) {
          // We are taking over. We need to update our own Player record to be Host.
          const updatedPlayers = existingState.players.map(p =>
            p.uuid === idInfo.uuid
              ? { ...p, id, isHost: true, isConnected: true }
              : { ...p, isHost: false } // Demote old host if they are still in list (they likely left)
          );
          setGameState({ ...existingState, sessionName: shortCode, players: updatedPlayers });
        } else {
          const initialPlayer: Player = { id, uuid: idInfo.uuid, name: username, isHost: true, isConnected: true, joinedAt: Date.now() };
          setGameState({ ...INITIAL_STATE, players: [initialPlayer], sessionName: shortCode });
        }

        resolve(shortCode);
      });

      peer.on('connection', (conn: DataConnection) => {
        conn.on('open', () => {
          connectionsRef.current.set(conn.peer, conn);
          conn.send({ type: 'SYNC_STATE', payload: gameState } as HostMessage);
        });

        conn.on('data', (data: any) => {
          handleClientAction(data as ClientAction, conn.peer);
        });

        conn.on('close', () => {
          connectionsRef.current.delete(conn.peer);
          // Handle disconnect - Soft disconnect
          updateHostState(prev => {
            const player = prev.players.find(p => p.id === conn.peer);
            let newMessages = prev.messages;
            if (player) {
              newMessages = [...newMessages, createSystemMessage(`${player.name} disconnected.`)];
            }

            return {
              ...prev,
              players: prev.players.map(p => p.id === conn.peer ? { ...p, isConnected: false } : p),
              messages: newMessages
            };
          });
        });
      });

      peer.on('error', (err: any) => {
        if (err.type === 'unavailable-id') {
          peer.destroy();
          hostSession(username, existingState).then(resolve).catch(reject);
        } else {
          setError('Failed to start session.');
          setStatus(ConnectionStatus.ERROR);
          reject(err);
        }
      });
    });
  };

  const joinSession = async (code: string, username: string) => {
    return new Promise<void>((resolve, reject) => {
      setStatus(ConnectionStatus.CONNECTING);

      const idInfo = saveIdentity(username, myUuid);
      setMyUuid(idInfo.uuid);
      addRecentSession(code);

      const peer = new Peer();

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

              // Re-connect to old host is best.
              const tempPeer = new Peer();
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
            peer.destroy();
            // Auto-join new
            await joinSession(newCode, username);
          }
        });

        conn.on('close', () => {
          // Check if we are migrating, if so, ignore close
          if (status !== ConnectionStatus.MIGRATING) {
            setError('Disconnected from host.');
            setStatus(ConnectionStatus.ERROR);
          }
        });

        setTimeout(() => {
          if (!conn.open) {
            setStatus(ConnectionStatus.ERROR);
            setError("Could not connect to host. Check code.");
            reject("Timeout");
          }
        }, 5000);
      });

      peer.on('error', (err: any) => {
        setError('Connection error.');
        setStatus(ConnectionStatus.ERROR);
        reject(err);
      });
    });
  };

  const disconnect = useCallback(() => {
    if (peerRef.current) peerRef.current.destroy();
    setGameState(INITIAL_STATE);
    setStatus(ConnectionStatus.IDLE);
    setMyId('');
    setIsHost(false);
    setError(null);
  }, []);

  const sendAction = (action: ClientAction) => {
    if (isHost) handleClientAction(action, myId);
    else hostConnRef.current?.send(action);
  };

  const joinQueueMatch = () => sendAction({ type: 'JOIN_QUEUE_MATCH', payload: { playerId: myId } });
  const joinQueuePartner = (partnerId: string) => sendAction({ type: 'JOIN_QUEUE_PARTNER', payload: { playerId: myId, partnerId } });
  const requestSolo = () => sendAction({ type: 'REQUEST_SOLO', payload: { playerId: myId, playerName: '' } }); // Name fetched on host
  const castVote = (approve: boolean) => gameState.activeVote && sendAction({ type: 'CAST_VOTE', payload: { voteId: gameState.activeVote.id, playerId: myId, approve } });
  const finishTurn = () => gameState.currentSession && sendAction({ type: 'FINISH_TURN', payload: { sessionId: gameState.currentSession.id } });
  const leaveQueue = () => sendAction({ type: 'LEAVE_QUEUE', payload: { playerId: myId } });
  const removeFromQueue = (queueId: string) => sendAction({ type: 'REMOVE_FROM_QUEUE', payload: { queueId } });
  const sendMessage = (content: string) => content.trim() && sendAction({ type: 'SEND_CHAT', payload: { content, senderId: myId, senderName: '' } });

  const passHost = (targetId: string) => {
    // Send PREPARE_MIGRATION to target
    const conn = connectionsRef.current.get(targetId);
    if (conn) {
      conn.send({ type: 'PREPARE_MIGRATION', payload: { state: gameState } } as HostMessage);
    }
  };

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
    sendMessage,
    passHost,
    disconnect,
    error
  };
};