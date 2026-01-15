
import { GameState, ClientAction, Player, QueueEntry, ChatMessage, Vote } from '../types';
import { generateUUID } from './storage';

export const INITIAL_STATE: GameState = {
    players: [],
    queue: [],
    currentSession: null,
    finishApprovals: [],
    messages: [],
    sessionName: '',
    activeVote: null,
};

export const createSystemMessage = (content: string): ChatMessage => ({
    id: generateUUID(),
    senderId: 'system',
    senderUuid: 'system',
    senderName: 'System',
    content,
    timestamp: Date.now(),
    isSystem: true
});

// Helper for deep ID replacement
export const replacePlayerIdInGameState = (state: GameState, oldId: string, newId: string): GameState => {
    const replaceIds = (ids: string[]) => ids.map(id => id === oldId ? newId : id);

    return {
        ...state,
        queue: state.queue.map(q => ({
            ...q,
            playerIds: replaceIds(q.playerIds)
        })),
        currentSession: state.currentSession ? {
            ...state.currentSession,
            playerIds: replaceIds(state.currentSession.playerIds)
        } : null,
        finishApprovals: replaceIds(state.finishApprovals),
        activeVote: state.activeVote ? {
            ...state.activeVote,
            requesterId: state.activeVote.requesterId === oldId ? newId : state.activeVote.requesterId,
            approvals: replaceIds(state.activeVote.approvals)
        } : null
    };
};

export const processQueueState = (state: GameState): GameState => {
    let newState = { ...state };

    if (!newState.currentSession && newState.queue.length > 0) {
        const next = newState.queue[0];

        // MATCH wait logic: If it's a MATCH type, wait until there are 2 players
        if (next.type === 'MATCH' && next.playerIds.length < 2) {
            return newState;
        }

        newState.currentSession = next;
        newState.finishApprovals = [];
        newState.queue = newState.queue.slice(1);

        const names = next.playerIds.map(id => newState.players.find(p => p.id === id)?.name || 'Unknown');
        const systemMsg = createSystemMessage(`Now Playing: ${names.join(' & ')}`);
        newState.messages = [...newState.messages, systemMsg];
    }
    return newState;
};

