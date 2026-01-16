export const ID_PREFIX = 'mai-q-';

export const COLORS = {
  maimaiPink: '#ff00b3',
  maimaiCyan: '#00ffff',
};

// PeerJS config if needed, passing undefined uses default public cloud
export const PEER_CONFIG = undefined;

// Network Configuration
export const NETWORK_CONFIG = {
  HEARTBEAT_INTERVAL_MS: 2000,
  HOST_TIMEOUT_MS: 6000,
  BEACON_RETRY_ATTEMPTS: 15,
  BEACON_RETRY_DELAY_MS: 1000,
  CONNECTION_RETRY_ATTEMPTS: 3,
  CONNECTION_RETRY_DELAY_MS: 1500,
  CONNECTION_TIMEOUT_MS: 3000,
  REORDER_DEBOUNCE_MS: 500,
  HOST_TRANSFER_GRACE_MS: 5000
} as const;

// Storage Configuration
export const STORAGE_CONFIG = {
  MAX_RECENT_SESSIONS: 10,
  IDENTITY_KEY: 'maimaimai_identity',
  HISTORY_KEY: 'maimaimai_history',
  HOST_STATE_KEY_PREFIX: 'maimaimai_host_state_'
} as const;

// Game Configuration
export const GAME_CONFIG = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 12,
  MAX_SESSION_CODE_LENGTH: 6,
  MAX_MESSAGE_LENGTH: 500,
  AUTO_APPROVE_SOLO_THRESHOLD: 4,
  VOTE_THRESHOLD_RATIO: 0.5
} as const;
