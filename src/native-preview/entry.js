import { mount, unmount, flushSync } from 'svelte';
import Preview from './vendor/cards/preview.svelte';
import { configure } from './adapters/context.js';
import css from './utilities.css';

export function create(target, release, context = {}) {
  const root = target.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = css + '\n' + (globalThis.__hayasePreviewComponentCSS || ''); root.append(style);
  configure(release, context);
  const media = { ...release.media, id: release.mediaId, title: release.media?.title || { english: release.title, userPreferred: release.title } };
  let component;
  const render = () => flushSync(() => { component = mount(Preview, { target: root, props: { media, class: context.first ? 'left-36 md:left-1/2' : '' } }); });
  render();
  return { root, destroy() { unmount(component); }, update(value) { unmount(component); configure(release, value); render(); } };
}
globalThis.HayaseNativePreview = { create };
