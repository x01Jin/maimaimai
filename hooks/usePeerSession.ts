
import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'peerjs';
import { GameState, Player, ClientAction, ConnectionStatus, P2PMessage, DataConnection, PeerInstance, PeerError } from '../types';
import { ID_PREFIX, NETWORK_CONFIG, STORAGE_CONFIG, GAME_CONFIG } from '../constants';
import { getIdentity, saveIdentity, addRecentSession, saveHostState, loadHostState } from '../utils/storage';
import { INITIAL_STATE, sessionUtils, processQueueState, replacePlayerIdInGameState, createSystemMessage, hashState } from '../utils/sessionUtils';

const PeerConstructor = (Peer as any).default ?? Peer;

const generateShortCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

// Logger utility - replace console.log with this
const logger = {
  log: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message),
};

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
  passHost: (targetId: string, isLeaving?: boolean) => void;
  disconnect: () => void;
  leaveSession: () => void;
  error: string | null;
}

export type { UsePeerSessionReturn };

export const usePeerSession = (): UsePeerSessionReturn => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [myId, setMyId] = useState<string>('');
  const [myUuid, setMyUuid] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Refs for network state
  const peerRef = useRef<PeerInstance | null>(null);
  const beaconRef = useRef<PeerInstance | null>(null); // Secondary peer for "Host Beacon" (Join Code)
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const sessionCodeRef = useRef<string>('');

  // Using refs to access latest state in async callbacks without dependency cycles
  const gameStateRef = useRef<GameState>(INITIAL_STATE);
  const hostPeerIdRef = useRef<string | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const monitorTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHostPulseRef = useRef<number>(Date.now());

  // Safety ref to prevent "Bounce Back" when passing host
  const pendingHostIdRef = useRef<string | null>(null);

  // Ref for late-binding functions to avoid circular dependencies
  const tryCaptureBeaconRef = useRef<(code: string, attempt?: number) => void>(() => { });
  const runLeaderElectionRef = useRef<() => void>(() => { });
  const connectToPeerRef = useRef<(targetId: string, isBeacon: boolean) => void>(() => { });

  // Sync ref
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Load identity
  useEffect(() => {
    const id = getIdentity();
    setMyUuid(id.uuid);
  }, []);

  // Host Persistence
  useEffect(() => {
    if (gameState.players.find(p => p.id === myId)?.isHost && gameState.sessionName) {
      saveHostState(gameState.sessionName, gameState);
    }
  }, [gameState, myId]);

  // --- Networking Primitives ---

  const broadcast = useCallback((msg: P2PMessage, excludeId?: string) => {
    connectionsRef.current.forEach((conn, peerId) => {
      if (peerId !== excludeId && conn.open) {
        conn.send(msg);
      }
    });
  }, []);

  const sendTo = useCallback((peerId: string, msg: P2PMessage) => {
    const conn = connectionsRef.current.get(peerId);
    if (conn && conn.open) {
      conn.send(msg);
    }
  }, []);

  // Helper to register connection and ensure state sync
  const registerConnection = useCallback((conn: DataConnection, isIncoming: boolean) => {
    if (!conn) return;

    // Add to map
    connectionsRef.current.set(conn.peer, conn);

    // If I am host and this is an incoming connection, send state immediately
    if (isIncoming && gameStateRef.current.players.find(p => p.id === myId)?.isHost) {
      conn.send({ type: 'SYNC_STATE', payload: { state: gameStateRef.current } });
    }
  }, [myId]);

  // Update state locally and broadcast (if Host)
  const updateState = useCallback((updater: (prev: GameState) => GameState, originId?: string) => {
    setGameState((prev) => {
      const next = updater(prev);
      const processed = processQueueState(next);

      // Force self to be connected in local state to prevent UI bugs
      const selfIndex = processed.players.findIndex(p => p.id === myId);
      if (selfIndex !== -1 && !processed.players[selfIndex].isConnected) {
        processed.players[selfIndex].isConnected = true;
        processed.players[selfIndex].lastSeen = Date.now();
      }

      // Optimization: Only broadcast if hash changed
      if (hashState(prev) !== hashState(processed)) {
        // If I am Host, I broadcast AUTHORITATIVE state
        if (processed.players.find(p => p.id === myId)?.isHost) {
          broadcast({ type: 'SYNC_STATE', payload: { state: processed } });
        }
      }
      return processed;
    });
  }, [broadcast, myId]);

  // --- Distributed Logic ---

  const handleMessage = useCallback(async (msg: P2PMessage, peerId: string) => {
    // Update heartbeat tracker if message is from Host
    if (peerId === hostPeerIdRef.current) {
      lastHostPulseRef.current = Date.now();
    }

    switch (msg.type) {
      case 'HELLO': {
        const newPlayer = msg.payload.player;
        // If I am Host, add them
        if (gameStateRef.current.players.find(p => p.id === myId)?.isHost) {
          updateState(prev => sessionUtils(prev, {
            type: 'JOIN_SESSION',
            payload: { name: newPlayer.name, uuid: newPlayer.uuid }
          }, peerId));

          // Send them the peer list so they can Mesh
          sendTo(peerId, {
            type: 'PEER_DISCOVERY',
            payload: { peers: gameStateRef.current.players }
          });
        }
        break;
      }

      case 'PEER_DISCOVERY': {
        // Connect to peers I don't know yet (Mesh building)
        // We prioritize connecting to "Backup" peers (oldest ones)
        const peers = msg.payload.peers;
        peers.forEach(p => {
          if (p.id !== myId && !connectionsRef.current.has(p.id)) {
            connectToPeerRef.current(p.id, false);
          }
        });
        break;
      }

      case 'SYNC_STATE': {
        const receivedState = msg.payload.state;
        // Accept state if version is higher or if we are just joining (version 0)
        if (receivedState.version > gameStateRef.current.version || gameStateRef.current.version === 0) {
          setGameState(receivedState);

          const newHost = receivedState.players.find(p => p.isHost);
          if (newHost) {
            hostPeerIdRef.current = newHost.id;
            lastHostPulseRef.current = Date.now(); // Reset timeout
          }
        }
        break;
      }

      case 'ACTION': {
        const { action, from } = msg.payload;
        const iAmHost = gameStateRef.current.players.find(p => p.id === myId)?.isHost;

        if (iAmHost) {
          updateState(prev => sessionUtils(prev, action, from));
        }
        break;
      }

      case 'CLAIM_HOST': {
        const { newHostId, sessionCode } = msg.payload;
        logger.log(`Received CLAIM_HOST from ${newHostId}`);

        // If I am the target, I might have triggered this via passHost, 
        // but I should still process it to confirm I am definitely the host now.

        setGameState(prev => {
          const newHostName = prev.players.find(p => p.id === newHostId)?.name || 'Unknown';
          return {
            ...prev,
            players: prev.players.map(p => ({ ...p, isHost: p.id === newHostId })),
            messages: [...prev.messages, createSystemMessage(`Host role transferred to ${newHostName}`)]
          };
        });
        hostPeerIdRef.current = newHostId;
        sessionCodeRef.current = sessionCode;
        lastHostPulseRef.current = Date.now(); // Reset timeout
        addNotification(`Host migrated to new leader.`, 'info');

        if (newHostId === myId) {
          tryCaptureBeaconRef.current(sessionCode);
        } else {
          // If I'm not the host, ensure I'm connected to the new host
          connectToPeerRef.current(newHostId, false);
        }
        break;
      }

      case 'HEARTBEAT': {
        // Heartbeats from peers update their online status
        setGameState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === msg.payload.id ? { ...p, lastSeen: Date.now(), isConnected: true } : p)
        }));
        break;
      }
    }
  }, [myId, updateState, sendTo, broadcast]);

  // Ref Pattern for Listeners
  const handleMessageRef = useRef(handleMessage);
  useEffect(() => { handleMessageRef.current = handleMessage; }, [handleMessage]);

  const registerConnectionRef = useRef(registerConnection);
  useEffect(() => { registerConnectionRef.current = registerConnection; }, [registerConnection]);

  const setupConnectionListeners = useCallback((conn: DataConnection, isIncoming: boolean) => {
    if (conn.open) registerConnectionRef.current(conn, isIncoming);

    conn.on('open', () => registerConnectionRef.current(conn, isIncoming));

    conn.on('data', (data: any) => {
      if (!connectionsRef.current.has(conn.peer)) {
        registerConnectionRef.current(conn, isIncoming);
      }
      handleMessageRef.current(data, conn.peer);
    });

    conn.on('close', () => {
      connectionsRef.current.delete(conn.peer);
      handleDisconnect(conn.peer);
    });

    conn.on('error', (err: PeerError) => logger.warn(`Connection error: ${err.type}`));
  }, []);

  const connectToPeer = (targetId: string, isBeaconConnect: boolean) => {
    if (!peerRef.current || targetId === myId) return;

    // If we already have a connection, check if it's open
    if (connectionsRef.current.has(targetId)) {
      const existing = connectionsRef.current.get(targetId);
      if (existing && existing.open) return;
    }

    logger.log(`Connecting to peer: ${targetId}`);
    const conn = peerRef.current.connect(targetId, { reliable: true });
    setupConnectionListeners(conn, false);

    conn.on('open', () => {
      conn.send({
        type: 'HELLO',
        payload: {
          player: {
            id: myId,
            uuid: myUuid,
            name: getIdentity().name
          }
        }
      });
    });
  };
  useEffect(() => { connectToPeerRef.current = connectToPeer; });

  const handleDisconnect = (lostPeerId: string) => {
    // PREVENTION: If we are in the process of passing host to this person, ignore the disconnect!
    // This happens because we destroy the Beacon, which might sever the link to them,
    // but we want to assume they are alive and will reconnect via Mesh.
    if (pendingHostIdRef.current === lostPeerId) {
      logger.log(`Ignoring disconnect from Pending Host ${lostPeerId} during migration.`);
      // Aggressively try to reconnect via Main ID to restore mesh
      connectToPeerRef.current(lostPeerId, false);
      return;
    }

    // 1. Mark as offline locally
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === lostPeerId ? { ...p, isConnected: false } : p)
    }));

    // 2. Check if Host was lost (Immediate Trigger via Socket Close)
    if (lostPeerId === hostPeerIdRef.current) {
      logger.warn("Host socket closed. Triggering Election...");
      runLeaderElectionRef.current();
    }
  };

  // --- LEADER ELECTION & REDUNDANCY ---

  const runLeaderElection = () => {
    const currentPlayers = gameStateRef.current.players;

    // Filter potentially active peers (connected or recently seen)
    // We look at our own mesh connections to see who is alive from our perspective
    const candidates = currentPlayers.filter(p =>
      p.id !== hostPeerIdRef.current && // Exclude old host
      (p.id === myId || connectionsRef.current.has(p.id)) // Only consider peers we can actually talk to
    );

    // Sort by joinedAt (Oldest first) - "Service Peer" priority
    candidates.sort((a, b) => a.joinedAt - b.joinedAt);

    if (candidates.length === 0) return;

    const winner = candidates[0];
    logger.log(`Election running. Candidates: ${candidates.length}. Winner: ${winner.name}`);

    if (winner.id === myId) {
      becomeHost();
    }
  };

  useEffect(() => {
    runLeaderElectionRef.current = runLeaderElection;
  });

  const becomeHost = async () => {
    if (gameStateRef.current.players.find(p => p.id === myId)?.isHost) return; // Already host

    logger.log("Promoting self to Host");

    const myName = gameStateRef.current.players.find(p => p.id === myId)?.name || 'Unknown';

    // 1. Update State
    const newState = {
      ...gameStateRef.current,
      players: gameStateRef.current.players.map(p => ({ ...p, isHost: p.id === myId })),
      messages: [...gameStateRef.current.messages, createSystemMessage(`Host migrated to ${myName} (previous host dced)`)],
      version: gameStateRef.current.version + 10 // Jump version to override others
    };

    setGameState(newState);
    hostPeerIdRef.current = myId;
    lastHostPulseRef.current = Date.now(); // I am alive
    pendingHostIdRef.current = null; // Clear any pending status

    // 2. Broadcast CLAIM to everyone I know
    broadcast({
      type: 'CLAIM_HOST',
      payload: { newHostId: myId, sessionCode: sessionCodeRef.current }
    });

    // 3. Immediately Sync State
    broadcast({ type: 'SYNC_STATE', payload: { state: newState } });

    // 4. Try to capture Beacon
    tryCaptureBeaconRef.current(sessionCodeRef.current);
  };

  const tryCaptureBeacon = (code: string, attempt = 0) => {
    if (beaconRef.current) return;

    const beaconId = `${ID_PREFIX}${code}`;
    const beacon = new PeerConstructor(beaconId);

    beacon.on('open', () => {
      logger.log("Beacon captured!");
      beaconRef.current = beacon;
    });

    beacon.on('connection', (conn: DataConnection) => {
      setupConnectionListeners(conn, true);
    });

    beacon.on('error', (err: PeerError) => {
      if (err.type === 'unavailable-id' && attempt < NETWORK_CONFIG.BEACON_RETRY_ATTEMPTS) {
        setTimeout(() => tryCaptureBeacon(code, attempt + 1), NETWORK_CONFIG.BEACON_RETRY_DELAY_MS);
      }
    });
  };
  useEffect(() => { tryCaptureBeaconRef.current = tryCaptureBeacon; });

  // --- HEARTBEAT & MONITOR LOOPS ---

  useEffect(() => {
    // 1. Send Heartbeat (If connected)
    heartbeatTimerRef.current = setInterval(() => {
      if (status !== ConnectionStatus.CONNECTED) return;
      broadcast({ type: 'HEARTBEAT', payload: { id: myId } });
    }, NETWORK_CONFIG.HEARTBEAT_INTERVAL_MS);

    // 2. Monitor Host Health (Redundancy Check)
    monitorTimerRef.current = setInterval(() => {
      if (status !== ConnectionStatus.CONNECTED) return;

      const iAmHost = gameStateRef.current.players.find(p => p.id === myId)?.isHost;
      if (iAmHost) return; // Host doesn't check itself

      const timeSinceHost = Date.now() - lastHostPulseRef.current;

      if (timeSinceHost > NETWORK_CONFIG.HOST_TIMEOUT_MS) {
        logger.warn(`Host timed out (${timeSinceHost}ms). Forcing Election.`);
        // Reset timer to prevent spamming elections while one resolves
        lastHostPulseRef.current = Date.now();
        runLeaderElectionRef.current();
      }
    }, 1000);

    return () => {
      clearInterval(heartbeatTimerRef.current);
      clearInterval(monitorTimerRef.current);
    };
  }, [status, myId, broadcast]);


  // --- ACTIONS ---

  const sendAction = (action: ClientAction) => {
    const iAmHost = gameStateRef.current.players.find(p => p.id === myId)?.isHost;

    if (iAmHost) {
      updateState(prev => sessionUtils(prev, action, myId));
    } else {
      const hostId = hostPeerIdRef.current;
      const beaconId = `${ID_PREFIX}${sessionCodeRef.current}`;

      if (hostId && connectionsRef.current.has(hostId)) {
        sendTo(hostId, { type: 'ACTION', payload: { action, from: myId } });
      } else if (connectionsRef.current.has(beaconId)) {
        sendTo(beaconId, { type: 'ACTION', payload: { action, from: myId } });
      }
    }
  };

  // --- PUBLIC METHODS ---

  const hostSession = async (username: string, existingState?: GameState, recoverCode?: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      setStatus(ConnectionStatus.CONNECTING);
      const idInfo = saveIdentity(username, myUuid);
      setMyUuid(idInfo.uuid);

      const code = recoverCode || generateShortCode();
      sessionCodeRef.current = code;

      const peer = new PeerConstructor();

      peer.on('open', (id: string) => {
        setMyId(id);
        peerRef.current = peer;

        let initialState = existingState || INITIAL_STATE;

        if (!existingState && !recoverCode) {
          initialState = {
            ...INITIAL_STATE,
            sessionName: code,
            players: [{
              id,
              uuid: idInfo.uuid,
              name: username,
              isHost: true,
              isConnected: true,
              joinedAt: Date.now(),
              lastSeen: Date.now()
            }]
          };
        } else if (recoverCode) {
          const saved = loadHostState(recoverCode);
          if (saved) initialState = replacePlayerIdInGameState(saved, saved.players.find(p => p.isHost)?.id || '', id);
        }

        setGameState(initialState);
        hostPeerIdRef.current = id;
        lastHostPulseRef.current = Date.now();
        setStatus(ConnectionStatus.CONNECTED);
        addRecentSession(code);
        tryCaptureBeacon(code);
        resolve(code);
      });

      peer.on('connection', (conn: DataConnection) => setupConnectionListeners(conn, true));
      peer.on('error', (err: PeerError) => { logger.error(err.type); setError(err.type); });
    });
  };

  const joinSession = async (code: string, username: string) => {
    return new Promise<void>((resolve, reject) => {
      setStatus(ConnectionStatus.CONNECTING);
      const idInfo = saveIdentity(username, myUuid);
      setMyUuid(idInfo.uuid);
      sessionCodeRef.current = code;

      const peer = new PeerConstructor();

      peer.on('open', (id: string) => {
        setMyId(id);
        peerRef.current = peer;

        const hostId = `${ID_PREFIX}${code}`;

        // Retry logic for connecting to host (in case migration is happening)
        let attempts = 0;
        const maxAttempts = 3;

        const attemptConnection = () => {
          attempts++;
          logger.log(`Connecting to ${hostId} (Attempt ${attempts})`);

          const conn = peer.connect(hostId, { reliable: true });

          // Set up temporary error listener for this attempt
          const handleConnError = (err: PeerError) => {
            logger.warn(`Connection attempt ${attempts} failed: ${err.type}`);
            if (attempts < maxAttempts) {
              setTimeout(attemptConnection, 1500);
            } else {
              setStatus(ConnectionStatus.ERROR);
              setError("Could not find session. Host may be offline or migrating.");
              reject(err);
            }
          };

          // If connection errors immediately (e.g. peer not found)
          conn.on('error', handleConnError);

          setupConnectionListeners(conn, false);

          conn.on('open', () => {
            // Success!
            conn.off('error', handleConnError); // Remove retry listener
            hostPeerIdRef.current = hostId;
            setStatus(ConnectionStatus.CONNECTED);
            addRecentSession(code);
            conn.send({ type: 'HELLO', payload: { player: { id, uuid: idInfo.uuid, name: username } } });
            resolve();
          });

          // Fallback timeout if open doesn't fire but no error received
          setTimeout(() => {
            if (!conn.open && attempts < maxAttempts && status === ConnectionStatus.CONNECTING) {
              logger.log("Connection timed out, retrying...");
              conn.close();
              attemptConnection();
            }
          }, 3000);
        };

        attemptConnection();
      });

      peer.on('connection', (conn: DataConnection) => setupConnectionListeners(conn, true));
      peer.on('error', (err: PeerError) => {
        logger.error(`Peer Error: ${err.type}`);
        // Don't reject here if we are handling retries inside
      });
    });
  };

  const disconnect = () => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    if (monitorTimerRef.current) clearInterval(monitorTimerRef.current);
    if (peerRef.current) peerRef.current.destroy();
    if (beaconRef.current) beaconRef.current.destroy();

    connectionsRef.current.clear();

    // Reset ALL refs to ensure clean slate for rejoining
    hostPeerIdRef.current = null;
    pendingHostIdRef.current = null;
    lastHostPulseRef.current = Date.now();
    sessionCodeRef.current = '';

    setGameState(INITIAL_STATE);
    setStatus(ConnectionStatus.IDLE);
  };

  const leaveSession = () => {
    const iAmHost = gameStateRef.current.players.find(p => p.id === myId)?.isHost;

    if (iAmHost && gameStateRef.current.players.length > 1) {
      // Voluntary Abdication Logic
      // Find oldest peer that isn't me
      const candidates = gameStateRef.current.players
        .filter(p => p.id !== myId && p.isConnected)
        .sort((a, b) => a.joinedAt - b.joinedAt);

      if (candidates.length > 0) {
        const successor = candidates[0];
        logger.log(`Voluntarily passing host to ${successor.name} before leaving.`);

        // Pass with isLeaving = true to avoid "Transfer" logic
        passHost(successor.id, true);

        // Give network time to flush message before destroying socket
        setTimeout(() => disconnect(), 500);
        return;
      }
    }
    disconnect();
  };

  const passHost = (targetId: string, isLeaving: boolean = false) => {
    if (!gameState.players.find(p => p.id === myId)?.isHost) return;

    logger.log(`Passing host to ${targetId} (Leaving: ${isLeaving})`);

    // 1. Broadcast Claim to notify everyone
    broadcast({
      type: 'CLAIM_HOST',
      payload: { newHostId: targetId, sessionCode: sessionCodeRef.current }
    });

    // 2. Destroy Beacon (This might cut the link to targetId if connected via beacon)
    if (beaconRef.current) {
      beaconRef.current.destroy();
      beaconRef.current = null;
    }

    // If we are leaving, we stop here. leaveSession triggers disconnect() shortly.
    // We do NOT want to update local state or attempt reconnects.
    if (isLeaving) {
      return;
    }

    // --- Logic for Transferring (Staying in session) ---

    // Set pending ref to ignore disconnects during switch
    pendingHostIdRef.current = targetId;

    // CRITICAL FIX: Update heartbeat timestamp to NOW + Grace Period
    // This prevents the monitor loop (which runs every 1s) from immediately 
    // thinking the new host is dead because 'lastHostPulseRef' was stale.
    lastHostPulseRef.current = Date.now() + 5000;

    // Update State locally to reflect new host
    updateState(prev => {
      const targetName = prev.players.find(p => p.id === targetId)?.name || 'Unknown';
      return {
        ...prev,
        players: prev.players.map(p => ({ ...p, isHost: p.id === targetId })),
        messages: [...prev.messages, createSystemMessage(`Host role transferred to ${targetName}`)]
      };
    });

    hostPeerIdRef.current = targetId;

    // Explicitly reconnect to the target via their Main Peer ID to ensure Mesh
    setTimeout(() => {
      connectToPeerRef.current(targetId, false);
      // Clear the safety flag after a few seconds
      setTimeout(() => { pendingHostIdRef.current = null; }, 5000);
    }, 100);
  };

  // Wrappers
  const joinQueueMatch = () => sendAction({ type: 'JOIN_QUEUE_MATCH', payload: { playerId: myId } });
  const joinQueuePartner = (partnerId: string) => sendAction({ type: 'JOIN_QUEUE_PARTNER', payload: { playerId: myId, partnerId } });
  const requestSolo = () => sendAction({ type: 'REQUEST_SOLO', payload: { playerId: myId, playerName: '' } });
  const castVote = (approve: boolean) => gameState.activeVote && sendAction({ type: 'CAST_VOTE', payload: { voteId: gameState.activeVote.id, playerId: myId, approve } });
  const finishTurn = () => gameState.currentSession && sendAction({ type: 'FINISH_TURN', payload: { sessionId: gameState.currentSession.id, playerId: myId } });
  const leaveQueue = (queueId: string) => sendAction({ type: 'LEAVE_QUEUE', payload: { playerId: myId, queueId } });
  const removeFromQueue = (queueId: string) => sendAction({ type: 'REMOVE_FROM_QUEUE', payload: { queueId } });
  const reorderQueue = (queueIds: string[]) => sendAction({ type: 'REORDER_QUEUE', payload: { queueIds } });
  const sendMessage = (content: string) => content.trim() && sendAction({
    type: 'SEND_CHAT',
    payload: { content, senderId: myId, senderUuid: myUuid, senderName: '' }
  });

  const addNotification = (msg: string, type: string) => logger.log(`[${type}] ${msg}`);

  return {
    status,
    isHost: gameState.players.find(p => p.id === myId)?.isHost || false,
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
