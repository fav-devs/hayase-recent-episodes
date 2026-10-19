(() => {
  const key = release => `${release.mediaId}:${release.episode}`;
  const startBefore = end => { const start = new Date(end); start.setDate(start.getDate() - 7); return +start; };
  const todayEnd = now => { const end = new Date(now); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 1); return +end; };
  globalThis.hayaseRecentFeed = (request, now = () => Date.now()) => {
    let cursor = todayEnd(now()), pending, disposed = false;
    let releases = [], hasMore = true;
    function merge(rows) {
      const all = new Map(releases.map(row => [key(row), row]));
      for (const row of rows) all.set(key(row), row);
      releases = [...all.values()].sort((a, b) => b.time - a.time || b.mediaId - a.mediaId || b.episode - a.episode);
    }
    async function fetchWindow(start, end, refresh = false) {
      const data = await request({ type: 'recent-episodes', airType: 'aired', start, end, refresh });
      if (!data?.ok || !Array.isArray(data.releases)) throw new Error(data?.error || 'Could not load episodes.');
      return data;
    }
    function run(operation) {
      if (pending) return pending;
      pending = operation().finally(() => { pending = null; });
      return pending;
    }
    return {
      get releases() { return releases; },
      get busy() { return !!pending; },
      get hasMore() { return hasMore; },
      older() {
        return run(async () => {
          // Skip sparse weeks, but never run an unbounded background crawl.
          for (let empty = 0; empty < 4 && hasMore && !disposed; empty++) {
            const end = cursor, start = startBefore(end);
            const count = releases.length;
            const data = await fetchWindow(start, end);
            if (disposed) return;
            cursor = start; // Failed requests leave the cursor unchanged for retry.
            hasMore = cursor > 0;
            merge(data.releases);
            if (releases.length > count) return data;
          }
        });
      },
      refresh() {
        return run(async () => {
          const end = todayEnd(now());
          const data = await fetchWindow(startBefore(end), end, true);
          if (!disposed) merge(data.releases);
          return data;
        });
      },
      destroy() { disposed = true; }
    };
  };
})();
