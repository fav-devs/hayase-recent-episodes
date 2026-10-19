(() => {
  const safeImage = value => {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
  };
  const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };


  globalThis.hayaseReleaseCards = (root, items) => {
    const style = document.createElement('style');
    style.textContent = `
      #items{gap:0;padding:0 0 12px;align-items:flex-start;scrollbar-width:none}#items::-webkit-scrollbar{display:none}article.release-card{flex:0 0 11.5rem;min-width:0}
      article.release-card>a{display:flex;flex-direction:column;min-height:323px;border:0;border-radius:0;padding:1rem;background:transparent;color:inherit;text-decoration:none}
      article.release-card>a:hover{background:transparent}article.release-card>a:focus-visible{outline:2px solid var(--ring,Highlight);outline-offset:-3px}
      .release-cover{height:13.5rem;width:9.5rem;border-radius:5px;object-fit:cover;background:var(--muted,ButtonFace)}
      .release-cover-empty{display:flex;align-items:center;justify-content:center;color:var(--muted-foreground,GrayText);font-size:12px}
      .release-card .title{padding-top:.75rem;font-size:.8rem;font-weight:900;line-height:1.4;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .release-card .episode{font-size:.75rem;margin-top:auto;padding-top:.5rem;color:var(--muted-foreground,GrayText)}
      article.release-card>a{position:relative}.history-badge{position:absolute;top:24px;right:24px;display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 6px;border:1px solid var(--border,GrayText);border-radius:6px;background:var(--background,Canvas);color:var(--foreground,CanvasText);font-size:11px;font-weight:600;pointer-events:none}.history-badge svg{width:13px;height:13px}
      .release-preview{position:fixed;z-index:2147483000;width:184px;height:323px;pointer-events:none}
      .release-preview[hidden]{display:none}
    `;
    root.append(style);
    const popup = element('div', 'release-preview'); popup.hidden = true; popup.setAttribute('role', 'region'); popup.setAttribute('aria-label', 'Anime preview'); root.append(popup);
    let timer, active, nativePreview;
    let pressed = false, dragged = false, x = 0, y = 0, deltaX = 0, deltaY = 0, blockedUntil = 0;
    let previewContext = {};
    let history = {};
    let current = [];
    function badges() {
      for (const [index, release] of current.entries()) {
        const link = items.children[index]?.querySelector('a');
        if (!link) continue;
        link.querySelector('.history-badge')?.remove();
        if (!history[release.mediaId]) continue;
        const badge = element('span', 'history-badge');
        badge.setAttribute('aria-label', `In watch history, episode ${release.episode} released`);
        badge.title = `In history · Episode ${release.episode}`;
        badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7M12 7v5l3 2"/></svg>';
        badge.append(document.createTextNode(String(release.episode))); link.append(badge);
      }
    }
    const hide = () => { clearTimeout(timer); popup.hidden = true; active?.setAttribute('aria-expanded', 'false'); active = null; nativePreview?.destroy(); nativePreview = null; popup.replaceChildren(); };
    const later = () => { clearTimeout(timer); timer = setTimeout(() => { if (!popup.contains(root.activeElement) && root.activeElement !== active) hide(); }, 160); };
    const image = (url, className, alt) => {
      const source = safeImage(url);
      if (!source) return element('div', `${className} release-cover-empty`, 'No image');
      const node = element('img', className); node.src = source; node.alt = alt; node.loading = 'lazy'; node.referrerPolicy = 'no-referrer';
      node.onerror = () => node.replaceWith(element('div', `${className} release-cover-empty`, 'Image unavailable'));
      return node;
    };
    function position(anchor) {
      const rect = anchor.getBoundingClientRect();
      const card = nativePreview?.root.querySelector('.absolute-container');
      const width = card ? parseFloat(getComputedStyle(card).width) : 280;
      const height = card ? parseFloat(getComputedStyle(card).height) : 320;
      const offset = (card ? parseFloat(getComputedStyle(card).left) : rect.width / 2) - width / 2;
      popup.style.width = `${rect.width}px`;
      popup.style.left = `${Math.max(8 - offset, Math.min(rect.left, innerWidth - width - offset - 8))}px`;
      popup.style.top = `${Math.max(8, Math.min(rect.top, innerHeight - height - 8))}px`;
    }
    function preview(release, anchor) {
      clearTimeout(timer);
      if (pressed || Date.now() < blockedUntil) return;
      if (active === anchor && !popup.hidden) return;
      hide(); active = anchor; anchor.setAttribute('aria-expanded', 'true');
      const target = document.createElement('div'); popup.append(target); popup.hidden = false;
      nativePreview = globalThis.HayaseNativePreview.create(target, release, { ...previewContext, first: anchor.parentElement === items.firstElementChild });
      position(anchor);
    }
    popup.onclick = event => {
      if (!event.composedPath().some(node => node?.tagName === 'BUTTON' || node?.getAttribute?.('role') === 'button') && active) active.click();
    };
    popup.onpointerenter = () => clearTimeout(timer);
    popup.onpointerleave = later;
    popup.onfocusout = later;
    const escape = event => {
      if (event.key === 'Escape') { const anchor = active; const hadFocus = popup.contains(root.activeElement); hide(); if (hadFocus) anchor?.focus(); hide(); }
      if (event.key === 'Tab' && !event.shiftKey && root.activeElement === active && nativePreview) {
        const button = nativePreview.root.querySelector('button');
        if (button) { event.preventDefault(); button.focus(); }
      }
    };
    root.addEventListener('keydown', escape);
    const onScroll = () => {
      blockedUntil = Date.now() + 160;
      if (!pressed && active && (root.activeElement === active || popup.contains(root.activeElement))) position(active);
      else hide();
    };
    // Same mouse deltas and 15px drag threshold as Hayase's dragScroll action.
    // The fixed preview is outside #items, so listen on its shadow root as well.
    const dragEvents = new AbortController();
    const options = { signal: dragEvents.signal };
    root.addEventListener('mousedown', event => {
      if (event.button !== 0 || event.buttons !== 1 || !event.composedPath().some(node => node === items || node === popup)) return;
      pressed = true; dragged = false; deltaX = deltaY = 0; x = event.clientX; y = event.clientY;
      clearTimeout(timer);
    }, options);
    root.addEventListener('mousemove', event => {
      if (!pressed) return;
      deltaX += Math.abs(event.clientX - x); deltaY += Math.abs(event.clientY - y);
      items.scrollBy(x - event.clientX, y - event.clientY);
      x = event.clientX; y = event.clientY;
      if (deltaX > 15 || deltaY > 15) {
        dragged = true; hide(); event.preventDefault();
        event.target.dispatchEvent(new MouseEvent('drag', { bubbles: true }));
      }
    }, options);
    root.addEventListener('click', event => {
      if (dragged && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
      pressed = false;
    }, { ...options, capture: true });
    root.addEventListener('dragstart', event => event.preventDefault(), options);
    items.addEventListener('wheel', onScroll, { ...options, passive: true });
    root.addEventListener('mouseleave', () => { pressed = false; }, options);
    addEventListener('mouseup', () => { pressed = false; }, options);
    items.addEventListener('scroll', onScroll);
    addEventListener('resize', onScroll);
    addEventListener('scroll', onScroll, true);
    return {
      render(releases) {
        const existing = new Map(current.map((release, index) => [`${release.mediaId}:${release.episode}`, items.children[index]]));
        current = releases;
        const wanted = new Set();
        for (const [index, release] of releases.entries()) {
          const key = `${release.mediaId}:${release.episode}`;
          let previous = existing.get(key);
          if (previous) {
            wanted.add(previous);
            if (items.children[index] !== previous) items.insertBefore(previous, items.children[index] || null);
            continue;
          }
          const media = release.media ?? {};
          const article = element('article', 'release-card');
          const link = element('a'); link.href = `/#/app/anime/${release.mediaId}`; link.setAttribute('aria-expanded', 'false');
          link.append(image(media.coverImage?.large || media.coverImage?.extraLarge || release.coverImage, 'release-cover', `${release.title} cover`));
          link.append(element('span', 'title', release.title));
          link.append(element('span', 'episode', `Ep ${release.episode}${release.estimated ? ' · Estimated' : ''}`));
          link.onpointerenter = event => {
            if (pressed || event.buttons || Date.now() < blockedUntil) return;
            // Keep a keyboard user's focused preview from being replaced by a
            // stationary pointer when focus scrolls another poster underneath it.
            if (root.activeElement?.closest('article.release-card') && root.activeElement !== link) return;
            clearTimeout(timer); timer = setTimeout(() => preview(release, link), 30);
          };
          link.onpointermove = event => {
            if (pressed || event.buttons || Date.now() < blockedUntil || (!event.movementX && !event.movementY)) return;
            if (active !== link) { clearTimeout(timer); timer = setTimeout(() => preview(release, link), 30); }
          };
          link.onpointerleave = later;
          link.onfocus = () => preview(release, link);
          link.onblur = later;
          article.append(link); items.insertBefore(article, items.children[index] || null); wanted.add(article);
        }
        for (const node of [...items.children]) if (!wanted.has(node)) { if (node.contains(active)) hide(); node.remove(); }
        badges();
      },
      setHistory(value) { history = value; badges(); },
      setContext(value) { previewContext = value; history = value.history || {}; badges(); nativePreview?.update(value); },
      clear: hide,
      destroy() { dragEvents.abort(); hide(); popup.remove(); style.remove(); root.removeEventListener('keydown', escape); items.removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); removeEventListener('scroll', onScroll, true); }
    };
  };
})();
