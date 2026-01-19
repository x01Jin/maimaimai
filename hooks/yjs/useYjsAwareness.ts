import { useState, useEffect, useCallback } from "react";
import { WebrtcProvider } from "y-webrtc";
import { YJS_CONFIG } from "../../constants";

export interface AwarenessState {
  uuid: string;
  name: string;
  clientId: number;
  isOnline: boolean;
  lastSeen: number;
}

export interface UseYjsAwarenessReturn {
  localState: AwarenessState | null;
  connectedPeers: AwarenessState[];
  setLocalState: (state: Partial<AwarenessState>) => void;
  peerCount: number;
}

export function useYjsAwareness(
  provider: WebrtcProvider | null,
  myUuid: string,
  myName: string,
): UseYjsAwarenessReturn {
  const [localState, setLocalStateInternal] = useState<AwarenessState | null>(
    null,
  );
  const [connectedPeers, setConnectedPeers] = useState<AwarenessState[]>([]);

  // Initialize and update local awareness state
  useEffect(() => {
    if (!provider) return;

    const awareness = provider.awareness;
    const clientId = awareness.clientID;

    // Set initial local state
    const initialState: AwarenessState = {
      uuid: myUuid,
      name: myName,
      clientId,
      isOnline: true,
      lastSeen: Date.now(),
    };

    awareness.setLocalState(initialState);
    setLocalStateInternal(initialState);

    // Update lastSeen periodically
    const interval = setInterval(() => {
      const current = awareness.getLocalState() as AwarenessState | null;
      if (current) {
        awareness.setLocalState({
          ...current,
          lastSeen: Date.now(),
        });
      }
    }, YJS_CONFIG.AWARENESS_UPDATE_INTERVAL);

    // Listen for awareness changes
    const handleChange = () => {
      const states = awareness.getStates();
      const peers: AwarenessState[] = [];

      states.forEach((state, clientId) => {
        if (state && clientId !== awareness.clientID) {
          peers.push(state as AwarenessState);
        }
      });

      setConnectedPeers(peers);
    };

    awareness.on("change", handleChange);
    handleChange(); // Initial sync

    return () => {
      clearInterval(interval);
      awareness.off("change", handleChange);
    };
  }, [provider, myUuid, myName]);

  const setLocalState = useCallback(
    (state: Partial<AwarenessState>) => {
      if (!provider) return;

      const awareness = provider.awareness;
      const current = awareness.getLocalState() as AwarenessState | null;

      if (current) {
        const updated = { ...current, ...state, lastSeen: Date.now() };
        awareness.setLocalState(updated);
        setLocalStateInternal(updated);
      }
    },
    [provider],
  );

  return {
    localState,
    connectedPeers,
    setLocalState,
    peerCount: connectedPeers.length,
  };
}
