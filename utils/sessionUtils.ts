import {
  GameState,
  ClientAction,
  Player,
  QueueEntry,
  ChatMessage,
} from "../types";
import { generateUUID } from "./storage";
import { NETWORK_CONFIG } from "../constants";

export const INITIAL_STATE: GameState = {
  players: [],
  queue: [],
  currentSession: null,
  finishApprovals: [],
  messages: [],
  sessionName: "",
  activeVote: null,
  version: 0,
  servicePeers: [],
  stateHash: "",
};

export const createSystemMessage = (content: string): ChatMessage => ({
  id: generateUUID(),
  senderId: "system",
  senderUuid: "system",
  senderName: "System",
  content,
  timestamp: Date.now(),
  isSystem: true,
});

// Simple hash for state comparison
export const hashState = (state: GameState): string => {
  const str = JSON.stringify({
    q: state.queue,
    cs: state.currentSession,
    fa: state.finishApprovals,
    p: state.players.map((p) => ({ id: p.id, c: p.isConnected, m: p.isMod })),
    v: state.activeVote,
    // Use a combined string of message IDs + their reaction counts/keys to detect reaction changes
    m_sync: state.messages.map((m) => ({
      i: m.id,
      r: m.reactions
        ? Object.entries(m.reactions)
            .map(([e, u]) => e + u.length)
            .join("")
        : "",
    })),
    sp: state.servicePeers,
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

export const mergeMessages = (
  local: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] => {
  const map = new Map<string, ChatMessage>();

  // Process local messages first
  local.forEach((msg) => map.set(msg.id, msg));

  // Process incoming, overwriting if it seems "better" or equal
  incoming.forEach((msg) => {
    const existing = map.get(msg.id);
    if (!existing) {
      map.set(msg.id, msg);
    } else {
      // Favor the one with more reactions
      const existingR = Object.values(existing.reactions || {}).flat().length;
      const incomingR = Object.values(msg.reactions || {}).flat().length;

      // If incoming has same or more reactions, or has a UUID when existing doesn't
      if (incomingR >= existingR || (!existing.senderUuid && msg.senderUuid)) {
        map.set(msg.id, msg);
      }
    }
  });

  const merged = Array.from(map.values()).sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  if (merged.length > NETWORK_CONFIG.MAX_CHAT_HISTORY) {
    return merged.slice(merged.length - NETWORK_CONFIG.MAX_CHAT_HISTORY);
  }
  return merged;
};

// Helper for deep ID replacement
export const replacePlayerIdInGameState = (
  state: GameState,
  oldId: string,
  newId: string,
): GameState => {
  const replaceIds = (ids: string[]) =>
    ids.map((id) => (id === oldId ? newId : id));

  return {
    ...state,
    players: state.players.map((p) =>
      p.id === oldId ? { ...p, id: newId } : p,
    ),
    queue: state.queue.map((q) => ({
      ...q,
      playerIds: replaceIds(q.playerIds),
    })),
    currentSession: state.currentSession
      ? {
          ...state.currentSession,
          playerIds: replaceIds(state.currentSession.playerIds),
        }
      : null,
    finishApprovals: replaceIds(state.finishApprovals),
    activeVote: state.activeVote
      ? {
          ...state.activeVote,
          requesterId:
            state.activeVote.requesterId === oldId
              ? newId
              : state.activeVote.requesterId,
          approvals: replaceIds(state.activeVote.approvals),
        }
      : null,
    servicePeers: replaceIds(state.servicePeers),
    // Bump version on ID swap to force sync
    version: state.version + 1,
  };
};

export const processQueueState = (state: GameState): GameState => {
  let newState = { ...state };

  if (!newState.currentSession && newState.queue.length > 0) {
    const next = newState.queue[0];

    // MATCH wait logic: If it's a MATCH type, wait until there are 2 players
    if (next.type === "MATCH" && next.playerIds.length < 2) {
      return newState;
    }

    newState.currentSession = next;
    newState.finishApprovals = [];
    newState.queue = newState.queue.slice(1);

    const names = next.playerIds.map(
      (id) => newState.players.find((p) => p.id === id)?.name || "Unknown",
    );
    const systemMsg = createSystemMessage(`Now Playing: ${names.join(" & ")}`);
    newState.messages = [...newState.messages, systemMsg];
    newState.version += 1;
  }
  return newState;
};

// Returns new state based on action
export const sessionUtils = (
  state: GameState,
  action: ClientAction,
  peerId: string,
): GameState => {
  // Base state with incremented version by default, can be overridden
  let nextState = { ...state, version: state.version + 1 };

  // Truncate messages if they exceed limit
  const limitMessages = (msgs: ChatMessage[]) => {
    if (msgs.length > NETWORK_CONFIG.MAX_CHAT_HISTORY) {
      return msgs.slice(msgs.length - NETWORK_CONFIG.MAX_CHAT_HISTORY);
    }
    return msgs;
  };

  switch (action.type) {
    case "JOIN_SESSION": {
      const { name, uuid } = action.payload;
      let msg = "";

      const existingPlayer = nextState.players.find((p) => p.uuid === uuid);

      if (existingPlayer) {
        const oldId = existingPlayer.id;
        const newId = peerId;
        // Deep Update References
        nextState = replacePlayerIdInGameState(nextState, oldId, newId);
        // Update Player List
        nextState.players = nextState.players.map((p) =>
          p.uuid === uuid
            ? { ...p, id: newId, isConnected: true, name, lastSeen: Date.now() }
            : p,
        );
      } else {
        // New Join
        const newPlayer: Player = {
          id: peerId,
          uuid: uuid,
          name: name,
          isMod: false,
          isConnected: true,
          joinedAt: Date.now(),
          lastSeen: Date.now(),
        };
        nextState.players = [...nextState.players, newPlayer];

        // Deterministic ID for join message to prevent duplicates during sync patching
        const joinMsgId = `join-${uuid}-${nextState.version}`;
        nextState.messages = [
          ...nextState.messages,
          {
            id: joinMsgId,
            senderId: "system",
            senderUuid: "system",
            senderName: "System",
            content: `${name} joined the session.`,
            timestamp: Date.now(),
            isSystem: true,
          },
        ];
      }
      return nextState;
    }

    case "UPDATE_PLAYER_STATUS": {
      const { playerId, isConnected } = action.payload;
      return {
        ...nextState,
        players: nextState.players.map((p) =>
          p.id === playerId ? { ...p, isConnected } : p,
        ),
      };
    }

    case "JOIN_QUEUE_MATCH": {
      const playerName =
        nextState.players.find((p) => p.id === action.payload.playerId)?.name ||
        "Unknown";
      const availableMatchIndex = nextState.queue.findIndex(
        (q) =>
          q.type === "MATCH" &&
          q.playerIds.length < 2 &&
          !q.playerIds.includes(action.payload.playerId),
      );
      let newQueue = [...nextState.queue];
      let msg = "";

      if (availableMatchIndex !== -1) {
        const entry = newQueue[availableMatchIndex];
        newQueue[availableMatchIndex] = {
          ...entry,
          playerIds: [...entry.playerIds, action.payload.playerId],
        };
        msg = `${playerName} joined the match queue.`;
      } else {
        newQueue.push({
          id: generateUUID(),
          type: "MATCH",
          playerIds: [action.payload.playerId],
          timestamp: Date.now(),
        });
        msg = `${playerName} joined the match queue.`;
      }
      return {
        ...nextState,
        queue: newQueue,
        messages: [...nextState.messages, createSystemMessage(msg)],
      };
    }

    case "JOIN_QUEUE_PARTNER": {
      const p1 =
        nextState.players.find((p) => p.id === action.payload.playerId)?.name ||
        "Unknown";
      const p2 =
        nextState.players.find((p) => p.id === action.payload.partnerId)
          ?.name || "Unknown";
      return {
        ...nextState,
        queue: [
          ...nextState.queue,
          {
            id: generateUUID(),
            type: "PARTNER",
            playerIds: [action.payload.playerId, action.payload.partnerId],
            timestamp: Date.now(),
          },
        ],
        messages: [
          ...nextState.messages,
          createSystemMessage(`${p1} & ${p2} joined the queue.`),
        ],
      };
    }

    case "REQUEST_SOLO": {
      if (nextState.activeVote) return state; // No change, keep old version

      const requesterName = action.payload.playerName;
      const onlinePlayers = nextState.players.filter(
        (p) => p.isConnected,
      ).length;

      // Auto-approve if small group
      if (onlinePlayers <= 4) {
        return {
          ...nextState,
          queue: [
            ...nextState.queue,
            {
              id: generateUUID(),
              type: "SOLO",
              playerIds: [action.payload.playerId],
              timestamp: Date.now(),
            },
          ],
          messages: [
            ...nextState.messages,
            createSystemMessage(
              `${requesterName} joined Solo queue (Auto-approved).`,
            ),
          ],
        };
      }

      const required = Math.ceil(onlinePlayers / 2);
      return {
        ...nextState,
        activeVote: {
          id: generateUUID(),
          requesterId: action.payload.playerId,
          requesterName: requesterName,
          approvals: [],
          required,
          createdAt: Date.now(),
        },
        messages: [
          ...nextState.messages,
          createSystemMessage(`${requesterName} requested Solo play.`),
        ],
      };
    }

    case "CAST_VOTE": {
      if (
        !nextState.activeVote ||
        nextState.activeVote.id !== action.payload.voteId ||
        !action.payload.approve ||
        nextState.activeVote.approvals.includes(action.payload.playerId)
      )
        return state;

      const newApprovals = [
        ...nextState.activeVote.approvals,
        action.payload.playerId,
      ];
      const passed = newApprovals.length >= nextState.activeVote.required;
      let updates: Partial<GameState> = {
        activeVote: passed
          ? null
          : { ...nextState.activeVote, approvals: newApprovals },
      };

      if (passed) {
        updates.queue = [
          ...nextState.queue,
          {
            id: generateUUID(),
            type: "SOLO",
            playerIds: [nextState.activeVote.requesterId],
            timestamp: Date.now(),
          },
        ];
        updates.messages = [
          ...nextState.messages,
          createSystemMessage(
            `Solo request by ${nextState.activeVote.requesterName} passed!`,
          ),
        ];
      }
      return { ...nextState, ...updates };
    }

    case "FINISH_TURN": {
      if (
        !nextState.currentSession ||
        nextState.currentSession.id !== action.payload.sessionId
      )
        return state;

      const newApprovals = [
        ...new Set([...nextState.finishApprovals, action.payload.playerId]),
      ];
      const activePlayers = nextState.currentSession.playerIds.filter(
        (id) => nextState.players.find((p) => p.id === id)?.isConnected,
      );
      const allApproved = activePlayers.every((id) =>
        newApprovals.includes(id),
      );

      if (allApproved || activePlayers.length === 0) {
        const names = nextState.currentSession.playerIds
          .map(
            (id) =>
              nextState.players.find((p) => p.id === id)?.name || "Unknown",
          )
          .join(" & ");
        return {
          ...nextState,
          currentSession: null,
          finishApprovals: [],
          messages: [
            ...nextState.messages,
            createSystemMessage(`${names} finished playing.`),
          ],
        };
      } else {
        return { ...nextState, finishApprovals: newApprovals };
      }
    }

    case "FORCE_FINISH_TURN": {
      if (
        !nextState.currentSession ||
        nextState.currentSession.id !== action.payload.sessionId
      )
        return state;

      return {
        ...nextState,
        currentSession: null,
        finishApprovals: [],
        messages: [
          ...nextState.messages,
          createSystemMessage("Mod forced current turn to finish."),
        ],
      };
    }

    case "LEAVE_QUEUE": {
      const { playerId, queueId } = action.payload;
      const player = nextState.players.find((p) => p.id === playerId);
      const name = player?.name || "Unknown";
      let newQueue: QueueEntry[] = [];
      const messages = [...nextState.messages];
      let didLeave = false;

      nextState.queue.forEach((q) => {
        if (q.id === queueId && q.playerIds.includes(playerId)) {
          didLeave = true;
          const remainingPlayers = q.playerIds.filter((id) => id !== playerId);
          if (remainingPlayers.length === 0) {
            messages.push(createSystemMessage(`${name} left the queue.`));
          } else {
            newQueue.push({
              ...q,
              type: "MATCH", // Revert to MATCH if partner leaves
              playerIds: remainingPlayers,
            });
            messages.push(
              createSystemMessage(
                `${name} left the duo. Entry is now open for matching.`,
              ),
            );
          }
        } else {
          newQueue.push(q);
        }
      });

      if (!didLeave) return state;

      return { ...nextState, queue: newQueue, messages };
    }

    case "KICK_PLAYER": {
      const { playerId, queueId } = action.payload;
      const player = nextState.players.find((p) => p.id === playerId);
      const name = player?.name || "Unknown";
      let newQueue: QueueEntry[] = [];
      const messages = [...nextState.messages];
      let didKick = false;

      nextState.queue.forEach((q) => {
        if (q.id === queueId && q.playerIds.includes(playerId)) {
          didKick = true;
          const remainingPlayers = q.playerIds.filter((id) => id !== playerId);
          if (remainingPlayers.length === 0) {
            messages.push(
              createSystemMessage(`Mod kicked ${name} from the queue.`),
            );
          } else {
            newQueue.push({
              ...q,
              type: "MATCH", // Revert to MATCH if partner is kicked
              playerIds: remainingPlayers,
            });
            messages.push(
              createSystemMessage(`Mod kicked ${name} from the duo.`),
            );
          }
        } else {
          newQueue.push(q);
        }
      });

      if (!didKick) return state;

      return { ...nextState, queue: newQueue, messages };
    }

    case "REMOVE_FROM_QUEUE": {
      const queueEntry = nextState.queue.find(
        (q) => q.id === action.payload.queueId,
      );
      if (queueEntry && queueEntry.playerIds.includes(peerId)) {
        return state;
      }
      return {
        ...nextState,
        queue: nextState.queue.filter((q) => q.id !== action.payload.queueId),
        messages: [
          ...nextState.messages,
          createSystemMessage("Mod removed an entry from the queue."),
        ],
      };
    }

    case "REORDER_QUEUE": {
      const idMap = new Map(nextState.queue.map((q) => [q.id, q]));
      const newQueue = action.payload.queueIds
        .map((id) => idMap.get(id))
        .filter((q): q is QueueEntry => !!q);
      if (newQueue.length === nextState.queue.length) {
        return { ...nextState, queue: newQueue };
      }
      return state;
    }

    case "SEND_CHAT": {
      const sender = nextState.players.find(
        (p) => p.id === action.payload.senderId,
      );
      const realName = sender?.name || action.payload.senderName || "Unknown";
      return {
        ...nextState,
        messages: [
          ...nextState.messages,
          {
            id: action.payload.messageId,
            senderId: action.payload.senderId,
            senderUuid: action.payload.senderUuid,
            senderName: realName,
            senderIsMod: sender?.isMod || false,
            content: action.payload.content,
            timestamp: Date.now(),
            replyToId: action.payload.replyToId,
            type: action.payload.type || "text",
            metadata: action.payload.metadata,
            reactions: {},
          },
        ],
      };
    }

    case "ADD_REACTION": {
      const { messageId, playerId, emoji } = action.payload;
      return {
        ...nextState,
        messages: nextState.messages.map((msg) => {
          if (msg.id !== messageId) return msg;
          const reactions = { ...(msg.reactions || {}) };
          const users = [...(reactions[emoji] || [])];
          if (!users.includes(playerId)) {
            users.push(playerId);
          }
          reactions[emoji] = users;
          return { ...msg, reactions };
        }),
      };
    }

    case "REMOVE_REACTION": {
      const { messageId, playerId, emoji } = action.payload;
      return {
        ...nextState,
        messages: nextState.messages.map((msg) => {
          if (msg.id !== messageId) return msg;
          const reactions = { ...(msg.reactions || {}) };
          if (reactions[emoji]) {
            reactions[emoji] = reactions[emoji].filter((id) => id !== playerId);
            if (reactions[emoji].length === 0) {
              delete reactions[emoji];
            }
          }
          return { ...msg, reactions };
        }),
      };
    }

    case "MOD_DECISION": {
      const { voteId, decision, modName } = action.payload;
      if (!nextState.activeVote || nextState.activeVote.id !== voteId)
        return state;

      const requesterName = nextState.activeVote.requesterName;
      const requesterId = nextState.activeVote.requesterId;

      if (decision === "APPROVE") {
        return {
          ...nextState,
          activeVote: null,
          queue: [
            ...nextState.queue,
            {
              id: generateUUID(),
              type: "SOLO",
              playerIds: [requesterId],
              timestamp: Date.now(),
            },
          ],
          messages: [
            ...nextState.messages,
            createSystemMessage(
              `Mod ${modName} approved Solo request by ${requesterName}.`,
            ),
          ],
        };
      } else {
        return {
          ...nextState,
          activeVote: null,
          messages: [
            ...nextState.messages,
            createSystemMessage(
              `Mod ${modName} rejected Solo request by ${requesterName}.`,
            ),
          ],
        };
      }
    }

    case "TRANSFER_MOD": {
      const { targetId } = action.payload;
      const targetName =
        nextState.players.find((p) => p.id === targetId)?.name || "Unknown";

      // Ensure the new mod is a service peer and remove the old mod if we want to rotate
      // For now, let's just make the new mod the primary service peer
      const otherServicePeers = nextState.servicePeers.filter(
        (id) => id !== peerId && id !== targetId,
      );
      const newServicePeers = [targetId, ...otherServicePeers].slice(0, 3);

      return {
        ...nextState,
        version: state.version + 10, // Bump authority significantly
        players: nextState.players.map((p) => ({
          ...p,
          isMod: p.id === targetId,
        })),
        servicePeers: newServicePeers,
        messages: [
          ...nextState.messages,
          createSystemMessage(`Mod role transferred to ${targetName}.`),
        ],
      };
    }

    default:
      return state;
  }
};

// Final pass to ensure consistency and limits

export const finalizeState = (state: GameState): GameState => {
  // Ensure all lists have unique IDs to prevent React key collisions

  const deduplicate = <T extends { id: string }>(list: T[]): T[] => {
    const seen = new Set();

    return list.filter((item) => {
      if (seen.has(item.id)) return false;

      seen.add(item.id);

      return true;
    });
  };

  const limitedMessages =
    state.messages.length > NETWORK_CONFIG.MAX_CHAT_HISTORY
      ? state.messages.slice(-NETWORK_CONFIG.MAX_CHAT_HISTORY)
      : state.messages;

  return {
    ...state,

    messages: deduplicate(limitedMessages),

    players: deduplicate(state.players),

    queue: deduplicate(state.queue),

    servicePeers: [...new Set(state.servicePeers)], // Unique IDs only
  };
};
