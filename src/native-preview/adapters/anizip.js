let last;
export function episodesCached(id) {
  if (last?.id === id) return last.promise;
  const promise = chrome.runtime.sendMessage({ type: 'preview-images', mediaId: id }).then(response => response?.images || null).catch(() => null);
  last = { id, promise };
  return promise;
}
