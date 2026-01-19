import { useState, useEffect, useCallback, useRef } from "react";
import * as Y from "yjs";
import { Player } from "../../types";

export interface UseYjsModReturn {
  modId: string | null;
  isMod: boolean;
  modPlayer: Player | null;
  transferMod: (targetId: string) => void;
  resignMod: () => void;
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
        const demotedMods = Array.from(ydoc.getArray<string>("demotedMods"));
        const onlinePlayers = players
          .filter(
            (p) =>
              p.isConnected &&
              !p.isCustom &&
              !demotedMods.includes(p.id) && // Allow them if they are the ONLY one left? Maybe not.
              // Logic: If EVERYONE is demoted, someone has to be mod.
              // But for now, let's just prioritize non-demoted.
              true,
          )
          .sort((a, b) => {
            // Priority 1: Not demoted
            const aDemoted = demotedMods.includes(a.id);
            const bDemoted = demotedMods.includes(b.id);
            if (aDemoted !== bDemoted) return aDemoted ? 1 : -1;
            // Priority 2: Join time
            return a.joinedAt - b.joinedAt;
          });

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
          const demotedMods = Array.from(ydoc.getArray<string>("demotedMods"));
          const onlinePlayers = players
            .filter((p) => p.isConnected && !p.isCustom)
            .sort((a, b) => {
              // Priority 1: Not demoted
              const aDemoted = demotedMods.includes(a.id);
              const bDemoted = demotedMods.includes(b.id);
              if (aDemoted !== bDemoted) return aDemoted ? 1 : -1;
              // Priority 2: Join time
              return a.joinedAt - b.joinedAt;
            });

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

  const resignMod = useCallback(() => {
    if (!ydoc || modId !== myPlayerId) return;

    const modMap = ydoc.getMap("mod");

    // Find next eligible mod (oldest, connected, not custom, not me)
    const candidates = players
      .filter((p) => !p.isCustom && p.isConnected && p.id !== myPlayerId)
      .sort((a, b) => a.joinedAt - b.joinedAt);

    if (candidates.length > 0) {
      const nextMod = candidates[0];
      modMap.set("modId", nextMod.id);
      sendSystemMessage?.(
        `${modPlayer?.name || "Mod"} stepped down. ${nextMod.name} is now Mod.`,
      );
    } else {
      // If no one else is around, just clear it.
      // The auto-election effect might pick me up again if I'm the only one,
      // but that's consistent with "someone must be mod".
      // We'll let the user know they are stuck if they are alone.
      sendSystemMessage?.(`${modPlayer?.name || "Mod"} stepped down.`);
      modMap.set("modId", null);
    }
  }, [ydoc, modId, myPlayerId, players, sendSystemMessage, modPlayer]);

  return {
    modId,
    isMod,
    modPlayer,
    transferMod,
    resignMod,
  };
}
