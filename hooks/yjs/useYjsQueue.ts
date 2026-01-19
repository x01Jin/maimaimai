import { useState, useEffect, useCallback } from "react";
import * as Y from "yjs";
import { QueueEntry, QueueType, Vote, Player } from "../../types";
import { generateUUID } from "../../utils/storage";
import { GAME_CONFIG } from "../../constants";

export interface UseYjsQueueReturn {
  queue: QueueEntry[];
  currentSession: QueueEntry | null;
  finishApprovals: string[];
  activeVote: Vote | null;
  enqueue: (type: QueueType, playerId: string, partnerId?: string) => void;
  leaveQueue: (queueId: string, playerId: string) => void;
  removeFromQueue: (queueId: string) => void;
  kickPlayer: (queueId: string, playerId: string) => void;
  reorderQueue: (queueIds: string[]) => void;
  finishTurn: (playerId: string) => void;
  forceFinishTurn: () => void;
  requestSolo: (playerId: string, playerName: string) => void;
  requestModDemotion: (
    requesterId: string,
    requesterName: string,
    modId: string,
  ) => void;
  castVote: (voteId: string, playerId: string, approve: boolean) => void;
  modDecision: (
    voteId: string,
    decision: "APPROVE" | "REJECT",
    modId: string,
    modName: string,
  ) => void;
  isInQueue: (playerId: string) => boolean;
  isPlaying: (playerId: string) => boolean;
}

