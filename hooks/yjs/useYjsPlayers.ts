import { useState, useEffect, useCallback, useRef } from "react";
import * as Y from "yjs";
import { Player } from "../../types";
import { generateUUID } from "../../utils/storage";

export interface UseYjsPlayersReturn {
  players: Player[];
  myPlayer: Player | null;
  addPlayer: (name: string, uuid: string, isMod?: boolean) => string;
  removePlayer: (playerId: string) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  addCustomPlayer: (name: string) => string;
  removeCustomPlayer: (playerId: string) => void;
  getPlayerById: (playerId: string) => Player | undefined;
  getPlayerByUuid: (uuid: string) => Player | undefined;
}

export function useYjsPlayers(
  ydoc: Y.Doc | null,
  myUuid: string,
  myName: string,
  enabled: boolean = true,
): UseYjsPlayersReturn {
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>("");

  // Sync players from Y.Map
  useEffect(() => {
    if (!ydoc) return;

    const playersMap = ydoc.getMap<Player>("players");

    const syncPlayers = () => {
      const playerList: Player[] = [];
      const seenUuids = new Set<string>();

      playersMap.forEach((player, key) => {
        if (player && player.uuid) {
          // If we encounter a duplicate UUID, clean up legacy entries
          if (seenUuids.has(player.uuid) && key !== player.uuid) {
            playersMap.delete(key);
            return;
          }

          playerList.push({ ...player, id: key });
          seenUuids.add(player.uuid);
        }
      });
      // Sort: Mods first, then by joinedAt
      playerList.sort((a, b) => {
        if (a.isMod !== b.isMod) return a.isMod ? -1 : 1;
        return a.joinedAt - b.joinedAt;
      });
      setPlayers(playerList);
    };

    playersMap.observe(syncPlayers);
    syncPlayers(); // Initial sync

    if (enabled) {
      // Register self using UUID as the key for strict uniqueness
      const existingPlayer = playersMap.get(myUuid);

      if (existingPlayer) {
        setMyPlayerId(myUuid);
        playersMap.set(myUuid, {
          ...existingPlayer,
          id: myUuid,
          isConnected: true,
          lastSeen: Date.now(),
          name: myName || existingPlayer.name,
        });
      } else {
        // Check for legacy random-ID entries for this UUID
        let legacyId: string | undefined;
        playersMap.forEach((p, id) => {
          if (p.uuid === myUuid) legacyId = id;
        });

        if (legacyId) {
          const p = playersMap.get(legacyId)!;
          ydoc.transact(() => {
            playersMap.delete(legacyId!);
            playersMap.set(myUuid, {
              ...p,
              id: myUuid,
              isConnected: true,
              lastSeen: Date.now(),
            });
          });
          setMyPlayerId(myUuid);
        } else {
          const modMap = ydoc.getMap("mod");
          const currentModId = modMap.get("modId") as string | undefined;
          const isFirstPlayer = playersMap.size === 0;

          const newPlayer: Player = {
            id: myUuid,
            uuid: myUuid,
            name: myName,
            isMod: false, // Initialized as false, elected by useYjsMod
            isConnected: true,
            joinedAt: Date.now(),
            lastSeen: Date.now(),
          };

          ydoc.transact(() => {
            playersMap.set(myUuid, newPlayer);
          });

          setMyPlayerId(myUuid);
        }
      }

      // Heartbeat to update lastSeen
      const heartbeat = setInterval(() => {
        const currentId = myPlayerIdRef.current;
        if (!currentId) return;

        const myPlayer = playersMap.get(currentId);
        if (myPlayer) {
          playersMap.set(currentId, {
            ...myPlayer,
            lastSeen: Date.now(),
            isConnected: true,
          });
        }
      }, 5000);

      return () => {
        clearInterval(heartbeat);
        playersMap.unobserve(syncPlayers);
      };
    }

    return () => {
      playersMap.unobserve(syncPlayers);
    };
  }, [ydoc, myUuid, myName, enabled]); // Added enabled to avoid redundant loop

  const myPlayerIdRef = useRef<string>("");
  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);

  const addPlayer = useCallback(
    (name: string, uuid: string, isMod = false): string => {
      if (!ydoc) return "";

      const playersMap = ydoc.getMap<Player>("players");
      const id = generateUUID();

      const player: Player = {
        id,
        uuid,
        name,
        isMod,
        isConnected: true,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      };

      playersMap.set(id, player);
      return id;
    },
    [ydoc],
  );

  const removePlayer = useCallback(
    (playerId: string) => {
      if (!ydoc) return;

      const playersMap = ydoc.getMap<Player>("players");
      playersMap.delete(playerId);
    },
    [ydoc],
  );

  const updatePlayer = useCallback(
    (playerId: string, updates: Partial<Player>) => {
      if (!ydoc) return;

      const playersMap = ydoc.getMap<Player>("players");
      const existing = playersMap.get(playerId);

      if (existing) {
        playersMap.set(playerId, { ...existing, ...updates });
      }
    },
    [ydoc],
  );

  const addCustomPlayer = useCallback(
    (name: string): string => {
      if (!ydoc) return "";

      const playersMap = ydoc.getMap<Player>("players");
      const id = generateUUID();

      const player: Player = {
        id,
        uuid: `custom-${id}`,
        name,
        isMod: false,
        isConnected: true,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        isCustom: true,
      };

      playersMap.set(id, player);
      return id;
    },
    [ydoc],
  );

  const removeCustomPlayer = useCallback(
    (playerId: string) => {
      if (!ydoc) return;

      const playersMap = ydoc.getMap<Player>("players");
      const player = playersMap.get(playerId);

      if (player?.isCustom) {
        playersMap.delete(playerId);
      }
    },
    [ydoc],
  );

  const getPlayerById = useCallback(
    (playerId: string): Player | undefined => {
      return players.find((p) => p.id === playerId);
    },
    [players],
  );

  const getPlayerByUuid = useCallback(
    (uuid: string): Player | undefined => {
      return players.find((p) => p.uuid === uuid);
    },
    [players],
  );

  const myPlayer = players.find((p) => p.id === myPlayerId) || null;

  return {
    players,
    myPlayer,
    addPlayer,
    removePlayer,
    updatePlayer,
    addCustomPlayer,
    removeCustomPlayer,
    getPlayerById,
    getPlayerByUuid,
  };
}
