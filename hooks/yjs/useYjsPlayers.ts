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
  kickSessionPlayer: (playerId: string, ban?: boolean) => void;
  kickStatus: "none" | "kicked" | "banned";
  setKickStatus: (status: "none" | "kicked" | "banned") => void;
}

export function useYjsPlayers(
  ydoc: Y.Doc | null,
  myUuid: string,
  myName: string,
  enabled: boolean = true,
  sendSystemMessage?: (content: string) => void,
): UseYjsPlayersReturn {
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>("");
  const [kickStatus, setKickStatus] = useState<"none" | "kicked" | "banned">(
    "none",
  );

  const prevPlayersRef = useRef<Player[]>([]);
  const hasLoggedJoin = useRef(false);

  // Sync players from Y.Map
  useEffect(() => {
    if (!ydoc) return;

    const playersMap = ydoc.getMap<Player>("players");
    const kickedArray = ydoc.getArray<string>("kickedPlayers");

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

      prevPlayersRef.current = playerList;

      // Sort: Mods first, then by joinedAt
      playerList.sort((a, b) => {
        if (a.isMod !== b.isMod) return a.isMod ? -1 : 1;
        return a.joinedAt - b.joinedAt;
      });
      setPlayers(playerList);

      // Check kick status
      const amIBanned = kickedArray.toArray().includes(myUuid);
      const amIInList = playerList.some((p) => p.uuid === myUuid);

      if (enabled) {
        if (amIBanned) {
          setKickStatus("banned");
        } else if (hasLoggedJoin.current && !amIInList) {
          // If we had successfully joined previously, but now are gone -> Kicked
          setKickStatus("kicked");
        } else {
          setKickStatus("none");
        }
      }
    };

    playersMap.observe(syncPlayers);
    kickedArray.observe(syncPlayers); // Re-run if kicked list changes
    syncPlayers(); // Initial sync

    if (enabled) {
      // Check if kicked
      const kickedArray = ydoc.getArray<string>("kickedPlayers");
      if (kickedArray.toArray().includes(myUuid)) {
        return;
      }

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

        const currentPlayer = playersMap.get(currentId);

        if (currentPlayer) {
          // Check kicked again in heartbeat
          const kickedArray = ydoc.getArray<string>("kickedPlayers");
          if (kickedArray.toArray().includes(myUuid)) {
            return;
          }

          playersMap.set(currentId, {
            ...currentPlayer,
            lastSeen: Date.now(),
            isConnected: true,
          });
        }
      }, 5000);

      // Coordinator logic to detect offline players
      const detector = setInterval(() => {
        const currentPlayers = Array.from(playersMap.values());
        const onlinePlayers = currentPlayers
          .filter((p) => p.isConnected && !p.isCustom)
          .sort((a, b) => a.joinedAt - b.joinedAt);

        // Only the oldest online player (coordinator) updates others
        if (onlinePlayers.length > 0 && onlinePlayers[0].id === myUuid) {
          const now = Date.now();
          const OFFLINE_THRESHOLD = 15000; // 15 seconds

          ydoc.transact(() => {
            playersMap.forEach((player, id) => {
              if (
                player.isConnected &&
                !player.isCustom &&
                player.uuid !== myUuid &&
                player.lastSeen &&
                now - player.lastSeen > OFFLINE_THRESHOLD
              ) {
                playersMap.set(id, {
                  ...player,
                  isConnected: false,
                });
              }
            });
          });
        }
      }, 5000);

      return () => {
        clearInterval(heartbeat);
        clearInterval(detector);
        playersMap.unobserve(syncPlayers);
        kickedArray.unobserve(syncPlayers);
      };
    }

    return () => {
      playersMap.unobserve(syncPlayers);
      kickedArray.unobserve(syncPlayers);
    };
  }, [ydoc, myUuid, myName, enabled]);

  // Reset log flag on disconnect
  useEffect(() => {
    if (!enabled) {
      hasLoggedJoin.current = false;
    }
  }, [enabled]);

  // Self-reported Join Activity Log
  useEffect(() => {
    if (!enabled || !sendSystemMessage || hasLoggedJoin.current) return;

    // Wait until our own player entry is synced and has a name
    const myEntry = players.find((p) => p.uuid === myUuid);
    if (myEntry && myEntry.name) {
      sendSystemMessage(`${myEntry.name} joined the room`);
      hasLoggedJoin.current = true;
    }
  }, [players, myUuid, enabled, sendSystemMessage]);

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
      const player = playersMap.get(playerId);
      if (player) {
        sendSystemMessage?.(`${player.name} left the room`);
        playersMap.delete(playerId);
      }
    },
    [ydoc, sendSystemMessage],
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
      sendSystemMessage?.(`Guest added: ${name}`);
      return id;
    },
    [ydoc, sendSystemMessage],
  );

  const removeCustomPlayer = useCallback(
    (playerId: string) => {
      if (!ydoc) return;

      const playersMap = ydoc.getMap<Player>("players");
      const player = playersMap.get(playerId);

      if (player?.isCustom) {
        playersMap.delete(playerId);
        sendSystemMessage?.(`Guest removed: ${player.name}`);
      }
    },
    [ydoc, sendSystemMessage],
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

  const kickSessionPlayer = useCallback(
    (playerId: string, ban: boolean = true) => {
      if (!ydoc) return;
      const playersMap = ydoc.getMap<Player>("players");
      const kickedArray = ydoc.getArray<string>("kickedPlayers");

      const player = playersMap.get(playerId);
      if (player) {
        // Add to kicked list (by UUID to be persistent) only if banning
        if (ban && !kickedArray.toArray().includes(player.uuid)) {
          kickedArray.push([player.uuid]);
        }

        // Remove from map
        playersMap.delete(playerId);
        sendSystemMessage?.(
          `Mod ${ban ? "banned" : "kicked"} ${player.name} from the session`,
        );
      }
    },
    [ydoc, sendSystemMessage],
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
    kickSessionPlayer,
    kickStatus,
    setKickStatus,
  };
}
