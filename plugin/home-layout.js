(() => {
  const KEY = 'home-layout-v1';
  const RECENT = 'plugin:recent-episodes';
  const DEFAULT = [RECENT, ...['Continue Watching', 'Your List', 'Sequels You Missed', 'Popular This Season', 'Trending Now', 'All Time Popular', 'Romance', 'Action', 'Adventure', 'Fantasy'].map(title => `hayase:${title}`)];
  let saved = { order: [], hidden: [] };
  let ready = false;
  let session;
  let writes = Promise.resolve();
  let storageError = '';

  const valid = value => ({
    order: Array.isArray(value?.order) ? [...new Set(value.order.filter(id => typeof id === 'string').slice(0, 200))] : [],
    hidden: Array.isArray(value?.hidden) ? [...new Set(value.hidden.filter(id => typeof id === 'string').slice(0, 200))] : []
  });
  chrome.storage.local.get(KEY).then(result => { saved = valid(result[KEY]); }, () => {
    storageError = 'Saved layout could not be loaded. Changes will apply to this session.';
  }).finally(() => { ready = true; session?.update(); });

  function persist() {
    const value = { order: [...saved.order], hidden: [...saved.hidden] };
    writes = writes.catch(() => {}).then(() => chrome.storage.local.set({ [KEY]: value })).then(() => {
      storageError = ''; session?.status('Layout saved.');
    }, () => {
      storageError = 'Could not save the layout. Your changes apply to this session; try another change to save again.';
      session?.status(storageError);
    });
  }

  function create(container) {
    const editor = document.createElement('section');
    editor.id = 'hayase-home-layout';
    const root = editor.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{position:fixed;top:48px;right:24px;z-index:100;color:var(--foreground,CanvasText);font:inherit}*{box-sizing:border-box}
      dialog{position:fixed;inset:0;margin:auto;width:min(560px,calc(100vw - 32px));max-height:calc(100dvh - 48px);overflow:auto;padding:24px;border:1px solid var(--border,GrayText);border-radius:12px;background:var(--background,Canvas);color:inherit;font:inherit;box-shadow:0 24px 80px rgb(0 0 0 / .4)}dialog::backdrop{background:rgb(0 0 0 / .6)}
      .modal-header,.modal-footer{display:flex;align-items:center;justify-content:space-between;gap:12px}h2{font-size:20px;margin:0;font-weight:600}h3{font-size:14px;margin:0 0 10px}.modal-footer{margin-top:18px}.close{font-size:20px;line-height:1;padding:4px 8px}#open{display:flex;align-items:center;gap:7px;background:var(--background,Canvas)}#open svg{width:15px;height:15px}
      p{color:var(--muted-foreground,GrayText);font-size:12px;line-height:1.5;margin:10px 0}ul{list-style:none;margin:8px 0;padding:0;max-width:620px}
      li{display:flex;align-items:center;gap:8px;padding:6px 0;min-width:0}label{display:flex;align-items:center;gap:8px;flex:1;min-width:0;font-size:13px;overflow-wrap:anywhere}
      button{font:inherit;font-size:12px;color:inherit;background:var(--background,Canvas);border:1px solid var(--border,GrayText);border-radius:6px;padding:6px 9px;min-height:32px;cursor:pointer}
      button:hover{background:var(--accent,ButtonFace)}button:disabled{opacity:.4;cursor:default}:focus-visible{outline:2px solid var(--ring,Highlight);outline-offset:3px}input{accent-color:var(--primary,Highlight);width:16px;height:16px;flex-shrink:0}
      #status{font-size:12px;color:var(--muted-foreground,GrayText);min-height:18px;margin-top:8px}
      @media(max-width:480px){:host{right:16px}dialog{padding:18px}li{flex-wrap:wrap}li label{flex-basis:100%}}
    </style><button id="open" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 7h16M4 17h16M9 4v6M15 14v6"/></svg>Customize</button><dialog aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">Customize Home</h2><button id="close" class="close" aria-label="Close customization">×</button></div><ul aria-label="Home sections"></ul><div id="status" role="status" aria-live="polite"></div><div class="modal-footer"><button id="reset">Reset layout</button><button id="done">Done</button></div></dialog>`;
    const dialog = root.querySelector('dialog');
    const opener = root.getElementById('open');
    opener.onclick = () => dialog.showModal();
    root.getElementById('close').onclick = root.getElementById('done').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { if (editor.isConnected) opener.focus(); });
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    const style = document.createElement('style');
    style.textContent = '[data-hayase-home-hidden="true"]{display:none!important}';
    document.head.append(style);
    const anchor = document.createComment('hayase-home-layout-end');
    const originals = new Map();
    let sections = [];
    let signature = '';
    let lastStatus = '';

    const status = message => { lastStatus = message; root.getElementById('status').textContent = message; };
    const rank = id => { const index = DEFAULT.indexOf(id); return index < 0 ? DEFAULT.length : index; };
    const ordered = () => {
      const defaults = [...sections].sort((a, b) => rank(a.id) - rank(b.id));
      const ids = [...saved.order, ...defaults.map(section => section.id)];
      return [...sections].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    };
    function remember(node) {
      if (!originals.has(node)) originals.set(node, node.getAttribute('data-hayase-home-hidden'));
    }
    function discover() {
      const native = [...container.children].filter(node => node.matches('div.cursor-pointer.text-muted-foreground') &&
        node.querySelector('.font-semibold.text-lg') && node.nextElementSibling?.classList.contains('overflow-x-scroll')).map(node => {
        const title = node.querySelector('.font-semibold.text-lg').textContent.trim();
        return { id: `hayase:${title}`, title, nodes: [node, node.nextElementSibling] };
      });
      const recent = [...container.children].find(node => node.id === 'hayase-recent-episodes');
      sections = [...(recent ? [{ id: RECENT, title: 'Recent episodes', nodes: [recent] }] : []), ...native];
      for (const section of sections) section.nodes.forEach(remember);
    }
    function apply() {
      if (!editor.isConnected) {
        const first = sections.flatMap(section => section.nodes).find(node => node.parentNode === container);
        container.insertBefore(editor, first ?? null);
      }
      if (anchor.parentNode !== container) {
        const last = [...container.children].reverse().find(node => originals.has(node));
        container.insertBefore(anchor, last?.nextSibling ?? null);
      }
      const nodes = ordered().flatMap(section => section.nodes);
      // Move only out-of-order nodes. Keep heading/row siblings together and leave
      // Svelte's own references and unrecognized content (including the banner) intact.
      let cursor = anchor;
      for (const node of [...nodes].reverse()) {
        if (node.nextSibling !== cursor) container.insertBefore(node, cursor);
        cursor = node;
      }
      for (const section of sections) for (const node of section.nodes) {
        if (saved.hidden.includes(section.id)) node.setAttribute('data-hayase-home-hidden', 'true');
        else {
          const previous = originals.get(node);
          if (previous === null) node.removeAttribute('data-hayase-home-hidden');
          else node.setAttribute('data-hayase-home-hidden', previous);
        }
      }
    }
    function render() {
      const order = ordered();
      const nextSignature = JSON.stringify([ready, order.map(section => [section.id, section.title, saved.hidden.includes(section.id)])]);
      if (signature === nextSignature) return;
      signature = nextSignature;
      const focused = root.activeElement;
      const focusId = focused?.dataset.id, focusAction = focused?.dataset.action;
      const list = root.querySelector('ul');
      list.replaceChildren();
      for (const [index, section] of order.entries()) {
        const row = document.createElement('li');
        const label = document.createElement('label');
        const show = document.createElement('input'); show.type = 'checkbox'; show.checked = !saved.hidden.includes(section.id); show.disabled = !ready;
        show.dataset.id = section.id; show.dataset.action = 'show'; show.setAttribute('aria-label', `Show ${section.title}`);
        show.onchange = () => {
          saved.hidden = show.checked ? saved.hidden.filter(id => id !== section.id) : [...new Set([...saved.hidden, section.id])];
          update(); persist();
        };
        label.append(show, document.createTextNode(section.title)); row.append(label);
        for (const [direction, text] of [[-1, 'Move up'], [1, 'Move down']]) {
          const button = document.createElement('button'); button.textContent = text;
          button.dataset.id = section.id; button.dataset.action = String(direction);
          button.setAttribute('aria-label', `${text}: ${section.title}`);
          button.disabled = !ready || index + direction < 0 || index + direction >= order.length;
          button.onclick = () => {
            // Retain absent sections in storage, while moving the visible pair across them.
            const ids = [...new Set([...saved.order, ...order.map(item => item.id)])];
            const a = ids.indexOf(section.id), b = ids.indexOf(order[index + direction].id);
            [ids[a], ids[b]] = [ids[b], ids[a]]; saved.order = ids;
            update(); persist();
          };
          row.append(button);
        }
        list.append(row);
      }
      root.getElementById('reset').disabled = !ready;
      if (focusId) {
        const controls = [...list.querySelectorAll('input,button')];
        const match = controls.find(node => node.dataset.id === focusId && node.dataset.action === focusAction && !node.disabled) ?? controls.find(node => node.dataset.id === focusId && !node.disabled);
        match?.focus({ preventScroll: true });
      }
      status(storageError || lastStatus || (ready ? '' : 'Loading saved layout…'));
    }
    function update() { discover(); if (ready) apply(); render(); }
    root.getElementById('reset').onclick = () => { saved = { order: [], hidden: [] }; update(); persist(); };
    return {
      container, update, status,
      destroy() {
        if (dialog.open) dialog.close();
        for (const [node, previous] of originals) {
          if (previous === null) node.removeAttribute('data-hayase-home-hidden');
          else node.setAttribute('data-hayase-home-hidden', previous);
        }
        editor.remove(); anchor.remove(); style.remove();
      }
    };
  }

  globalThis.hayaseHomeLayout = {
    update(container) {
      if (session?.container !== container) { session?.destroy(); session = create(container); }
      session.update();
    },
    destroy() { session?.destroy(); session = null; }
  };
})();
