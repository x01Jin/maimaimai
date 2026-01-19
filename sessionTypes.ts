import { GameState, ConnectionStatus } from "./types";

// Session interface for views - compatible with both old and new implementations
export interface SessionAPI {
  status: ConnectionStatus;
  isMod: boolean;
  gameState: GameState;
  myId: string;
  myUuid: string;
  createSession: (
    name: string,
    existingState?: GameState,
    code?: string,
  ) => void;
  joinSession: (code: string, name: string) => void;
  recoverSession: (code: string, name: string) => Promise<void>;
  leaveSession: () => void;
  error: string | null;
  // Queue operations
  joinQueueMatch: (playerId?: string) => void;
  joinQueuePartner: (partnerId: string, playerId?: string) => void;
  requestSolo: (playerId?: string, playerName?: string) => void;
  leaveQueue: (queueId: string) => void;
  removeFromQueue: (queueId: string) => void;
  kickPlayer: (queueId: string, playerId: string) => void;
  reorderQueue: (queueIds: string[]) => void;
  finishTurn: (playerId?: string) => void;
  forceFinishTurn: () => void;
  // Chat operations
  sendMessage: (
    content: string,
    replyToId?: string,
    type?: "text" | "image" | "gif",
    metadata?: any,
  ) => void;
  addReaction: (messageId: string, emoji: string) => void;
  removeReaction: (messageId: string, emoji: string) => void;
  // Voting
  castVote: (approve: boolean) => void;

  modDecision: (voteId: string, decision: "APPROVE" | "REJECT") => void;
  requestModDemotion: (modId: string) => void;
  // Mod operations
  transferMod: (targetId: string) => void;
  resignMod: () => void;
  // Player operations
  addCustomPlayer: (name: string) => string;
  removeCustomPlayer: (playerId: string) => void;
  kickSessionPlayer: (playerId: string, ban?: boolean) => void;
}
