import { writable, derived, get } from 'svelte/store';

export const preferences = writable({ hideSpoilers: false, titleType: 'ANILIST' });
export const records = writable({});
const releases = new Map();
export function configure(release, context = {}) {
  releases.set(release.mediaId, release);
  preferences.set({ ...get(preferences), ...context.settings });
  records.set(context.states || {});
}
export const list = media => derived(records, states => states[media.id]?.status ?? null);
export const progress = media => derived(records, states => states[media.id]?.progress ?? 0);
export const fav = media => !!get(records)[media.id]?.favorite;
export const of = media => derived(progress(media), value => {
  const count = media.episodes || value;
  if (!count || count === 1) return;
  return !value || value === count ? `${count} Episodes` : `${value} / ${count} Episodes`;
});
const action = (id, type) => globalThis.hayaseNativeAction(releases.get(id), type);
export const authAggregator = {
  toggleFav: id => action(id, 'favorite'),
  entry: ({ id }) => action(id, 'bookmark'),
  delete: media => action(media.id, 'bookmark')
};
export const playEp = writable(media => action(media.id, 'play'));
