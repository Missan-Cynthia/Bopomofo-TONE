const opening = new Promise((resolve, reject) => {
  const request = indexedDB.open('zhuyin-fire-rescue', 1);
  request.onupgradeneeded = () => {
    for (const store of ['settings', 'recordings', 'audio', 'answers']) request.result.createObjectStore(store);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function read(store, method, key) {
  const db = await opening;
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store)[method](key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function write(stores, action) {
  const db = await opening;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || Error('儲存已中止'));
    action(transaction);
  });
}

export const local = {
  async catalog() { return (await read('settings', 'get', 'catalog')) || []; },
  setCatalog(entries) { return write(['settings'], tx => tx.objectStore('settings').put(entries, 'catalog')); },
  async metadata() { return Object.fromEntries((await read('recordings', 'getAll')).map(row => [row.id, row])); },
  audio(key) { return read('audio', 'get', key); },
  saveAudio(id, role, key, blob) {
    return write(['recordings', 'audio'], tx => {
      const rows = tx.objectStore('recordings');
      const audio = tx.objectStore('audio');
      const current = rows.get(id);
      current.onsuccess = () => {
        const row = current.result || { id };
        if (row[role]) audio.delete(row[role].key);
        audio.put(blob, key);
        rows.put({ ...row, [role]: { key, status: role === 'mother' ? 'ready' : 'pending' } }, id);
      };
    });
  },
  review(id, key, status) {
    return write(['recordings'], tx => {
      const rows = tx.objectStore('recordings');
      const current = rows.get(id);
      current.onsuccess = () => {
        const row = current.result;
        if (row?.brother?.key !== key) return tx.abort();
        rows.put({ ...row, brother: { key, status } }, id);
      };
    });
  },
  saveAnswer(row) { return write(['answers'], tx => tx.objectStore('answers').put(row, row.id)); },
  answers() { return read('answers', 'getAll'); }
};
