export function click(node, callback) {
  node.tabIndex = 0;
  node.setAttribute('role', 'button');
  const handle = event => { event.stopPropagation(); event.preventDefault(); callback(event); };
  const key = event => { if (event.key === 'Enter' || event.key === ' ') handle(event); };
  node.addEventListener('click', handle); node.addEventListener('keydown', key);
  return { destroy() { node.removeEventListener('click', handle); node.removeEventListener('keydown', key); } };
}
export const clickwrap = callback => event => { event.stopPropagation(); event.preventDefault(); event.stopImmediatePropagation(); callback(event); };
export const keywrap = callback => event => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); event.preventDefault(); callback(event); } };
