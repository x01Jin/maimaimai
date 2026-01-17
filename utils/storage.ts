import { GameState } from "../types";
import { STORAGE_CONFIG } from "../constants";

interface UserIdentity {
  uuid: string;
  name: string;
}

export interface RecentSession {
  code: string;
  hostName?: string;
  lastJoined: number;
}

export const generateUUID = (): string => {
  // Fallback for non-secure contexts (HTTP) where crypto.randomUUID is undefined
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if it fails for some reason
    }
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const getIdentity = (): UserIdentity => {
  try {
    const stored = localStorage.getItem(STORAGE_CONFIG.IDENTITY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load identity", e);
  }

  // Generate new
  const newId = {
    uuid: generateUUID(),
    name: "",
  };
  return newId;
};

export const saveIdentity = (name: string, uuid?: string) => {
  const current = getIdentity();
  const data = {
    uuid: uuid || current.uuid,
    name,
  };
  localStorage.setItem(STORAGE_CONFIG.IDENTITY_KEY, JSON.stringify(data));
  return data;
};

export const getRecentSessions = (): RecentSession[] => {
  try {
    const stored = localStorage.getItem(STORAGE_CONFIG.HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const addRecentSession = (code: string) => {
  const history = getRecentSessions();
  // Remove existing if present to move to top
  const filtered = history.filter((h) => h.code !== code);
  const newEntry: RecentSession = {
    code,
    lastJoined: Date.now(),
  };
  const updated = [newEntry, ...filtered].slice(
    0,
    STORAGE_CONFIG.MAX_RECENT_SESSIONS,
  );
  localStorage.setItem(STORAGE_CONFIG.HISTORY_KEY, JSON.stringify(updated));
};

export const removeRecentSession = (code: string) => {
  const history = getRecentSessions();
  const updated = history.filter((h) => h.code !== code);
  localStorage.setItem(STORAGE_CONFIG.HISTORY_KEY, JSON.stringify(updated));
};

// Host State Persistence
export const saveHostState = (code: string, state: GameState) => {
  try {
    localStorage.setItem(
      STORAGE_CONFIG.HOST_STATE_KEY_PREFIX + code,
      JSON.stringify(state),
    );
  } catch (e) {
    console.error("Failed to save host state", e);
  }
};

export const loadHostState = (code: string): GameState | null => {
  try {
    const stored = localStorage.getItem(
      STORAGE_CONFIG.HOST_STATE_KEY_PREFIX + code,
    );
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const clearHostState = (code: string) => {
  localStorage.removeItem(STORAGE_CONFIG.HOST_STATE_KEY_PREFIX + code);
};