// Returns new state based on action
export const gameReducer = (state: GameState, action: ClientAction, peerId: string): GameState => {
    switch (action.type) {
        case 'JOIN_SESSION': {
            const { name, uuid } = action.payload;
            let newState = { ...state };
            let msg = '';

            const existingPlayer = state.players.find(p => p.uuid === uuid);

            if (existingPlayer) {
                const oldId = existingPlayer.id;
                const newId = peerId;
                // Deep Update References
                newState = replacePlayerIdInGameState(state, oldId, newId);
                // Update Player List
                newState.players = newState.players.map(p =>
                    p.uuid === uuid
                        ? { ...p, id: newId, isConnected: true, name }
                        : p
                );
            } else {
                // New Join
                const newPlayer: Player = {
                    id: peerId,
                    uuid: uuid,
                    name: name,
                    isHost: false,
                    isConnected: true,
                    joinedAt: Date.now(),
                };
                newState.players = [...state.players, newPlayer];
                msg = `${name} joined the session.`;
            }

            if (msg) {
                newState.messages = [...newState.messages, createSystemMessage(msg)];
            }
            return newState;
        }

        case 'JOIN_QUEUE_MATCH': {
            const playerName = state.players.find(p => p.id === action.payload.playerId)?.name || 'Unknown';
            const availableMatchIndex = state.queue.findIndex(q =>
                q.type === 'MATCH' &&
                q.playerIds.length < 2 &&
                !q.playerIds.includes(action.payload.playerId)
            );
            let newQueue = [...state.queue];
            let msg = '';

            if (availableMatchIndex !== -1) {
                const entry = newQueue[availableMatchIndex];
                newQueue[availableMatchIndex] = { ...entry, playerIds: [...entry.playerIds, action.payload.playerId] };
                msg = `${playerName} joined the match queue.`;
            } else {
                newQueue.push({
                    id: generateUUID(),
                    type: 'MATCH',
                    playerIds: [action.payload.playerId],
                    timestamp: Date.now()
                });
                msg = `${playerName} joined the match queue.`;
            }
            return {
                ...state,
                queue: newQueue,
                messages: [...state.messages, createSystemMessage(msg)]
            };
        }

        case 'JOIN_QUEUE_PARTNER': {
            const p1 = state.players.find(p => p.id === action.payload.playerId)?.name || 'Unknown';
            const p2 = state.players.find(p => p.id === action.payload.partnerId)?.name || 'Unknown';
            return {
                ...state,
                queue: [...state.queue, {
                    id: generateUUID(),
                    type: 'PARTNER',
                    playerIds: [action.payload.playerId, action.payload.partnerId],
                    timestamp: Date.now()
                }],
                messages: [...state.messages, createSystemMessage(`${p1} & ${p2} joined the queue.`)]
            };
        }

        case 'REQUEST_SOLO': {
            if (state.activeVote) return state;

            const requester = state.players.find(p => p.id === action.payload.playerId)?.name || 'Unknown';
            const onlinePlayers = state.players.filter(p => p.isConnected).length;

            // Auto-approve if small group
            if (onlinePlayers <= 4) {
                return {
                    ...state,
                    queue: [...state.queue, {
                        id: generateUUID(),
                        type: 'SOLO',
                        playerIds: [action.payload.playerId],
                        timestamp: Date.now()
                    }],
                    messages: [...state.messages, createSystemMessage(`${requester} joined Solo queue (Auto-approved).`)]
                };
            }

            const required = Math.ceil(onlinePlayers / 2);
            return {
                ...state,
                activeVote: {
                    id: generateUUID(),
                    requesterId: action.payload.playerId,
                    requesterName: action.payload.playerName || requester,
                    approvals: [],
                    required,
                    createdAt: Date.now()
                },
                messages: [...state.messages, createSystemMessage(`${requester} requested Solo play.`)]
            };
        }

        case 'CAST_VOTE': {
            if (!state.activeVote || state.activeVote.id !== action.payload.voteId || !action.payload.approve || state.activeVote.approvals.includes(action.payload.playerId)) return state;

            const newApprovals = [...state.activeVote.approvals, action.payload.playerId];
            const passed = newApprovals.length >= state.activeVote.required;
            let updates: Partial<GameState> = { activeVote: passed ? null : { ...state.activeVote, approvals: newApprovals } };

            if (passed) {
                updates.queue = [...state.queue, {
                    id: generateUUID(),
                    type: 'SOLO',
                    playerIds: [state.activeVote.requesterId],
                    timestamp: Date.now()
                }];
                updates.messages = [...state.messages, createSystemMessage(`Solo request by ${state.activeVote.requesterName} passed!`)];
            }
            return { ...state, ...updates };
        }

        case 'FINISH_TURN': {
            if (!state.currentSession || state.currentSession.id !== action.payload.sessionId) return state;

            const newApprovals = [...new Set([...state.finishApprovals, action.payload.playerId])];
            const activePlayers = state.currentSession.playerIds.filter(id =>
                state.players.find(p => p.id === id)?.isConnected
            );
            const allApproved = activePlayers.every(id => newApprovals.includes(id));

            if (allApproved || activePlayers.length === 0) {
                const names = state.currentSession.playerIds.map(id => state.players.find(p => p.id === id)?.name || 'Unknown').join(' & ');
                return {
                    ...state,
                    currentSession: null,
                    finishApprovals: [],
                    messages: [...state.messages, createSystemMessage(`${names} finished playing.`)]
                };
            } else {
                return { ...state, finishApprovals: newApprovals };
            }
        }

        case 'LEAVE_QUEUE': {
            const { playerId, queueId } = action.payload;
            const player = state.players.find(p => p.id === playerId);
            const name = player?.name || 'Unknown';
            let newQueue: QueueEntry[] = [];
            const messages = [...state.messages];
            let didLeave = false;

            state.queue.forEach(q => {
                // If queueId is specified, only modify that entry.
                // We check if the player is actually in that entry.
                if (q.id === queueId && q.playerIds.includes(playerId)) {
                    didLeave = true;
                    const remainingPlayers = q.playerIds.filter(id => id !== playerId);
                    if (remainingPlayers.length === 0) {
                        messages.push(createSystemMessage(`${name} left the queue.`));
                    } else {
                        newQueue.push({
                            ...q,
                            type: 'MATCH', // Revert to MATCH if partner leaves
                            playerIds: remainingPlayers
                        });
                        messages.push(createSystemMessage(`${name} left the duo. Entry is now open for matching.`));
                    }
                } else {
                    newQueue.push(q);
                }
            });

            if (!didLeave) return state; // No changes needed if player wasn't found in target queue

            return { ...state, queue: newQueue, messages };
        }

        case 'REMOVE_FROM_QUEUE':
            return {
                ...state,
                queue: state.queue.filter(q => q.id !== action.payload.queueId),
                messages: [...state.messages, createSystemMessage('Host removed an entry from the queue.')]
            };

        case 'REORDER_QUEUE': {
            const idMap = new Map(state.queue.map(q => [q.id, q]));
            const newQueue = action.payload.queueIds.map(id => idMap.get(id)).filter((q): q is QueueEntry => !!q);
            if (newQueue.length === state.queue.length) {
                return { ...state, queue: newQueue };
            }
            return state;
        }

        case 'SEND_CHAT': {
            const sender = state.players.find(p => p.id === action.payload.senderId);
            const realName = sender?.name || action.payload.senderName || 'Unknown';
            return {
                ...state,
                messages: [...state.messages, {
                    id: generateUUID(),
                    senderId: action.payload.senderId,
                    senderUuid: action.payload.senderUuid,
                    senderName: realName,
                    content: action.payload.content,
                    timestamp: Date.now()
                }]
            };
        }

        default:
            return state;
    }
};
