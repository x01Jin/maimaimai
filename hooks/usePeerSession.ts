import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'peerjs';
import { GameState, Player, ClientAction, ConnectionStatus, P2PMessage, DataConnection, PeerInstance, PeerError } from '../types';
import { ID_PREFIX, NETWORK_CONFIG, STORAGE_CONFIG, GAME_CONFIG } from '../constants';
import { getIdentity, saveIdentity, addRecentSession, saveHostState, loadHostState } from '../utils/storage';
import { INITIAL_STATE, sessionUtils, processQueueState, replacePlayerIdInGameState, createSystemMessage, hashState } from '../utils/sessionUtils';

const PeerConstructor = (Peer as any).default ?? Peer;

const generateShortCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

// Logger utility
const logger = {
  log: (message: string) => console.log(`[p2p] ${message}`),
  warn: (message: string) => console.warn(`[p2p] ${message}`),
  error: (message: string) => console.error(`[p2p] ${message}`),
};

interface UsePeerSessionReturn {
  status: ConnectionStatus;
  isMod: boolean;
  gameState: GameState;
  myId: string;
  myUuid: string;
  createSession: (username: string, existingState?: GameState, recoverCode?: string) => Promise<string>;
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
  transferMod: (targetId: string) => void;
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
  const beaconRef = useRef<PeerInstance | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const sessionCodeRef = useRef<string>('');

  const gameStateRef = useRef<GameState>(INITIAL_STATE);
  const modPeerIdRef = useRef<string | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const servicePeerUpdateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastModPulseRef = useRef<number>(Date.now());
  
  // Ref for quality metrics
  const qualityMetricsRef = useRef<Map<string, { latencies: number[], jitter: number, packetLoss: number }>>(new Map());

  // Refs for late-binding functions
  const tryCaptureBeaconRef = useRef<(code: string, attempt?: number) => void>(() => { });
  const electNewModRef = useRef<() => void>(() => { });
  const connectToPeerRef = useRef<(targetId: string, isBeacon: boolean) => void>(() => { });
  const updateServicePeersRef = useRef<() => void>(() => { });

  // Sync ref
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Load identity
  useEffect(() => {
    const id = getIdentity();
    setMyUuid(id.uuid);
  }, []);

