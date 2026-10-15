import { apiWindow, selectReleases } from './releases.mjs';
import { airingRows, enrichRows, graphql, historyProgress, favoriteIds } from './anilist.mjs';

const pending = new Map();
const TTL = 10 * 60 * 1000;

export async function loadReleases(request) {
  if (!['aired', 'sub', 'dub'].includes(request.airType) || !Number.isFinite(request.start) || !Number.isFinite(request.end) ||
      request.end <= request.start || request.end - request.start > 8 * 86400000 ||
      Math.abs(request.start) > 8e15 || Math.abs(request.end) > 8e15) throw new Error('Invalid release period.');
  const window = request.airType === 'aired' ? { start: request.start, end: request.end } : apiWindow(request);
  const key = `feed:v3:${request.airType}:${JSON.stringify(window)}`;
  const stored = (await chrome.storage.local.get(key))[key];
  if (!request.refresh && stored && Date.now() - stored.saved < TTL) return { ...selectReleases(stored.rows, request.airType, request), stale: false, warning: stored.warning };
  if (!pending.has(key)) {
    pending.set(key, (async () => {
      try {
        let rows, warning = '';
        if (request.airType === 'aired') rows = await airingRows(request);
        else {
        const url = new URL('https://tsuzuki.top/api/v1/schedule');
        url.search = new URLSearchParams({ ...window, airType: request.airType }).toString();
        const response = await fetch(url, { signal: AbortSignal.timeout(15000), credentials: 'omit' });
        if (!response.ok) {
          if (response.status === 429) throw new Error('The release feed is busy. Wait a minute before retrying.');
          throw new Error(`The release feed is unavailable (${response.status}). Try again later.`);
        }
        const data = await response.json();
        if (data.ok !== true || !Array.isArray(data.episodes)) throw new Error('The release feed returned an unexpected response.');
        rows = data.episodes;
        try { rows = await enrichRows(rows); } catch { warning = 'AniList card details could not be loaded. Release data is still shown.'; }
        }
        // Prune old periods so browsing history does not grow storage indefinitely.
        const cache = await chrome.storage.local.get(null);
        const old = Object.entries(cache).filter(([name]) => name.startsWith('feed:')).sort((a, b) => b[1].saved - a[1].saved).slice(19).map(([name]) => name);
        if (old.length) await chrome.storage.local.remove(old);
        await chrome.storage.local.set({ [key]: { saved: Date.now(), rows, warning } });
        return { rows, warning };
      } finally { pending.delete(key); }
    })());
  }
  try {
    const result = await pending.get(key);
    return { ...selectReleases(result.rows, request.airType, request), stale: false, warning: result.warning };
  } catch (error) {
    if (stored && Array.isArray(stored.rows)) return { ...selectReleases(stored.rows, request.airType, request), stale: true, saved: stored.saved };
    if (error.name === 'TimeoutError' || error instanceof TypeError) throw new Error('Could not reach the release feed. Check your connection and retry.');
    throw error;
  }
}

chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (!['recent-episodes', 'latest-episode', 'history-progress'].includes(request?.type)) return;
  if (!sender.url?.startsWith('https://hayase.app/') || sender.id !== chrome.runtime.id) return;
  if (request.type === 'history-progress') {
    historyProgress(request.userId, request.ids).then(async entries => {
      const favorites = await favoriteIds(request.userId).catch(() => null);
      respond({ ok: true, entries, favorites });
    }, () => respond({ ok: false }));
    return true;
  }
  if (request.type === 'latest-episode') {
    if (!Number.isInteger(request.mediaId) || request.mediaId <= 0) { respond({ ok: false, error: 'Invalid anime.' }); return; }
    graphql(`query LatestEpisode($id:Int,$now:Int) { Page(perPage:1) {
      airingSchedules(mediaId:$id,airingAt_lesser:$now,sort:TIME_DESC) { episode }
    } }`, { id: request.mediaId, now: Math.floor(Date.now() / 1000) }).then(data => {
      const episode = data.Page?.airingSchedules?.[0]?.episode;
      respond({ ok: true, episode: Number.isFinite(episode) && episode > 0 ? episode : null });
    }, error => respond({ ok: false, error: error.message }));
    return true;
  }
  loadReleases(request).then(data => respond({ ok: true, ...data }), error => respond({ ok: false, error: error.message }));
  return true;
});
