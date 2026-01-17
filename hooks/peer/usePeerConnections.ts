import React, { useCallback, useRef } from 'react';
import { DataConnection, P2PMessage, GameState, ClientAction } from '../../types';
import { logger } from './peerUtils';

export const usePeerConnections = (myId: string, gameStateRef: React.MutableRefObject<GameState>) => {
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const qualityMetricsRef = useRef<Map<string, { 
    latencies: number[], 
    jitter: number, 
    packetLoss: number, 
    pendingSequences: Map<number, number> 
  }>>(new Map());
  const actionBufferRef = useRef<ClientAction[]>([]);

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
  }, [myId, sendTo, gameStateRef]);

  const registerConnection = useCallback((conn: DataConnection) => {
    if (!conn) return;
    connectionsRef.current.set(conn.peer, conn);
    
    // Flush action buffer if we just connected to a service peer
    const iAmServicePeer = gameStateRef.current.servicePeers.includes(myId);
    if (!iAmServicePeer && actionBufferRef.current.length > 0) {
        const isServicePeer = gameStateRef.current.servicePeers.includes(conn.peer);
        if (isServicePeer) {
            logger.log(`Flushing ${actionBufferRef.current.length} buffered actions to ${conn.peer}`);
            actionBufferRef.current.forEach(action => {
                conn.send({ type: 'ACTION', payload: { action, from: myId } });
            });
            actionBufferRef.current = [];
        }
    }
  }, [myId, gameStateRef]);

  return {
    connectionsRef,
    qualityMetricsRef,
    actionBufferRef,
    broadcast,
    sendTo,
    sendToServicePeers,
    registerConnection
  };
};
