export const ID_PREFIX = "mai-q-";

export const COLORS = {
  maimaiPink: "#ff00b3",
  maimaiCyan: "#00ffff",
};

// ICE servers for WebRTC NAT traversal (CGNAT/mobile support)
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.stunprotocol.org" },
  { urls: "stun:stun.voiparound.com" },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

// Y.js configuration
export const YJS_CONFIG = {
  MAX_CHAT_HISTORY: 500,
  // Y.js signaling servers (REQUIRES specialized Yjs signaling protocol)
  // Symptoms of failure: Peers won't see each other, room stays empty.
  SIGNALING_SERVERS: [
    "wss://y-webrtc-eu.fly.dev",
    "wss://y-webrtc.fly.dev",
    "wss://y-webrtc-signaling-eu.herokuapp.com",
    "wss://y-webrtc-signaling-us.herokuapp.com",
    "wss://signaling.yjs.dev",
    "ws://localhost:4444",
  ],
  MAX_CONNECTIONS: 20,
  AWARENESS_UPDATE_INTERVAL: 1000,
  ROOM_PREFIX: "maimaimai-",
} as const;

// Storage Configuration
export const STORAGE_CONFIG = {
  MAX_RECENT_SESSIONS: 10,
  IDENTITY_KEY: "maimaimai_identity",
  HISTORY_KEY: "maimaimai_history",
  ACTIVE_SESSION_KEY: "maimaimai_active_session",
} as const;

// Game Configuration
export const GAME_CONFIG = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 12,
  MAX_SESSION_CODE_LENGTH: 6,
  MAX_MESSAGE_LENGTH: 500,
  AUTO_APPROVE_SOLO_THRESHOLD: 4,
  VOTE_THRESHOLD_RATIO: 0.5,
} as const;
