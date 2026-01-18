import { useState, useEffect, useCallback, useRef } from "react";
import * as Y from "yjs";
import { Player } from "../../types";

export interface UseYjsModReturn {
  modId: string | null;
  isMod: boolean;
  modPlayer: Player | null;
  transferMod: (targetId: string) => void;
}

export function useYjsMod(
  ydoc: Y.Doc | null,
  myPlayerId: string,
  players: Player[],
  sendSystemMessage?: (content: string) => void,
  isCreating?: boolean,
): UseYjsModReturn {
  const [modId, setModId] = useState<string | null>(null);

  // Join activity logging handled by Mod is removed in favor of self-reporting

  // Auto-assign mod or elect new one if disconnected
  const lastAssignedModIdRef = useRef<string | null>(null);

  // Sync mod from Y.Map
  useEffect(() => {
    if (!ydoc) return;

    const modMap = ydoc.getMap("mod");

    const syncMod = () => {
      const currentModId = modMap.get("modId") as string | undefined;
      setModId(currentModId || null);

      // Update our local tracking ref
      if (currentModId) {
        lastAssignedModIdRef.current = currentModId;
      }
    };

    modMap.observe(syncMod);
    syncMod();

    return () => {
      modMap.unobserve(syncMod);
    };
  }, [ydoc]);

  // Mod logging only on assignment/transition
  const isMod = modId === myPlayerId;
  const modPlayer = players.find((p) => p.id === modId) || null;

  // Auto-assign mod or elect new one if disconnected
  useEffect(() => {
    if (!ydoc || !myPlayerId) return;

    const modMap = ydoc.getMap("mod");

    const checkMod = () => {
      const currentModId = modMap.get("modId") as string | undefined;
      const modPlayer = players.find((p) => p.id === currentModId);

      // If joining and haven't seen any mod yet, don't claim it immediately
      if (!isCreating && !currentModId && players.length <= 1) {
        return;
      }

      // If no mod assigned, or mod player is missing (voluntary leave)
      if (!currentModId || !modPlayer) {
        const onlinePlayers = players
          .filter((p) => p.isConnected && !p.isCustom)
          .sort((a, b) => a.joinedAt - b.joinedAt);

        if (onlinePlayers.length > 0 && onlinePlayers[0].id === myPlayerId) {
          ydoc.transact(() => {
            modMap.set("modId", myPlayerId);
          });
          // ONLY the person becoming mod sends the log
          sendSystemMessage?.(`Mod auto-assigned: ${onlinePlayers[0].name}`);
          lastAssignedModIdRef.current = myPlayerId;
        }
        return;
      }

      // If mod is disconnected, wait for 1 minute grace period
      if (modPlayer && !modPlayer.isConnected) {
        const lastSeen = modPlayer.lastSeen || 0;
        const gracePeriod = 60000; // 1 minute
        const now = Date.now();

        if (now - lastSeen > gracePeriod) {
          const onlinePlayers = players
            .filter((p) => p.isConnected && !p.isCustom)
            .sort((a, b) => a.joinedAt - b.joinedAt);

          if (onlinePlayers.length > 0 && onlinePlayers[0].id === myPlayerId) {
            ydoc.transact(() => {
              modMap.set("modId", myPlayerId);
            });
            sendSystemMessage?.(
              `Mod offline for 1 minute. New mod: ${onlinePlayers[0].name}`,
            );
            lastAssignedModIdRef.current = myPlayerId;
          }
        }
      }
    };

    // Run check every 5 seconds if there's a need
    const interval = setInterval(checkMod, 5000);
    checkMod(); // Initial check

    return () => clearInterval(interval);
  }, [ydoc, myPlayerId, players, sendSystemMessage, isCreating]);

  const transferMod = useCallback(
    (targetId: string) => {
      if (!ydoc || modId !== myPlayerId) return;

      const targetPlayer = players.find((p) => p.id === targetId);
      if (!targetPlayer || !targetPlayer.isConnected || targetPlayer.isCustom)
        return;

      const modMap = ydoc.getMap("mod");

      modMap.set("modId", targetId);
      sendSystemMessage?.(`Mod transferred to: ${targetPlayer.name}`);
    },
    [ydoc, modId, myPlayerId, players, sendSystemMessage],
  );

  return {
    modId,
    isMod,
    modPlayer,
    transferMod,
  };
}
