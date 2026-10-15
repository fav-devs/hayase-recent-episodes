(() => {
  if (globalThis.__hayaseRecentEpisodes) return;
  globalThis.__hayaseRecentEpisodes = true;
  let host;
  let dispose;
  let queued = false;
  const dateValue = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  function mount(container, before) {
    host = document.createElement('section');
    host.id = 'hayase-recent-episodes';
    host.setAttribute('aria-label', 'Recent episodes');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host{display:block;padding:20px 16px 8px;color:var(--foreground,CanvasText);font:inherit}
        *{box-sizing:border-box}h2{font-size:18px;line-height:1.3;font-weight:600;margin:0}
        header,.controls,.period{display:flex;align-items:center;gap:8px;flex-wrap:wrap}header{justify-content:space-between;margin-bottom:8px}
        button,select,input{font:inherit;font-size:13px;color:inherit;background:var(--background,Canvas);border:1px solid var(--border,GrayText);border-radius:6px;padding:6px 9px;min-height:34px}
        button{cursor:pointer}button:hover,select:hover{background:var(--accent,ButtonFace)}button:disabled{opacity:.45;cursor:default}
        :focus-visible{outline:2px solid var(--ring,Highlight);outline-offset:3px}
        .period{gap:0;flex-wrap:nowrap;border:1px solid var(--border,GrayText);border-radius:999px;padding:2px}.period button,.period input{border:0;background:transparent;min-height:30px}.period button{border-radius:999px;width:30px;padding:0;font-size:18px}.period input{width:130px;padding:4px 2px;font-size:12px;color-scheme:inherit}.muted,p,footer{color:var(--muted-foreground,GrayText);font-size:12px;line-height:1.6}
        p{margin:8px 0}#status{font-size:12px;color:var(--muted-foreground,GrayText)}#status:empty{display:none}#items{display:flex;gap:12px;overflow-x:auto;padding:4px 3px 12px}.controls{margin:10px 0}.controls label{font-size:12px}summary{cursor:pointer;width:fit-content}footer{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}footer details{flex-basis:100%}
        article{flex:0 0 190px}article a{display:block;color:inherit;text-decoration:none;border:1px solid var(--border,GrayText);border-radius:6px;padding:12px;min-height:124px;background:var(--card,Canvas)}
        article a:hover{background:var(--accent,ButtonFace)}.title{font-weight:600;font-size:14px;line-height:1.4;margin-bottom:9px;display:block}.episode{display:block;font-size:13px}time{display:block;font-size:12px;color:var(--muted-foreground,GrayText);margin-top:4px}
        footer a{color:inherit;text-underline-offset:3px}label{display:flex;align-items:center;gap:6px;font-size:12px}.skeleton{height:124px;width:190px;flex-shrink:0;border-radius:6px;background:var(--muted,ButtonFace)}
      </style>
      <header><h2>Recent episodes</h2><div class="period"><button id="previous" aria-label="Previous period">‹</button><input id="date" type="date" aria-label="Release date"><button id="next" aria-label="Next period">›</button></div></header>
      <div id="status" role="status" aria-live="polite"></div><div id="items" aria-busy="false"></div>
      `;
    const get = id => root.getElementById(id);
    const date = get('date'), items = get('items'), status = get('status');
    const cards = globalThis.hayaseReleaseCards(root, items);
    date.value = dateValue();
    date.max = dateValue();
    let serial = 0;
    let alive = true;
    dispose = () => { alive = false; serial++; cards.destroy(); };

    async function load(refresh = false) {
      const current = ++serial;
      cards.clear();
      const start = new Date(`${date.value}T00:00:00`);
      if (!Number.isFinite(+start) || dateValue(start) !== date.value) { status.textContent = 'Choose a valid date.'; items.replaceChildren(); return; }
      start.setDate(start.getDate() - (start.getDay() + 6) % 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      date.setAttribute('aria-label', 'Choose a week by date');
      get('next').disabled = end > new Date();
      items.setAttribute('aria-busy', 'true');
      items.replaceChildren(...Array.from({ length: 3 }, () => { const placeholder = document.createElement('div'); placeholder.className = 'skeleton'; placeholder.setAttribute('aria-hidden', 'true'); return placeholder; }));
      status.textContent = 'Loading releases…';
      try {
        const data = await chrome.runtime.sendMessage({ type: 'recent-episodes', airType: 'aired', start: +start, end: +end, refresh: refresh === true });
        if (!alive || current !== serial) return;
        if (!data?.ok) throw new Error(data?.error || 'Could not load releases. Retry in a moment.');
        cards.render(data.releases);
        globalThis.hayaseHistoryFor(data.releases).then(history => {
          if (alive && current === serial) cards.setHistory(history);
        }).catch(() => {});
        status.textContent = data.releases.length ? `${data.stale ? 'Showing cached episodes.' : ''}${data.warning ? ' Some details unavailable.' : ''}`.trim() : 'No episodes. Try another date.';
      } catch (error) {
        if (!alive || current !== serial) return;
        items.replaceChildren(); status.textContent = error.message || 'Could not load releases. Try another date.';
      } finally { if (alive && current === serial) items.setAttribute('aria-busy', 'false'); }
    }
    const shift = direction => { const day = new Date(`${date.value}T12:00:00`); day.setDate(day.getDate() + direction * 7); date.value = dateValue(day); load(); };
    get('previous').onclick = () => shift(-1);
    get('next').onclick = () => shift(1);
    date.onchange = () => load();
    container.insertBefore(host, before);
    load();
    const timer = setInterval(() => { date.max = dateValue(); load(); }, 10 * 60 * 1000);
    const previousDispose = dispose;
    dispose = () => { clearInterval(timer); previousDispose(); };
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
  addEventListener('online', () => host?.shadowRoot?.getElementById('date')?.dispatchEvent(new Event('change')));
  schedule();
})();
