const QUEUE_KEY = "syncQueue";
const CACHED_USER_KEY = "cachedUser";

export const loadSyncQueue = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveSyncQueue = (queue) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const enqueueSync = ({ method, endpoint, body = null, resource, tempId = null }) => {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    method,
    endpoint,
    body,
    resource,
    tempId,
    timestamp: new Date().toISOString(),
  };
  const next = [...loadSyncQueue(), entry];
  saveSyncQueue(next);
  return next;
};

export const cacheUserProfile = (user) => {
  if (!user) return;
  const safe = { id: user.id, username: user.username, role: user.role || "user" };
  localStorage.setItem(CACHED_USER_KEY, JSON.stringify(safe));
};

export const loadCachedUserProfile = () => {
  try {
    const user = JSON.parse(localStorage.getItem(CACHED_USER_KEY) || "null");
    return user?.id && user?.username ? user : null;
  } catch {
    return null;
  }
};

export const clearCachedUserProfile = () => {
  localStorage.removeItem(CACHED_USER_KEY);
};

export const replaySyncQueue = async () => {
  const queue = loadSyncQueue();
  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    try {
      const options = { method: item.method, credentials: "include" };
      if (item.body !== null && item.body !== undefined) {
        options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify(item.body);
      }
      const response = await fetch(item.endpoint, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      const remaining = queue.slice(index);
      saveSyncQueue(remaining);
      return remaining;
    }
  }
  saveSyncQueue([]);
  return [];
};
