(() => {
  let pending;
  const normalize = text => text?.trim().toLocaleLowerCase();
  const visible = node => node?.isConnected && node.getClientRects().length > 0;

  function waitFor(find, signal, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const finish = (error, result) => { clearTimeout(timer); observer.disconnect(); signal.removeEventListener('abort', abort); error ? reject(error) : resolve(result); };
      const check = () => { const result = find(); if (result) finish(null, result); };
      const abort = () => finish(new DOMException('Playback cancelled', 'AbortError'));
      const observer = new MutationObserver(check);
      const timer = setTimeout(() => finish(new Error('Hayase playback controls did not appear. Choose the episode in Hayase.')), timeout);
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort(); else check();
    });
  }

  function report(message) {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;max-width:360px';
    const root = host.attachShadow({ mode: 'open' });
    const status = document.createElement('div'); status.setAttribute('role', 'alert'); status.textContent = message;
    status.style.cssText = 'padding:12px 16px;border:1px solid var(--border,GrayText);border-radius:8px;background:var(--background,Canvas);color:var(--foreground,CanvasText);font:13px system-ui';
    root.append(status); document.body.append(host); setTimeout(() => host.remove(), 12000);
  }

  globalThis.hayasePlayLatest = async release => {
    pending?.abort();
    const controller = pending = new AbortController();
    const signal = controller.signal;
    const target = `#/app/anime/${release.mediaId}`;
    const initialHash = location.hash;
    let navigating = false;
    const cancelOnNavigation = () => {
      if (navigating ? location.hash.replace(/\/$/, '') !== target : location.hash !== initialHash) controller.abort();
    };
    const cancelOnEscape = event => { if (event.key === 'Escape') controller.abort(); };
    addEventListener('hashchange', cancelOnNavigation);
    addEventListener('keydown', cancelOnEscape, true);
    try {
      const latest = await chrome.runtime.sendMessage({ type: 'latest-episode', mediaId: release.mediaId });
      if (signal.aborted) return;
      if (!latest?.ok) throw new Error(latest?.error || 'Could not find the latest episode.');
      const episode = latest.episode ?? release.episode;
      if (!Number.isInteger(release.mediaId) || release.mediaId < 1 || !Number.isFinite(episode) || episode <= 0) throw new Error('Invalid episode.');
      const titles = new Set([release.title, ...Object.values(release.media?.title ?? {})].filter(value => typeof value === 'string').map(normalize));
      navigating = true;
      location.hash = target;
      const play = await waitFor(() => {
        if (!titles.has(normalize(document.querySelector('h1')?.textContent))) return;
        return [...document.querySelectorAll('button')].find(button => visible(button) && !button.closest('[role="dialog"]') && /^(Watch Now|Play Now|Continue|Rewatch)$/i.test(button.textContent.trim()));
      }, signal);
      play.click();
      const dialog = await waitFor(() => [...document.querySelectorAll('[role="dialog"]')].find(node =>
        visible(node) && node.querySelector('input[type="number"]') && [...node.querySelectorAll('button')].some(button => button.textContent.trim() === 'Auto Select Torrent') &&
        [...node.querySelectorAll('.text-2xl')].some(title => titles.has(normalize(title.textContent)))), signal);
      const input = dialog.querySelector('input[type="number"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(episode));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // Allow Svelte's bound value to replace the source-query promise before
      // invoking Hayase's own ranking/selection action.
      await new Promise(resolve => setTimeout(resolve, 50));
      if (signal.aborted || !visible(dialog)) return;
      const select = [...dialog.querySelectorAll('button')].find(button => button.textContent.trim() === 'Auto Select Torrent');
      if (!select || select.disabled || Number(input.value) !== episode) throw new Error('Could not select the latest episode.');
      navigating = false; // Native selection is now responsible for the player route.
      select.click();
    } catch (error) {
      if (!signal.aborted) report(error.message || 'Could not start playback. Choose the episode in Hayase.');
    } finally {
      removeEventListener('hashchange', cancelOnNavigation);
      removeEventListener('keydown', cancelOnEscape, true);
      if (pending === controller) pending = null;
    }
  };
})();