export function useYjsQueue(
  ydoc: Y.Doc | null,
  players: Player[],
  myPlayerId: string,
  isMod: boolean,
  sendSystemMessage?: (content: string) => void,
): UseYjsQueueReturn {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [currentSession, setCurrentSession] = useState<QueueEntry | null>(null);
  const [finishApprovals, setFinishApprovals] = useState<string[]>([]);
  const [activeVote, setActiveVote] = useState<Vote | null>(null);

  // Sync from Y.js
  useEffect(() => {
    if (!ydoc) return;

    const queueArray = ydoc.getArray<QueueEntry>("queue");
    const sessionMap = ydoc.getMap("session");

    const syncQueue = () => {
      setQueue(queueArray.toArray());
    };

    const syncSession = () => {
      setCurrentSession(sessionMap.get("current") as QueueEntry | null);
      setFinishApprovals((sessionMap.get("finishApprovals") as string[]) || []);
      setActiveVote(sessionMap.get("activeVote") as Vote | null);
    };

    queueArray.observe(syncQueue);
    sessionMap.observe(syncSession);

    syncQueue();
    syncSession();

    return () => {
      queueArray.unobserve(syncQueue);
      sessionMap.unobserve(syncSession);
    };
  }, [ydoc]);

  const popNextSession = useCallback(() => {
    if (!ydoc) return;

    const queueArray = ydoc.getArray<QueueEntry>("queue");
    const sessionMap = ydoc.getMap("session");

    if (queueArray.length > 0) {
      const next = queueArray.get(0);
      ydoc.transact(() => {
        queueArray.delete(0, 1);
        sessionMap.set("current", next);
        sessionMap.set("finishApprovals", []);
      });
    } else {
      sessionMap.set("current", null);
      sessionMap.set("finishApprovals", []);
    }
  }, [ydoc]);

  const enqueue = useCallback(
    (type: QueueType, playerId: string, partnerId?: string) => {
      if (!ydoc) return;

      const queueArray = ydoc.getArray<QueueEntry>("queue");
      const existingEntries = queueArray.toArray();

      // (Optionally keep check if we want to prevent SAME entry duplicate,
      // but user said "even while in queue should still can queue again")
      // So we remove the alreadyInQueue check.

      if (type === "MATCH") {
        const existingMatchIndex = existingEntries.findIndex(
          (e) => e.type === "MATCH" && e.playerIds.length === 1,
        );

        if (existingMatchIndex !== -1) {
          const match = existingEntries[existingMatchIndex];
          const updatedEntry: QueueEntry = {
            ...match,
            playerIds: [...match.playerIds, playerId],
          };

          ydoc.transact(() => {
            queueArray.delete(existingMatchIndex, 1);
            queueArray.insert(existingMatchIndex, [updatedEntry]);
          });
          const playerName =
            players.find((p) => p.id === playerId)?.name || "Unknown";
          const matchPlayerName =
            players.find((p) => p.id === match.playerIds[0])?.name || "Someone";
          sendSystemMessage?.(`${playerName} matched with ${matchPlayerName}!`);
          return;
        }
      }

      const playerName =
        players.find((p) => p.id === playerId)?.name || "Unknown";
      const partnerName = partnerId
        ? players.find((p) => p.id === partnerId)?.name || "Partner"
        : "";

      if (type === "SOLO") {
        sendSystemMessage?.(`${playerName} joined the queue (Solo)`);
      } else if (type === "PARTNER") {
        sendSystemMessage?.(
          `${playerName} & ${partnerName} joined the queue (Partner)`,
        );
      } else if (type === "MATCH") {
        sendSystemMessage?.(
          `${playerName} ${playerId !== myPlayerId ? "is looking for a match" : "is looking for a match"}...`,
        );
      }

      const entry: QueueEntry = {
        id: generateUUID(),
        type,
        playerIds: partnerId ? [playerId, partnerId] : [playerId],
        timestamp: Date.now(),
      };

      queueArray.push([entry]);
    },
    [ydoc, sendSystemMessage, players],
  );

  // Auto-advance queue if requirements are met
  useEffect(() => {
    if (!ydoc || !isMod || currentSession) return;
    if (queue.length === 0) return;

    const firstEntry = queue[0];
    const isMet = (entry: QueueEntry): boolean => {
      // Requirements for automatic stage advancement:
      // SOLO: 1 player (always met)
      // PARTNER: 2 players (always met)
      // MATCH: 2 players (wait for partner)
      if (entry.type === "MATCH") return entry.playerIds.length === 2;
      return true;
    };

    if (isMet(firstEntry)) {
      popNextSession();
    }
  }, [ydoc, isMod, currentSession, queue, popNextSession]);

  const leaveQueue = useCallback(
    (queueId: string, playerId: string, silent = false) => {
      if (!ydoc) return;

      const queueArray = ydoc.getArray<QueueEntry>("queue");
      const entries = queueArray.toArray();
      const index = entries.findIndex((e) => e.id === queueId);

      if (index === -1) return;

      const entry = entries[index];

      // If player is in this entry, remove them or the whole entry
      if (entry.playerIds.includes(playerId)) {
        const playerName =
          players.find((p) => p.id === playerId)?.name || "Unknown";
        if (entry.playerIds.length === 1) {
          // Remove entire entry
          queueArray.delete(index, 1);
          if (!silent) sendSystemMessage?.(`${playerName} left the queue`);
        } else {
          // Remove just this player from partner queue
          const updatedEntry: QueueEntry = {
            ...entry,
            playerIds: entry.playerIds.filter((id) => id !== playerId),
            type: "MATCH", // Convert to solo match
          };
          ydoc.transact(() => {
            queueArray.delete(index, 1);
            queueArray.insert(index, [updatedEntry]);
          });
          if (!silent)
            sendSystemMessage?.(
              `${playerName} left the pair, remaining player is matching`,
            );
        }
      }
    },
    [ydoc, sendSystemMessage, players],
  );

  const removeFromQueue = useCallback(
    (queueId: string) => {
      if (!ydoc) return;

      const queueArray = ydoc.getArray<QueueEntry>("queue");
      const entries = queueArray.toArray();
      const index = entries.findIndex((e) => e.id === queueId);

      if (index !== -1) {
        const entry = entries[index];
        const names = entry.playerIds
          .map((id) => players.find((p) => p.id === id)?.name || "Unknown")
          .join(" & ");
        queueArray.delete(index, 1);
        sendSystemMessage?.(`Mod removed queue entry: ${names}`);
      }
    },
    [ydoc, sendSystemMessage, players],
  );

  const kickPlayer = useCallback(
    (queueId: string, playerId: string) => {
      const playerName =
        players.find((p) => p.id === playerId)?.name || "Unknown";
      sendSystemMessage?.(`Mod kicked ${playerName} from the queue`);
      leaveQueue(queueId, playerId, true);
    },
    [leaveQueue, players, sendSystemMessage],
  );

  const reorderQueue = useCallback(
    (queueIds: string[]) => {
      if (!ydoc || !isMod) return;

      const queueArray = ydoc.getArray<QueueEntry>("queue");
      const entries = queueArray.toArray();

      // Build reordered list
      const reordered: QueueEntry[] = [];
      for (const id of queueIds) {
        const entry = entries.find((e) => e.id === id);
        if (entry) reordered.push(entry);
      }

      // Replace queue
      ydoc.transact(() => {
        queueArray.delete(0, queueArray.length);
        for (const entry of reordered) {
          queueArray.push([entry]);
        }
      });

      sendSystemMessage?.("Mod reordered the queue");
    },
    [ydoc, isMod, sendSystemMessage],
  );

  const finishTurn = useCallback(
    (playerId: string) => {
      if (!ydoc || !currentSession) return;

      const sessionMap = ydoc.getMap("session");
      const current = sessionMap.get("current") as QueueEntry | null;

      if (!current || !current.playerIds.includes(playerId)) return;

      const approvals = (sessionMap.get("finishApprovals") as string[]) || [];

      if (!approvals.includes(playerId)) {
        const newApprovals = [...approvals, playerId];
        sessionMap.set("finishApprovals", newApprovals);

        // Check if all players approved
        const allApproved = current.playerIds.every((id) =>
          newApprovals.includes(id),
        );
        if (allApproved) {
          const finishedNames = current.playerIds
            .map((id) => players.find((p) => p.id === id)?.name || "Unknown")
            .join(" & ");
          sendSystemMessage?.(`${finishedNames} finished playing`);
          popNextSession();
        }
      }
    },
    [ydoc, currentSession, popNextSession],
  );

  const forceFinishTurn = useCallback(() => {
    if (!ydoc || !isMod) return;
    sendSystemMessage?.("Mod force-cleared the current turn");
    popNextSession();
  }, [ydoc, isMod, popNextSession, sendSystemMessage]);

  const requestSolo = useCallback(
    (playerId: string, playerName: string) => {
      if (!ydoc) return;

      const sessionMap = ydoc.getMap("session");
      const onlinePlayers = players.filter((p) => p.isConnected && !p.isCustom);

      // Auto-approve if few players
      if (onlinePlayers.length <= GAME_CONFIG.AUTO_APPROVE_SOLO_THRESHOLD) {
        enqueue("SOLO", playerId);
        return;
      }

      // Create vote
      const vote: Vote = {
        id: generateUUID(),
        requesterId: playerId,
        requesterName: playerName,
        approvals: [playerId], // Self-approve
        required: Math.ceil(
          onlinePlayers.length * GAME_CONFIG.VOTE_THRESHOLD_RATIO,
        ),
        createdAt: Date.now(),
        type: "SOLO",
      };

      sessionMap.set("activeVote", vote);
    },
    [ydoc, players, enqueue],
  );

  const requestModDemotion = useCallback(
    (requesterId: string, requesterName: string, modId: string) => {
      if (!ydoc) return;

      const sessionMap = ydoc.getMap("session");
      // Check if there is already an active vote
      if (sessionMap.get("activeVote")) return;

      const onlinePlayers = players.filter((p) => p.isConnected && !p.isCustom);
      // Demotion requires 50% of ALL players (excluding the mod? usually inclusive or exclusive.
      // "needs 50% of the players permission". Let's assume inclusive of everyone except maybe the mod themselves don't count?
      // Actually usually it's just > 50% of room size.
      // If 4 players, 2 votes needed? Or 3? > 50% implies 3. >= 50% implies 2.
      // "needs 50%" implies >= 50%.

      const vote: Vote = {
        id: generateUUID(),
        requesterId,
        requesterName,
        approvals: [requesterId], // Self-approve
        required: Math.ceil(onlinePlayers.length * 0.5),
        createdAt: Date.now(),
        type: "DEMOTE_MOD",
        targetId: modId,
      };

      sessionMap.set("activeVote", vote);
      sendSystemMessage?.(`${requesterName} started a vote to demote the Mod!`);
    },
    [ydoc, players, sendSystemMessage],
  );

  const castVote = useCallback(
    (voteId: string, playerId: string, approve: boolean) => {
      if (!ydoc) return;

      const sessionMap = ydoc.getMap("session");
      const vote = sessionMap.get("activeVote") as Vote | null;

      if (!vote || vote.id !== voteId) return;

      if (approve && !vote.approvals.includes(playerId)) {
        const newApprovals = [...vote.approvals, playerId];
        const updatedVote: Vote = { ...vote, approvals: newApprovals };

        if (newApprovals.length >= vote.required) {
          // Vote passed
          ydoc.transact(() => {
            sessionMap.set("activeVote", null);

            if (vote.type === "SOLO") {
              const queueArray = ydoc.getArray<QueueEntry>("queue");
              queueArray.push([
                {
                  id: generateUUID(),
                  type: "SOLO",
                  playerIds: [vote.requesterId],
                  timestamp: Date.now(),
                },
              ]);
              sendSystemMessage?.(
                `Vote passed! ${vote.requesterName} joined queue.`,
              );
            } else if (vote.type === "DEMOTE_MOD") {
              const modMap = ydoc.getMap("mod");
              if (modMap.get("modId") === vote.targetId) {
                // Add to demoted list
                const demotedMods = ydoc.getArray<string>("demotedMods");
                if (!demotedMods.toArray().includes(vote.targetId!)) {
                  demotedMods.push([vote.targetId!]);
                }

                // Find next eligible mod (oldest, connected, not custom, not the DEMOTED player)
                const candidates = players
                  .filter(
                    (p) =>
                      !p.isCustom && p.isConnected && p.id !== vote.targetId,
                  )
                  .sort((a, b) => a.joinedAt - b.joinedAt);

                if (candidates.length > 0) {
                  modMap.set("modId", candidates[0].id);
                  sendSystemMessage?.(
                    `Vote passed! Mod demoted. New Mod: ${candidates[0].name}`,
                  );
                } else {
                  modMap.set("modId", null);
                  sendSystemMessage?.(`Vote passed! Mod demoted.`);
                }
              }
            }
          });
        } else {
          sessionMap.set("activeVote", updatedVote);
        }
      }
    },
    [ydoc],
  );

  const modDecision = useCallback(
    (
      voteId: string,
      decision: "APPROVE" | "REJECT",
      modId: string,
      modName: string,
    ) => {
      if (!ydoc || !isMod) return;

      const sessionMap = ydoc.getMap("session");
      const vote = sessionMap.get("activeVote") as Vote | null;

      if (!vote || vote.id !== voteId) return;

      if (decision === "APPROVE") {
        ydoc.transact(() => {
          sessionMap.set("activeVote", null);
          const queueArray = ydoc.getArray<QueueEntry>("queue");
          queueArray.push([
            {
              id: generateUUID(),
              type: "SOLO",
              playerIds: [vote.requesterId],
              timestamp: Date.now(),
            },
          ]);
        });
        sendSystemMessage?.(
          `Mod approved solo request for ${vote.requesterName}`,
        );
      } else {
        sessionMap.set("activeVote", null);
        sendSystemMessage?.(
          `Mod rejected solo request for ${vote.requesterName}`,
        );
      }
    },
    [ydoc, isMod, sendSystemMessage],
  );

  const isInQueue = useCallback(
    (playerId: string): boolean => {
      return queue.some((entry) => entry.playerIds.includes(playerId));
    },
    [queue],
  );

  const isPlaying = useCallback(
    (playerId: string): boolean => {
      return currentSession?.playerIds.includes(playerId) || false;
    },
    [currentSession],
  );

  return {
    queue,
    currentSession,
    finishApprovals,
    activeVote,
    enqueue,
    leaveQueue,
    removeFromQueue,
    kickPlayer,
    reorderQueue,
    finishTurn,
    forceFinishTurn,
    requestSolo,
    requestModDemotion,
    castVote,
    modDecision,
    isInQueue,
    isPlaying,
  };
}
