// On-device storage. IndexedDB when available, localStorage otherwise.
// Nothing here talks to a network.

const STORES = ['maps', 'parked', 'kv'];

export async function openDB(name = 'whatif-map') {
  try {
    if (!('indexedDB' in globalThis)) throw new Error('IndexedDB unavailable');
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        for (const s of STORES) {
          if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    return idbAdapter(db);
  } catch {
    return lsAdapter(name);
  }
}

function idbAdapter(db) {
  const run = (store, mode, fn) =>
    new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  return {
    kind: 'indexeddb',
    getAll: (store) => run(store, 'readonly', (s) => s.getAll()),
    put: (store, obj) => run(store, 'readwrite', (s) => s.put(obj)),
    del: (store, id) => run(store, 'readwrite', (s) => s.delete(id)),
    clearAll: () =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORES, 'readwrite');
        for (const s of STORES) t.objectStore(s).clear();
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      }),
  };
}

function lsAdapter(name) {
  const key = (store) => `${name}:${store}`;
  const read = (store) => {
    try {
      return JSON.parse(localStorage.getItem(key(store)) || '{}');
    } catch {
      return {};
    }
  };
  const write = (store, data) => localStorage.setItem(key(store), JSON.stringify(data));
  return {
    kind: 'localstorage',
    getAll: async (store) => Object.values(read(store)),
    put: async (store, obj) => {
      const data = read(store);
      data[obj.id] = JSON.parse(JSON.stringify(obj));
      write(store, data);
    },
    del: async (store, id) => {
      const data = read(store);
      delete data[id];
      write(store, data);
    },
    clearAll: async () => STORES.forEach((s) => localStorage.removeItem(key(s))),
  };
}
