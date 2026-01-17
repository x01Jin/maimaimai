import React, { useCallback, useEffect, useRef } from 'react';
import { 
  GameState, 
  ConnectionStatus, 
  P2PMessage 
} from '../../types';
import { NETWORK_CONFIG } from '../../constants';
import { logger } from './peerUtils';

interface CoordinationProps {
  myId: string;
  status: ConnectionStatus;
  gameStateRef: React.MutableRefObject<GameState>;
  connectionsRef: React.MutableRefObject<Map<string, any>>;
  qualityMetricsRef: React.MutableRefObject<Map<string, any>>;
  broadcast: (msg: P2PMessage, excludeId?: string) => void;
  updateState: (updater: (prev: GameState) => GameState) => void;
  becomeMod: () => void;
  modPeerIdRef: React.MutableRefObject<string | null>;
  lastModPulseRef: React.MutableRefObject<number>;
}

export const usePeerCoordination = ({
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
}: CoordinationProps) => {
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const servicePeerUpdateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatSequenceRef = useRef<number>(0);

  const electNewMod = useCallback(() => {
    const candidates = gameStateRef.current.players
      .filter(p => p.id !== modPeerIdRef.current && (p.id === myId || connectionsRef.current.has(p.id)))
      .sort((a, b) => a.joinedAt - b.joinedAt);

    if (candidates.length === 0) return;

    const winner = candidates[0];
    logger.log(`Election winner: ${winner.name}`);

    if (winner.id === myId) {
      becomeMod();
    }
  }, [myId, gameStateRef, connectionsRef, modPeerIdRef, becomeMod]);

  const calculateQualityScore = useCallback((metrics: { latencies: number[], jitter: number, packetLoss: number }): number => {
    const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
    const latencyScore = Math.max(0, 100 - (avgLatency / 5));
    const jitterScore = Math.max(0, 100 - (metrics.jitter * 2));
    const packetLossScore = 100 - (metrics.packetLoss * 100);
    
    return (latencyScore * 0.6) + (jitterScore * 0.2) + (packetLossScore * 0.2);
  }, []);

  const updateServicePeers = useCallback(() => {
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
        const metrics = qualityMetricsRef.current.get(p.id);
        return scored ? { 
          ...p, 
          quality: { 
            latency: metrics?.latencies.reduce((a: number, b: number) => a + b, 0) / (metrics?.latencies.length || 1) || 0, 
            jitter: metrics?.jitter || 0, 
            packetLoss: metrics?.packetLoss || 0, 
            score: scored.score 
          } 
        } : p;
    }) }));
  }, [gameStateRef, qualityMetricsRef, calculateQualityScore, updateState]);

  useEffect(() => {
    let currentHeartbeatInterval: number = NETWORK_CONFIG.HEARTBEAT_INTERVAL_MS;
    
    const tickHeartbeat = () => {
        if (status === ConnectionStatus.CONNECTED) {
            const sequence = ++heartbeatSequenceRef.current;
            const now = Date.now();
            broadcast({ type: 'HEARTBEAT', payload: { id: myId, timestamp: now, sequence } });
            
            connectionsRef.current.forEach((_, peerId) => {
              const metrics = qualityMetricsRef.current.get(peerId) || { latencies: [], jitter: 0, packetLoss: 0, pendingSequences: new Map() };
              metrics.pendingSequences.set(sequence, now);
              
              let lostCount = 0;
              const timeout = 5000;
              metrics.pendingSequences.forEach((time: number, seq: number) => {
                if (now - time > timeout) {
                  lostCount++;
                  metrics.pendingSequences.delete(seq);
                }
              });
              
              if (lostCount > 0) {
                metrics.packetLoss = Math.min(1, (metrics.packetLoss * 0.8) + ( (lostCount / 5) * 0.2 ));
              } else {
                metrics.packetLoss = metrics.packetLoss * 0.95;
              }

              qualityMetricsRef.current.set(peerId, metrics);
            });

            const metricsList = Array.from(qualityMetricsRef.current.values());
            const avgJitter = metricsList.length > 0 
                ? metricsList.reduce<number>((acc, m: any) => acc + (m.jitter || 0), 0) / metricsList.length 
                : 0;
            
            if (avgJitter < 5) {
                currentHeartbeatInterval = Math.min(currentHeartbeatInterval + 500, NETWORK_CONFIG.ADAPTIVE_HEARTBEAT_MAX_MS);
            } else {
                currentHeartbeatInterval = NETWORK_CONFIG.HEARTBEAT_INTERVAL_MS;
            }
        }
        heartbeatTimerRef.current = setTimeout(tickHeartbeat, currentHeartbeatInterval) as any;
    };

    heartbeatTimerRef.current = setTimeout(tickHeartbeat, currentHeartbeatInterval) as any;

    const monitorTimer = setInterval(() => {
      if (status !== ConnectionStatus.CONNECTED && status !== ConnectionStatus.MIGRATING) return;
      const iAmMod = gameStateRef.current.players.find(p => p.id === myId)?.isMod;
      if (iAmMod) return;

      const timeout = status === ConnectionStatus.MIGRATING ? 10000 : NETWORK_CONFIG.HOST_TIMEOUT_MS;

      if (Date.now() - lastModPulseRef.current > timeout) {
        logger.warn(`Mod timed out. Forcing Election.`);
        lastModPulseRef.current = Date.now();
        electNewMod();
      }
    }, 1000);
    
    servicePeerUpdateTimerRef.current = setInterval(() => {
        const iAmMod = gameStateRef.current.players.find(p => p.id === myId)?.isMod;
        if(status === ConnectionStatus.CONNECTED && iAmMod){
            updateServicePeers();
        }
    }, 5000);

    return () => {
      if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
      clearInterval(monitorTimer);
      clearInterval(servicePeerUpdateTimerRef.current);
    };
  }, [status, myId, broadcast, connectionsRef, qualityMetricsRef, gameStateRef, lastModPulseRef, electNewMod, updateServicePeers]);

  return { electNewMod, updateServicePeers };
};
