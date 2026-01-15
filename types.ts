export interface Player {
  id: string; // The Peer ID (changes on reconnect)
  uuid: string; // Persistent User ID
  name: string;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
}

export type QueueType = 'SOLO' | 'MATCH' | 'PARTNER';

export interface QueueEntry {
  id: string;
  type: QueueType;
  playerIds: string[]; // 1 or 2 IDs
  timestamp: number;
}

export interface Vote {
  id: string;
  requesterId: string;
  requesterName: string;
  approvals: string[]; // List of player IDs who voted YES
  required: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface GameState {
  players: Player[];
  queue: QueueEntry[];
  currentSession: QueueEntry | null;
  messages: ChatMessage[];
  sessionName: string;
  activeVote: Vote | null;
}

// Actions sent from Client to Host
export type ClientAction = 
  | { type: 'JOIN_SESSION'; payload: { name: string; uuid: string } }
  | { type: 'JOIN_QUEUE_MATCH'; payload: { playerId: string } }
  | { type: 'JOIN_QUEUE_PARTNER'; payload: { playerId: string; partnerId: string } }
  | { type: 'REQUEST_SOLO'; payload: { playerId: string; playerName: string } }
  | { type: 'CAST_VOTE'; payload: { voteId: string; playerId: string; approve: boolean } }
  | { type: 'LEAVE_QUEUE'; payload: { playerId: string } } 
  | { type: 'REMOVE_FROM_QUEUE'; payload: { queueId: string } }
  | { type: 'FINISH_TURN'; payload: { sessionId: string } }
  | { type: 'SEND_CHAT'; payload: { content: string; senderId: string; senderName: string } }
  | { type: 'ACCEPT_HOST_MIGRATION'; payload: { newCode: string } }; // Client tells Host "I am ready"

// Message sent from Host to Client
export type HostMessage = 
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'KICK'; payload: { reason: string } }
  | { type: 'PREPARE_MIGRATION'; payload: { state: GameState } } // Host tells Target "Take over"
  | { type: 'REDIRECT'; payload: { newCode: string } }; // Host tells everyone "Go here"

export enum ConnectionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
  MIGRATING = 'MIGRATING'
}