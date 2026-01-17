export interface Player {
  id: string; // The Peer ID (changes on reconnect)

  uuid: string; // Persistent User ID

  name: string;

  isMod: boolean;

  isConnected: boolean;

  joinedAt: number;

  lastSeen?: number; // For heartbeat tracking

  quality?: {
    latency: number;
    jitter: number;
    packetLoss: number;
    score: number;
  };
}

export type QueueType = "SOLO" | "MATCH" | "PARTNER";

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

  senderId: string; // Peer ID

  senderUuid?: string; // Persistent UUID

  senderName: string;

  content: string;

  timestamp: number;

  isSystem?: boolean;
}

export interface GameState {
  players: Player[];

  queue: QueueEntry[];

  currentSession: QueueEntry | null;

  finishApprovals: string[]; // List of players in current session who confirmed finish

  messages: ChatMessage[];

  sessionName: string;

  activeVote: Vote | null;

  version: number; // State version for synchronization

  servicePeers: string[]; // List of Peer IDs with authority

  stateHash: string; // For optimizing sync
}

export interface AppNotification {
  id: string;

  message: string;

  type: "info" | "success" | "warning" | "error";

  duration?: number;
}

// Client Actions (Intentions from UI)

export type ClientAction =
  | { type: "JOIN_SESSION"; payload: { name: string; uuid: string } } // Used internally on connect
  | { type: "JOIN_QUEUE_MATCH"; payload: { playerId: string } }
  | {
      type: "JOIN_QUEUE_PARTNER";
      payload: { playerId: string; partnerId: string };
    }
  | { type: "REQUEST_SOLO"; payload: { playerId: string; playerName: string } }
  | {
      type: "CAST_VOTE";
      payload: { voteId: string; playerId: string; approve: boolean };
    }
  | { type: "LEAVE_QUEUE"; payload: { playerId: string; queueId: string } }
  | { type: "REMOVE_FROM_QUEUE"; payload: { queueId: string } }
  | { type: "KICK_PLAYER"; payload: { playerId: string; queueId: string } }
  | { type: "REORDER_QUEUE"; payload: { queueIds: string[] } }
  | { type: "FINISH_TURN"; payload: { sessionId: string; playerId: string } }
  | { type: "FORCE_FINISH_TURN"; payload: { sessionId: string } }
  | {
      type: "SEND_CHAT";
      payload: {
        content: string;
        senderId: string;
        senderUuid: string;
        senderName: string;
        messageId: string;
      };
    }
  | {
      type: "UPDATE_PLAYER_STATUS";
      payload: { playerId: string; isConnected: boolean };
    }
  | { type: "TRANSFER_MOD"; payload: { targetId: string } };

// Internal P2P Protocol Messages

export type P2PMessage =
  | { type: "HELLO"; payload: { player: Player } } // Initial handshake
  | { type: "PEER_DISCOVERY"; payload: { peers: Player[] } } // Sharing known peers
  | {
      type: "SYNC_STATE";
      payload: {
        state: GameState;
        stateHash: string;
        lastAction?: ClientAction;
      };
    } // Host broadcasting state
  | { type: "ACTION"; payload: { action: ClientAction; from: string } } // Forwarding user intent to host
  | { type: "CLAIM_HOST"; payload: { newHostId: string; sessionCode: string } } // Election result
  | {
      type: "HEARTBEAT";
      payload: { id: string; timestamp: number; sequence: number };
    } // Keep-alive
  | { type: "PONG"; payload: { originalTimestamp: number; sequence: number } }
  | { type: "TRANSFER_MOD"; payload: { newModId: string; state?: GameState } };

export enum ConnectionStatus {
  IDLE = "IDLE",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  ERROR = "ERROR",
  MIGRATING = "MIGRATING",
  RECONNECTING = "RECONNECTING",
}

// PeerJS Type Definitions
export interface DataConnection {
  peer: string;
  open: boolean;
  send: (data: any) => void;
  on: (event: string, handler: (data?: any) => void) => void;
  off: (event: string, handler: (data?: any) => void) => void;
  close: () => void;
}

export interface PeerError {
  type: string;
  message?: string;
}

export interface PeerInstance {
  id: string;
  connect: (id: string, options?: { reliable?: boolean }) => DataConnection;
  on: (event: string, handler: (data?: any) => void) => void;
  destroy: () => void;
}
