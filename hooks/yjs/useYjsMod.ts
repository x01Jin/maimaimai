import { useState, useEffect, useCallback } from "react";
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
): UseYjsModReturn {
  const [modId, setModId] = useState<string | null>(null);

  // Sync mod from Y.Map
  useEffect(() => {
    if (!ydoc) return;

    const modMap = ydoc.getMap("mod");

    const syncMod = () => {
      const currentModId = modMap.get("modId") as string | undefined;
      setModId(currentModId || null);
    };

    modMap.observe(syncMod);
    syncMod();

    return () => {
      modMap.unobserve(syncMod);
    };
  }, [ydoc]);

  // Auto-assign mod if none exists and we're the first player
  useEffect(() => {
    if (!ydoc || !myPlayerId || modId) return;

    const modMap = ydoc.getMap("mod");
    const currentModId = modMap.get("modId") as string | undefined;

    if (!currentModId && players.length > 0) {
      // Find the player with earliest joinedAt
      const sortedPlayers = [...players]
        .filter((p) => p.isConnected && !p.isCustom)
        .sort((a, b) => a.joinedAt - b.joinedAt);

      if (sortedPlayers.length > 0 && sortedPlayers[0].id === myPlayerId) {
        modMap.set("modId", myPlayerId);
        sendSystemMessage?.(`Mod auto-assigned: ${sortedPlayers[0].name}`);
      }
    }
  }, [ydoc, myPlayerId, modId, players]);

  // Handle mod disconnection - elect new mod
  useEffect(() => {
    if (!ydoc || !modId) return;

    const modPlayer = players.find((p) => p.id === modId);

    // If mod is disconnected and we're the next in line, take over
    if (modPlayer && !modPlayer.isConnected) {
      const onlinePlayers = players
        .filter((p) => p.isConnected && !p.isCustom)
        .sort((a, b) => a.joinedAt - b.joinedAt);

      if (onlinePlayers.length > 0 && onlinePlayers[0].id === myPlayerId) {
        const modMap = ydoc.getMap("mod");
        modMap.set("modId", myPlayerId);
        sendSystemMessage?.(
          `Mod connection lost. New mod: ${onlinePlayers[0].name}`,
        );
      }
    }
  }, [ydoc, modId, players, myPlayerId]);

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

  const isMod = modId === myPlayerId;
  const modPlayer = players.find((p) => p.id === modId) || null;

  return {
    modId,
    isMod,
    modPlayer,
    transferMod,
  };
}
