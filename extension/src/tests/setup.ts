// Mock chrome.storage.local
const storage: Record<string, unknown> = {};
globalThis.chrome = {
  storage: {
    local: {
      get: (keys: string | string[], cb: (result: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(k => { if (k in storage) result[k] = storage[k]; });
        cb(result);
      },
      set: (items: Record<string, unknown>, cb?: () => void) => {
        Object.assign(storage, items);
        cb?.();
      },
      remove: (keys: string | string[], cb?: () => void) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(k => delete storage[k]);
        cb?.();
      },
    },
    onChanged: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
  runtime: {
    id: "test-extension-id",
    sendMessage: (_msg: unknown, cb?: (res: unknown) => void) => { cb?.({}); },
    onMessage: { addListener: () => {}, removeListener: () => {} },
    lastError: null,
  },
  tabs: {
    create: () => {},
    query: (_q: unknown, cb: (tabs: unknown[]) => void) => { cb([]); },
    sendMessage: () => {},
  },
} as unknown as typeof chrome;
