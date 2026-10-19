(() => {
  if (globalThis.__hayaseRecentEpisodes) return;
  globalThis.__hayaseRecentEpisodes = true;
  let host;
  let dispose;
  let queued = false;
  function mount(container, before) {
    host = document.createElement('section');
    host.id = 'hayase-recent-episodes';
    host.setAttribute('aria-label', 'Recent episodes');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host{display:block;padding:20px 16px 8px;color:var(--foreground,CanvasText);font:inherit}
        *{box-sizing:border-box}h2{font-size:18px;line-height:1.3;font-weight:600;margin:0 0 8px}
        #items{display:flex;overflow-x:auto}#status{font-size:12px;color:var(--muted-foreground,GrayText)}#status:empty{display:none}
        button{font:inherit;font-size:12px;color:inherit;background:var(--background,Canvas);border:1px solid var(--border,GrayText);border-radius:6px;padding:6px 9px;cursor:pointer}
        :focus-visible{outline:2px solid var(--ring,Highlight);outline-offset:3px}
      </style>
      <h2>Recent episodes</h2><div id="items" aria-busy="false"></div><div id="status" role="status" aria-live="polite"></div>`;
    const items = root.getElementById('items'), status = root.getElementById('status');
    const cards = globalThis.hayaseReleaseCards(root, items);
    const feed = globalThis.hayaseRecentFeed(request => chrome.runtime.sendMessage(request));
    let alive = true, failed = false, contextSerial = 0;
    let context = { history: {}, states: {}, settings: {} };
    let rendered = [];
    function render() {
      const rows = feed.releases;
      // Preserve the visible poster when new episodes are inserted at the front.
      const first = [...items.children].find(node => node.offsetLeft + node.offsetWidth > items.scrollLeft);
      const offset = first ? first.offsetLeft - items.scrollLeft : 0;
      const keepPosition = items.scrollLeft > 0;
      cards.render(rows);
      if (keepPosition && first?.isConnected) items.scrollLeft = first.offsetLeft - offset;
      const known = new Set(rendered.map(row => `${row.mediaId}:${row.episode}`));
      const added = rows.filter(row => !known.has(`${row.mediaId}:${row.episode}`));
      rendered = rows;
      const current = added.length ? ++contextSerial : contextSerial;
      // Read the complete context so concurrent refreshes cannot lose older badges.
      if (added.length) globalThis.hayaseCardContextFor(rows).then(value => {
        if (alive && current === contextSerial) { context = value; cards.setContext(context); }
      }).catch(() => {});
    }
    function action(label, handler) {
      const button = document.createElement('button'); button.textContent = label; button.type = 'button'; button.onclick = handler; status.append(button);
    }
    async function load(refresh = false) {
      if (!alive || feed.busy || (!refresh && !feed.hasMore)) return;
      failed = false;
      items.setAttribute('aria-busy', 'true');
      status.textContent = rendered.length ? '' : 'Loading episodes…';
      const previousCount = rendered.length;
      try {
        await (refresh ? feed.refresh() : feed.older());
        if (!alive) return;
        render();
        status.textContent = '';
        // A bounded empty scan remains manually resumable without endless requests.
        if (feed.hasMore && (!rendered.length || (!refresh && rendered.length === previousCount))) action('Load older episodes', () => load());
        else if (!refresh && feed.hasMore && items.scrollWidth <= items.clientWidth && items.getClientRects().length) queueMicrotask(() => load());
      } catch (error) {
        if (!alive) return;
        failed = true; status.textContent = '';
        if (/extension context invalidated|extension has been (?:updated|reloaded)/i.test(error?.message || '')) action('Reload Hayase', () => location.reload());
        else action('Retry loading episodes', () => load(refresh));
      } finally { if (alive) items.setAttribute('aria-busy', 'false'); }
    }
    const onScroll = () => {
      if (!failed && items.scrollLeft > 0 && items.scrollWidth - items.clientWidth - items.scrollLeft < 368) load();
    };
    items.addEventListener('scroll', onScroll, { passive: true });
    const online = () => { if (alive && failed) load(); };
    addEventListener('online', online);
    container.insertBefore(host, before);
    load();
    const timer = setInterval(() => { if (items.scrollLeft === 0) load(true); }, 10 * 60 * 1000);
    dispose = () => { alive = false; contextSerial++; clearInterval(timer); feed.destroy(); cards.destroy(); removeEventListener('online', online); };
  }

  function reconcile() {
    queued = false;
    if (location.hash.replace(/\/$/, '') !== '#/app/home') { globalThis.hayaseHomeLayout?.destroy(); dispose?.(); host?.remove(); host = null; return; }
    if (host?.isConnected) { globalThis.hayaseHomeLayout?.update(host.parentElement); return; }
    dispose?.();
    // Current upstream Home renders each section heading immediately before a horizontal row.
    // Match structural classes as well as the label to avoid inserting into the sidebar.
    const heading = [...document.querySelectorAll('div.cursor-pointer.text-muted-foreground')].find(node =>
      node.querySelector('.font-semibold.text-lg') && node.nextElementSibling?.classList.contains('overflow-x-scroll'));
    if (heading?.parentElement) { mount(heading.parentElement, heading); globalThis.hayaseHomeLayout?.update(heading.parentElement); }
  }
  const schedule = () => { if (!queued) { queued = true; queueMicrotask(reconcile); } };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('hashchange', reconcile);
  schedule();
})();
