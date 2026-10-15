export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function periodWindow(value, mode) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid date.');
  const start = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(+start) || localDate(start) !== value) throw new Error('Choose a valid date.');
  if (!['day', 'week'].includes(mode)) throw new Error('Choose a day or week.');
  if (mode === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start);
  end.setDate(end.getDate() + (mode === 'week' ? 7 : 1));
  return { start: +start, end: +end };
}

// The API accepts UTC dates. Cover the complete local interval, including DST changes.
export function apiWindow({ start, end }) {
  const utcStart = new Date(start).toISOString().slice(0, 10);
  const midnight = Date.parse(`${utcStart}T00:00:00Z`);
  return { start: utcStart, days: Math.ceil((end - midnight) / 86400000) };
}

export function selectReleases(rows, airType, window, now = Date.now()) {
  if (!Array.isArray(rows)) throw new Error('The release feed returned an unexpected response.');
  const found = new Map();
  let estimated = 0;
  for (const row of rows) {
    const time = row?.airingAt * 1000;
    if (!row || row.airType !== airType || row.isBreak || !Number.isFinite(time) || row.airingAt == null ||
        time < window.start || time >= window.end || time > now) continue;
    const isEstimate = row.estimated === true || row.exact !== true;
    if (isEstimate) { estimated++; if (airType !== 'sub' || window.includeEstimates !== true) continue; }
    if (!Number.isInteger(row.mediaId) || row.mediaId < 1 || !Number.isFinite(row.episode) || row.episode <= 0 || typeof row.title !== 'string') continue;
    // Delays/breaks do not imply an available episode, even when their timestamp is past.
    if (row.note?.kind === 'delay' || row.note?.kind === 'break') continue;
    const key = `${row.mediaId}:${row.episode}:${airType}`;
    const release = {
      mediaId: row.mediaId, episode: row.episode, airType, time,
      title: row.title.slice(0, 400), estimated: isEstimate,
      media: row.media ?? null, coverImage: row.coverImage ?? null,
      platform: typeof row.platform === 'string' ? row.platform.slice(0, 100) : '',
      href: `/#/app/anime/${row.mediaId}`
    };
    if (!found.has(key) || found.get(key).time < time) found.set(key, release);
  }
  return { releases: [...found.values()].sort((a, b) => b.time - a.time), estimated };
}