  // Mod Persistence
  useEffect(() => {
    if (gameState.players.find(p => p.id === myId)?.isMod && gameState.sessionName) {
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
  
  const sendToServicePeers = useCallback((msg: P2PMessage, includeSelf = false) => {
    gameStateRef.current.servicePeers.forEach(peerId => {
      if (peerId === myId && !includeSelf) return;
      sendTo(peerId, msg);
    });
  }, [myId, sendTo]);

  // Helper to register connection
  const registerConnection = useCallback((conn: DataConnection) => {
    if (!conn) return;
    connectionsRef.current.set(conn.peer, conn);
  }, []);

  // Update state locally and broadcast (if Service Peer)
  const updateState = useCallback((updater: (prev: GameState) => GameState) => {
    setGameState((prev) => {
      const next = updater(prev);
      const processed = processQueueState(next);
      const newHash = hashState(processed);

      // Force self to be connected
      const selfIndex = processed.players.findIndex(p => p.id === myId);
      if (selfIndex !== -1 && !processed.players[selfIndex].isConnected) {
        processed.players[selfIndex].isConnected = true;
        processed.players[selfIndex].lastSeen = Date.now();
      }

      processed.stateHash = newHash;

      if (prev.stateHash !== newHash) {
        const iAmServicePeer = processed.servicePeers.includes(myId);
        if (iAmServicePeer) {
          broadcast({ type: 'SYNC_STATE', payload: { state: processed, stateHash: newHash } });
        }
      }
      return processed;
    });
  }, [broadcast, myId]);

  // --- Distributed Logic ---

  const handleMessage = useCallback(async (msg: P2PMessage, peerId: string) => {
    if (peerId === modPeerIdRef.current) {
      lastModPulseRef.current = Date.now();
    }

    switch (msg.type) {
      case 'HELLO': {
        const newPlayer = msg.payload.player;
        const iAmServicePeer = gameStateRef.current.servicePeers.includes(myId);
        if (iAmServicePeer) {
          updateState(prev => sessionUtils(prev, {
            type: 'JOIN_SESSION',
            payload: { name: newPlayer.name, uuid: newPlayer.uuid }
          }, peerId));

          sendTo(peerId, {
            type: 'PEER_DISCOVERY',
            payload: { peers: gameStateRef.current.players }
          });
        }
        break;
      }

      case 'PEER_DISCOVERY': {
        const peers = msg.payload.peers;
        peers.forEach(p => {
          if (p.id !== myId && !connectionsRef.current.has(p.id)) {
            connectToPeerRef.current(p.id, false);
          }
        });
        break;
      }

      case 'SYNC_STATE': {
        const { state: receivedState, stateHash } = msg.payload;
        if (stateHash !== gameStateRef.current.stateHash && receivedState.version > gameStateRef.current.version) {
          const migratedState = { ...INITIAL_STATE, ...receivedState };
          setGameState(migratedState);

          const newMod = receivedState.players.find(p => p.isMod);
          if (newMod) {
            modPeerIdRef.current = newMod.id;
            lastModPulseRef.current = Date.now();
          }
        }
        break;
      }

      case 'ACTION': {
        const { action } = msg.payload;
        const iAmServicePeer = gameStateRef.current.servicePeers.includes(myId);
        if (iAmServicePeer) {
          updateState(prev => sessionUtils(prev, action, peerId));
        }
        break;
      }

      case 'TRANSFER_MOD': {
        const { newModId } = msg.payload;
        setGameState(prev => {
          const newModName = prev.players.find(p => p.id === newModId)?.name || 'Unknown';
          return {
            ...prev,
            players: prev.players.map(p => ({ ...p, isMod: p.id === newModId })),
            messages: [...prev.messages, createSystemMessage(`Mod role transferred to ${newModName}`)]
          };
        });
        modPeerIdRef.current = newModId;
        lastModPulseRef.current = Date.now();

        if (newModId === myId) {
          tryCaptureBeaconRef.current(sessionCodeRef.current);
        } else {
          connectToPeerRef.current(newModId, false);
        }
        break;
      }
      
      case 'HEARTBEAT': {
        const { timestamp } = msg.payload;
        sendTo(peerId, { type: 'PONG', payload: { originalTimestamp: timestamp } });
        setGameState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === peerId ? { ...p, lastSeen: Date.now(), isConnected: true } : p)
        }));
        break;
      }

      case 'PONG': {
        const { originalTimestamp } = msg.payload;
        const latency = Date.now() - originalTimestamp;
        
        const metrics = qualityMetricsRef.current.get(peerId) || { latencies: [], jitter: 0, packetLoss: 0 };
        metrics.latencies.push(latency);
        if (metrics.latencies.length > 10) metrics.latencies.shift();
        
        const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
        const jitter = metrics.latencies.reduce((sum, val) => sum + Math.abs(val - avgLatency), 0) / metrics.latencies.length;
        metrics.jitter = jitter;

        qualityMetricsRef.current.set(peerId, metrics);
        break;
      }
    }
  }, [myId, updateState, sendTo]);

  const handleMessageRef = useRef(handleMessage);
  useEffect(() => { handleMessageRef.current = handleMessage; }, [handleMessage]);

  const setupConnectionListeners = useCallback((conn: DataConnection) => {
    conn.on('open', () => registerConnection(conn));
    conn.on('data', (data: any) => handleMessageRef.current(data, conn.peer));
    conn.on('close', () => {
      connectionsRef.current.delete(conn.peer);
      handleDisconnect(conn.peer);
    });
    conn.on('error', (err: PeerError) => logger.warn(`Connection error with ${conn.peer}: ${err.type}`));
  }, [registerConnection]);

  const connectToPeer = (targetId: string, isBeaconConnect: boolean) => {
    if (!peerRef.current || targetId === myId || connectionsRef.current.has(targetId)) return;
    
    logger.log(`Connecting to peer: ${targetId}`);
    const conn = peerRef.current.connect(targetId, { reliable: true });
    setupConnectionListeners(conn);

    conn.on('open', () => {
      conn.send({
        type: 'HELLO',
        payload: {
          player: {
            id: myId,
            uuid: myUuid,
            name: getIdentity().name,
            isMod: false,
            isConnected: true,
            joinedAt: Date.now(),
          }
        }
      });
    });
  };
  useEffect(() => { connectToPeerRef.current = connectToPeer; });

  const handleDisconnect = (lostPeerId: string) => {
    updateState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === lostPeerId ? { ...p, isConnected: false } : p)
    }));

    if (lostPeerId === modPeerIdRef.current) {
      logger.warn("Mod disconnected. Triggering election...");
      electNewModRef.current();
    }
  };

  // --- MOD ELECTION & REDUNDANCY ---

  const electNewMod = () => {
    const candidates = gameStateRef.current.players
      .filter(p => p.id !== modPeerIdRef.current && (p.id === myId || connectionsRef.current.has(p.id)))
      .sort((a, b) => a.joinedAt - b.joinedAt);

    if (candidates.length === 0) return;

    const winner = candidates[0];
    logger.log(`Election winner: ${winner.name}`);

    if (winner.id === myId) {
      becomeMod();
    }
  };
  useEffect(() => { electNewModRef.current = electNewMod; });

  const becomeMod = async () => {
    if (gameStateRef.current.players.find(p => p.id === myId)?.isMod) return;

    logger.log("Promoting self to Mod");
    const myName = gameStateRef.current.players.find(p => p.id === myId)?.name || 'Unknown';

    updateState(prev => {
      const newState = {
        ...prev,
        players: prev.players.map(p => ({ ...p, isMod: p.id === myId })),
        messages: [...prev.messages, createSystemMessage(`Mod migrated to ${myName}.`)],
        version: prev.version + 10
      };
      newState.servicePeers = [myId]; // I am now the service peer
      return newState;
    });

    modPeerIdRef.current = myId;
    lastModPulseRef.current = Date.now();
    broadcast({ type: 'TRANSFER_MOD', payload: { newModId: myId } });
    tryCaptureBeaconRef.current(sessionCodeRef.current);
  };

  const tryCaptureBeacon = (code: string, attempt = 0) => {
    if (beaconRef.current) return;

    const beaconId = `${ID_PREFIX}${code}`;
    const beacon = new PeerConstructor(beaconId, { config: NETWORK_CONFIG.PEERJS_CONFIG });

    beacon.on('open', () => {
      logger.log(`Beacon captured: ${beaconId}`);
      beaconRef.current = beacon;
      beacon.on('connection', (conn: DataConnection) => setupConnectionListeners(conn));
    });

    beacon.on('error', (err: PeerError) => {
      if (err.type === 'unavailable-id' && attempt < NETWORK_CONFIG.BEACON_RETRY_ATTEMPTS) {
        logger.warn(`Beacon ID ${beaconId} unavailable. Retrying... (Attempt ${attempt + 1})`);
        setTimeout(() => tryCaptureBeacon(code, attempt + 1), NETWORK_CONFIG.BEACON_RETRY_DELAY_MS);
      } else {
        logger.error(`Failed to capture beacon ${beaconId} after ${attempt} attempts: ${err.type}`);
      }
    });
  };
  useEffect(() => { tryCaptureBeaconRef.current = tryCaptureBeacon; });
  
  const calculateQualityScore = (metrics: { latencies: number[], jitter: number, packetLoss: number }): number => {
    const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
    const latencyScore = Math.max(0, 100 - (avgLatency / 5)); // Lower latency is better
    const jitterScore = Math.max(0, 100 - (metrics.jitter * 2)); // Lower jitter is better
    const packetLossScore = 100 - (metrics.packetLoss * 100); // Lower packet loss is better
    
    return (latencyScore * 0.6) + (jitterScore * 0.2) + (packetLossScore * 0.2);
  };
  
  const updateServicePeers = () => {
    const onlinePlayers = gameStateRef.current.players.filter(p => p.isConnected);
    const scoredPlayers = onlinePlayers.map(p => {
        const metrics = qualityMetricsRef.current.get(p.id);
        const score = metrics ? calculateQualityScore(metrics) : 0;
        return { ...p, score };
    }).sort((a, b) => b.score - a.score);

    const mod = scoredPlayers.find(p => p.isMod);
    const bestPeers = scoredPlayers.filter(p => !p.isMod).slice(0, 2);
    
    const newServicePeers = mod ? [mod.id, ...bestPeers.map(p => p.id)] : bestPeers.slice(0,1).map(p => p.id);
    
    updateState(prev => ({ ...prev, servicePeers: newServicePeers, players: prev.players.map(p => {
        const scored = scoredPlayers.find(s => s.id === p.id);
        return scored ? { ...p, quality: { latency: qualityMetricsRef.current.get(p.id)?.latencies.reduce((a, b) => a + b, 0) / (qualityMetricsRef.current.get(p.id)?.latencies.length || 1) || 0, jitter: qualityMetricsRef.current.get(p.id)?.jitter || 0, packetLoss: qualityMetricsRef.current.get(p.id)?.packetLoss || 0, score: scored.score } } : p;
    }) }));
  };
  useEffect(() => { updateServicePeersRef.current = updateServicePeers; });
  
  // --- TIMERS ---

  useEffect(() => {
    heartbeatTimerRef.current = setInterval(() => {
      if (status !== ConnectionStatus.CONNECTED) return;
      broadcast({ type: 'HEARTBEAT', payload: { id: myId, timestamp: Date.now() } });
    }, NETWORK_CONFIG.HEARTBEAT_INTERVAL_MS);

    const monitorTimer = setInterval(() => {
      if (status !== ConnectionStatus.CONNECTED) return;
      const iAmMod = gameStateRef.current.players.find(p => p.id === myId)?.isMod;
      if (iAmMod) return;

      if (Date.now() - lastModPulseRef.current > NETWORK_CONFIG.HOST_TIMEOUT_MS) {
        logger.warn(`Mod timed out. Forcing Election.`);
        lastModPulseRef.current = Date.now();
        electNewModRef.current();
      }
    }, 1000);
    
    servicePeerUpdateTimerRef.current = setInterval(() => {
        if(status === ConnectionStatus.CONNECTED && gameStateRef.current.players.find(p => p.id === myId)?.isMod){
            updateServicePeersRef.current();
        }
    }, 5000);

    return () => {
      clearInterval(heartbeatTimerRef.current);
      clearInterval(monitorTimer);
      clearInterval(servicePeerUpdateTimerRef.current);
    };
  }, [status, myId, broadcast]);


  // --- ACTIONS ---

  const sendAction = (action: ClientAction) => {
    const iAmServicePeer = gameStateRef.current.servicePeers.includes(myId);

    if (iAmServicePeer) {
      updateState(prev => sessionUtils(prev, action, myId));
    } else {
      // Send to a random service peer
      const targetPeer = gameStateRef.current.servicePeers[Math.floor(Math.random() * gameStateRef.current.servicePeers.length)];
      if (targetPeer) {
        sendTo(targetPeer, { type: 'ACTION', payload: { action, from: myId } });
      } else {
        logger.warn("No service peers available to send action.");
      }
    }
  };

  // --- PUBLIC METHODS ---

  const createSession = async (username: string, existingState?: GameState, recoverCode?: string): Promise<string> => {
    setStatus(ConnectionStatus.CONNECTING);
    const idInfo = saveIdentity(username, myUuid);
    setMyUuid(idInfo.uuid);

    const code = recoverCode || generateShortCode();
    sessionCodeRef.current = code;

    const peer = new PeerConstructor(undefined, { config: NETWORK_CONFIG.PEERJS_CONFIG });

    return new Promise((resolve, reject) => {
      peer.on('open', (id: string) => {
        setMyId(id);
        peerRef.current = peer;

        let initialState = existingState || INITIAL_STATE;
        if (!existingState) {
          initialState = {
            ...INITIAL_STATE,
            sessionName: code,
            players: [{
              id,
              uuid: idInfo.uuid,
              name: username,
              isMod: true,
              isConnected: true,
              joinedAt: Date.now(),
              lastSeen: Date.now()
            }],
            servicePeers: [id],
          };
        } else if (recoverCode) {
          const saved = loadHostState(recoverCode);
          if (saved) initialState = replacePlayerIdInGameState(saved, saved.players.find(p => p.isMod)?.id || '', id);
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

      peer.on('connection', (conn: DataConnection) => setupConnectionListeners(conn));
      peer.on('error', (err: PeerError) => { logger.error(err.type); setError(err.type); reject(err); });
    });
  };

  const joinSession = async (code: string, username: string) => {
    setStatus(ConnectionStatus.CONNECTING);
    const idInfo = saveIdentity(username, myUuid);
    setMyUuid(idInfo.uuid);
    sessionCodeRef.current = code;

    const peer = new PeerConstructor(undefined, { config: NETWORK_CONFIG.PEERJS_CONFIG });

    return new Promise<void>((resolve, reject) => {
      peer.on('open', (id: string) => {
        setMyId(id);
        peerRef.current = peer;

        const beaconId = `${ID_PREFIX}${code}`;
        connectToPeerRef.current(beaconId, true);
        
        const timeout = setTimeout(() => {
            if(status === ConnectionStatus.CONNECTING){
                setError("Could not find session. The code may be incorrect or the session is offline.");
                setStatus(ConnectionStatus.ERROR);
                reject(new Error("Connection timed out"));
            }
        }, 10000)
        
        const interval = setInterval(() => {
            if(status === ConnectionStatus.CONNECTED){
                clearInterval(interval);
                clearTimeout(timeout);
                resolve();
            }
        }, 100)
      });

      peer.on('connection', (conn: DataConnection) => setupConnectionListeners(conn));
      peer.on('error', (err: PeerError) => {
        logger.error(`Peer Error: ${err.type}`);
        setError(err.type);
        reject(err);
      });
    });
  };

  const disconnect = () => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    if (servicePeerUpdateTimerRef.current) clearInterval(servicePeerUpdateTimerRef.current);
    if (peerRef.current) peerRef.current.destroy();
    if (beaconRef.current) beaconRef.current.destroy();

    connectionsRef.current.clear();
    modPeerIdRef.current = null;
    sessionCodeRef.current = '';

    setGameState(INITIAL_STATE);
    setStatus(ConnectionStatus.IDLE);
  };

  const leaveSession = () => {
    const iAmMod = gameStateRef.current.players.find(p => p.id === myId)?.isMod;

    if (iAmMod && gameStateRef.current.players.length > 1) {
      electNewModRef.current();
    }
    
    // Give network time to flush message before destroying socket
    setTimeout(() => disconnect(), 500);
  };

  const transferMod = (targetId: string) => {
    if (!gameState.players.find(p => p.id === myId)?.isMod) return;

    logger.log(`Transferring mod to ${targetId}`);
    
    // Destroy my beacon so the new mod can claim it
    if (beaconRef.current) {
      beaconRef.current.destroy();
      beaconRef.current = null;
    }

    broadcast({ type: 'TRANSFER_MOD', payload: { newModId: targetId } });
    
    // Manually trigger local update for UI responsiveness
    handleMessageRef.current({ type: 'TRANSFER_MOD', payload: { newModId: targetId } }, myId);
  };

  // Wrappers
  const joinQueueMatch = () => sendAction({ type: 'JOIN_QUEUE_MATCH', payload: { playerId: myId } });
  const joinQueuePartner = (partnerId: string) => sendAction({ type: 'JOIN_QUEUE_PARTNER', payload: { playerId: myId, partnerId } });
  const requestSolo = () => sendAction({ type: 'REQUEST_SOLO', payload: { playerId: myId, playerName: getIdentity().name } });
  const castVote = (approve: boolean) => gameState.activeVote && sendAction({ type: 'CAST_VOTE', payload: { voteId: gameState.activeVote.id, playerId: myId, approve } });
  const finishTurn = () => gameState.currentSession && sendAction({ type: 'FINISH_TURN', payload: { sessionId: gameState.currentSession.id, playerId: myId } });
  const leaveQueue = (queueId: string) => sendAction({ type: 'LEAVE_QUEUE', payload: { playerId: myId, queueId } });
  const removeFromQueue = (queueId: string) => sendAction({ type: 'REMOVE_FROM_QUEUE', payload: { queueId } });
  const reorderQueue = (queueIds: string[]) => sendAction({ type: 'REORDER_QUEUE', payload: { queueIds } });
  const sendMessage = (content: string) => content.trim() && sendAction({
    type: 'SEND_CHAT',
    payload: { content, senderId: myId, senderUuid: myUuid, senderName: getIdentity().name }
  });

  return {
    status,
    isMod: gameState.players.find(p => p.id === myId)?.isMod || false,
    gameState,
    myId,
    myUuid,
    createSession,
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
    transferMod,
    disconnect,
    leaveSession,
    error
  };
};
