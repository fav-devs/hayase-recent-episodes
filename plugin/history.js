(() => {
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };

  async function localList() {
    if (!globalThis.indexedDB?.databases) return {};
    try {
      if (!(await indexedDB.databases()).some(database => database.name === 'watchlist')) return {};
      return await new Promise(resolve => {
        let database;
        const timer = setTimeout(() => { database?.close(); resolve({}); }, 1500);
        const finish = value => { clearTimeout(timer); database?.close(); resolve(value || {}); };
        const request = indexedDB.open('watchlist');
        request.onupgradeneeded = () => { request.transaction.abort(); finish({}); };
        request.onerror = () => finish({});
        request.onsuccess = () => {
          database = request.result;
          if (!database.objectStoreNames.contains('local')) return finish({});
          const entries = database.transaction('local', 'readonly').objectStore('local').get('entries');
          entries.onsuccess = () => finish(entries.result);
          entries.onerror = () => finish({});
        };
      });
    } catch { return {}; }
  }

  globalThis.hayaseHistoryFor = async releases => {
    const ids = [...new Set(releases.map(release => release.mediaId))];
    const history = {};
    const watched = read('watchProgress') || {};
    for (const id of ids) if (watched[id]?.episode > 0 && watched[id]?.currentTime > 0) history[id] = true;
    const list = await localList();
    for (const id of ids) {
      const entry = list[id]?.mediaListEntry;
      if (entry?.progress > 0 || entry?.status === 'COMPLETED') history[id] = true;
    }
    // Only the public viewer ID is used. The linked account's token is never
    // forwarded, cached, logged, or used in API requests.
    const userId = read('ALViewer')?.viewer?.id;
    if (Number.isInteger(userId) && userId > 0 && ids.length) {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'history-progress', userId, ids });
        if (response?.ok) for (const entry of response.entries) {
          if (ids.includes(entry.mediaId) && (entry.progress > 0 || entry.status === 'COMPLETED')) history[entry.mediaId] = true;
        }
      } catch { /* Local playback/list history remains available offline or for private lists. */ }
    }
    return history;
  };
})();
