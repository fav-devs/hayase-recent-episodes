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

  function navigate(hash) {
    // Hayase uses SvelteKit's hash router. A real light-DOM link click lets its
    // router load the page; setting location.hash alone can change the URL
    // without rendering the anime page.
    const link = document.createElement('a');
    link.href = `/${hash}`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
  }

  function report(message) {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;max-width:360px';
    const root = host.attachShadow({ mode: 'open' });
    const status = document.createElement('div'); status.setAttribute('role', 'alert'); status.textContent = message;
    status.style.cssText = 'padding:12px 16px;border:1px solid var(--border,GrayText);border-radius:8px;background:var(--background,Canvas);color:var(--foreground,CanvasText);font:13px system-ui';
    root.append(status); document.body.append(host); setTimeout(() => host.remove(), 12000);
  }

  globalThis.hayaseNativeAction = async (release, action = 'play') => {
    if (!['play', 'favorite', 'bookmark'].includes(action)) return;
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
      const latest = action === 'play' ? await chrome.runtime.sendMessage({ type: 'latest-episode', mediaId: release.mediaId }) : { ok: true };
      if (signal.aborted) return;
      if (!latest?.ok) throw new Error(latest?.error || 'Could not find the latest episode.');
      const episode = latest.episode ?? release.episode;
      if (!Number.isInteger(release.mediaId) || release.mediaId < 1 || !Number.isFinite(episode) || episode <= 0) throw new Error('Invalid episode.');
      const titles = new Set([release.title, ...Object.values(release.media?.title ?? {})].filter(value => typeof value === 'string').map(normalize));
      const isPlay = button => /^(Watch Now|Play Now|Continue|Rewatch)$/i.test(button.textContent.trim());
      // Continue Watching uses SmallCard -> PreviewCard -> PlayButton. Reuse that
      // actual instance and its playEp store (including a loaded torrent), rather
      // than routing through an anime detail page when the media is already Home.
      const homeCard = action === 'play' && initialHash === '#/app/home'
        ? [...document.querySelectorAll('.item')].find(item => titles.has(normalize(item.querySelector('.font-black')?.textContent)))?.parentElement
        : null;
      let play;
      if (homeCard) {
        homeCard.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
        play = await waitFor(() => [...homeCard.querySelectorAll('button')].find(isPlay), signal);
        const progress = homeCard.querySelector('.details')?.textContent.match(/(\d+)\s*\/\s*\d+\s*Episodes/i);
        const nextEpisode = /^(Watch Now|Play Now|Rewatch)$/i.test(play.textContent.trim()) ? 1 : progress ? Number(progress[1]) + 1 : null;
        // Never resume an older loaded episode merely because its anime matches.
        if (nextEpisode !== episode) play = null;
      }
      if (!play) {
        navigating = true;
        navigate(target);
        play = await waitFor(() => {
          if (!titles.has(normalize(document.querySelector('h1')?.textContent))) return;
          return [...document.querySelectorAll('button')].find(button => visible(button) && !button.closest('[role="dialog"]') && isPlay(button));
        }, signal);
      }
      if (action !== 'play') {
        const path = action === 'favorite'
          ? 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
          : 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z';
        const scope = play.parentElement?.parentElement;
        const button = [...scope?.querySelectorAll('button') ?? []].find(node => [...node.querySelectorAll('svg path')].some(shape => shape.getAttribute('d') === path));
        if (!button || button.disabled) throw new Error(`Hayase's ${action} control is unavailable.`);
        button.click();
        return;
      }
      play.click();
      const dialog = await waitFor(() => {
        if (location.hash === '#/app/player') return { playing: true };
        return [...document.querySelectorAll('[role="dialog"]')].find(node =>
        visible(node) && node.querySelector('input[type="number"]') && [...node.querySelectorAll('button')].some(button => button.textContent.trim() === 'Auto Select Torrent') &&
        [...node.querySelectorAll('.text-2xl')].some(title => titles.has(normalize(title.textContent))));
      }, signal);
      if (dialog.playing) return;
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
      if (!signal.aborted) {
        if (initialHash === '#/app/home' && location.hash === target) navigate(initialHash);
        report(error.message || 'Could not start playback. Choose the episode in Hayase.');
      }
    } finally {
      removeEventListener('hashchange', cancelOnNavigation);
      removeEventListener('keydown', cancelOnEscape, true);
      if (pending === controller) pending = null;
    }
  };
  globalThis.hayasePlayLatest = release => globalThis.hayaseNativeAction(release, 'play');
})();
