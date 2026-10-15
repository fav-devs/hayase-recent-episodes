(() => {
  const safeImage = value => {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
  };
  const description = value => new DOMParser().parseFromString(typeof value === 'string' ? value : '', 'text/html').body.textContent.trim();
  const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
  const label = release => release.airType === 'aired' ? 'Broadcast' : release.airType === 'dub' ? 'English dub' : release.estimated ? 'Sub · estimated' : 'English sub';

  globalThis.hayaseReleaseCards = (root, items) => {
    const style = document.createElement('style');
    style.textContent = `
      #items{gap:0;padding:0 0 12px;align-items:flex-start;scrollbar-width:none}#items::-webkit-scrollbar{display:none}article.release-card{flex:0 0 184px;min-width:0}
      article.release-card>a{display:flex;flex-direction:column;min-height:323px;border:0;border-radius:0;padding:16px;background:transparent;color:inherit;text-decoration:none}
      article.release-card>a:hover{background:transparent}article.release-card>a:focus-visible{outline:2px solid var(--ring,Highlight);outline-offset:-3px}
      .release-cover{height:216px;width:152px;border-radius:5px;object-fit:cover;background:var(--muted,ButtonFace)}
      .release-cover-empty{display:flex;align-items:center;justify-content:center;color:var(--muted-foreground,GrayText);font-size:12px}
      .release-card .title{padding-top:12px;font-size:12.8px;font-weight:900;line-height:1.4;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .release-card .episode{font-size:12px;margin-top:auto;padding-top:8px;color:var(--muted-foreground,GrayText)}
      .release-preview{position:fixed;z-index:2147483000;width:280px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow-y:auto;border-radius:6px;background:var(--muted,Canvas);color:var(--foreground,CanvasText);box-shadow:0 8px 28px rgb(0 0 0 / .35);border:1px solid var(--border,GrayText)}
      .release-preview[hidden]{display:none}.release-banner{width:100%;height:140px;object-fit:cover;background:var(--background,Canvas);display:block}.release-preview-body{padding:12px 16px 16px}
      .release-preview h3{margin:0 0 10px;font-size:18px;line-height:1.35;font-weight:700}.release-preview .details{font-size:11px;line-height:1.7;margin:10px 0 5px}.release-preview .description{font-size:11px;line-height:1.6;color:var(--muted-foreground,GrayText);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
      .release-preview .preview-link{display:block;text-align:center;font-size:12px;padding:7px 10px;border:1px solid var(--border,GrayText);border-radius:5px;color:inherit;text-decoration:none;background:var(--background,Canvas)}.release-preview .preview-link:hover{background:var(--accent,ButtonFace)}
    `;
    root.append(style);
    const popup = element('div', 'release-preview'); popup.hidden = true; popup.setAttribute('role', 'region'); popup.setAttribute('aria-label', 'Anime preview'); root.append(popup);
    let timer, active;
    const hide = () => { clearTimeout(timer); popup.hidden = true; active?.setAttribute('aria-expanded', 'false'); active = null; };
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
      popup.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - 140, innerWidth - popup.offsetWidth - 8))}px`;
      popup.style.top = `${Math.max(8, Math.min(rect.top - 12, innerHeight - popup.offsetHeight - 8))}px`;
    }
    function preview(release, anchor) {
      clearTimeout(timer); hide(); active = anchor; anchor.setAttribute('aria-expanded', 'true');
      const media = release.media ?? {};
      popup.replaceChildren(image(media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large || release.coverImage, 'release-banner', ''));
      const body = element('div', 'release-preview-body');
      body.append(element('h3', '', release.title));
      const link = element('a', 'preview-link', 'Play now'); link.href = `/#/app/anime/${release.mediaId}`;
      link.onclick = event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); hide(); globalThis.hayasePlayLatest(release);
      };
      body.append(link);
      const year = media.seasonYear || media.startDate?.year;
      const details = [media.format?.replaceAll('_', ' '), media.episodes ? `${media.episodes} episodes` : null, media.duration ? `${media.duration} min` : null, [media.season?.toLowerCase(), year].filter(Boolean).join(' '), media.averageScore ? `${media.averageScore}%` : null].filter(Boolean).join(' · ');
      body.append(element('div', 'details', details || 'Anime details unavailable'));
      if (media.genres?.length) body.append(element('div', 'details', media.genres.join(' · ')));
      body.append(element('div', 'description', description(media.description) || 'No description available.'));
      body.append(element('div', 'details', `Episode ${release.episode} · ${label(release)}`));
      popup.append(body); popup.hidden = false;
      position(anchor);
    }
    popup.onpointerenter = () => clearTimeout(timer);
    popup.onpointerleave = later;
    popup.onfocusout = later;
    const escape = event => { if (event.key === 'Escape') { const anchor = active; hide(); if (popup.contains(root.activeElement)) anchor?.focus(); hide(); } };
    root.addEventListener('keydown', escape);
    const onScroll = () => { if (active && (root.activeElement === active || popup.contains(root.activeElement))) position(active); else hide(); };
    items.addEventListener('scroll', onScroll);
    addEventListener('resize', onScroll);
    addEventListener('scroll', onScroll, true);
    return {
      render(releases) {
        hide(); items.replaceChildren();
        for (const release of releases) {
          const media = release.media ?? {};
          const article = element('article', 'release-card');
          const link = element('a'); link.href = `/#/app/anime/${release.mediaId}`; link.setAttribute('aria-expanded', 'false');
          link.append(image(media.coverImage?.large || media.coverImage?.extraLarge || release.coverImage, 'release-cover', `${release.title} cover`));
          link.append(element('span', 'title', release.title));
          link.append(element('span', 'episode', `Ep ${release.episode}${release.estimated ? ' · Estimated' : ''}`));
          link.onpointerenter = () => {
            // Keep a keyboard user's focused preview from being replaced by a
            // stationary pointer when focus scrolls another poster underneath it.
            if (root.activeElement?.closest('article.release-card') && root.activeElement !== link) return;
            preview(release, link);
          };
          link.onpointerleave = later;
          link.onfocus = () => preview(release, link);
          link.onblur = later;
          article.append(link); items.append(article);
        }
      },
      clear: hide,
      destroy() { hide(); popup.remove(); style.remove(); root.removeEventListener('keydown', escape); items.removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); removeEventListener('scroll', onScroll, true); }
    };
  };
})();
