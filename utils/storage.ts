interface UserIdentity {
  uuid: string;
  name: string;
}

export interface RecentSession {
  code: string;
  hostName?: string; // Optional if we want to store it
  lastJoined: number;
}

const KEY_IDENTITY = 'maiqueue_identity';
const KEY_HISTORY = 'maiqueue_history';

export const getIdentity = (): UserIdentity => {
  try {
    const stored = localStorage.getItem(KEY_IDENTITY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load identity", e);
  }

  // Generate new
  const newId = {
    uuid: crypto.randomUUID(),
    name: ''
  };
  // Don't save yet until name is set? Or save immediately.
  return newId;
};

export const saveIdentity = (name: string, uuid?: string) => {
  const current = getIdentity();
  const data = {
    uuid: uuid || current.uuid,
    name
  };
  localStorage.setItem(KEY_IDENTITY, JSON.stringify(data));
  return data;
};

export const getRecentSessions = (): RecentSession[] => {
  try {
    const stored = localStorage.getItem(KEY_HISTORY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const addRecentSession = (code: string) => {
  const history = getRecentSessions();
  // Remove existing if present to move to top
  const filtered = history.filter(h => h.code !== code);
  const newEntry: RecentSession = {
    code,
    lastJoined: Date.now()
  };
  const updated = [newEntry, ...filtered].slice(0, 10); // Keep last 10
  localStorage.setItem(KEY_HISTORY, JSON.stringify(updated));
};
