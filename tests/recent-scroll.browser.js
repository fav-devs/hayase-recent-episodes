window.runRecentScrollTests = async () => {
  const results = [], assert = (value, message) => { if (!value) throw new Error(message); results.push(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const root = document.querySelector('#hayase-recent-episodes').shadowRoot;
  const items = root.getElementById('items'), status = root.getElementById('status');
  const send = chrome.runtime.sendMessage;
  const requests = [];
  let failNext = false;
  chrome.runtime.sendMessage = async request => {
    if (request.type !== 'recent-episodes') return send(request);
    requests.push(request);
    await wait(40);
    if (failNext) { failNext = false; return { ok: false, error: 'Offline' }; }
    return { ok: true, releases: Array.from({ length: 12 }, (_, index) => ({ mediaId: 10000 + requests.length * 100 + index, episode: 1, title: `Older anime ${index + 1}`, time: request.end - (index + 1) * 3600000 })) };
  };
  try {
    assert(!root.querySelector('input[type=date], #previous, #next'), 'No date picker or period arrows');
    const original = items.firstElementChild;
    const load = [...status.querySelectorAll('button')].find(button => /older/.test(button.textContent));
    assert(!!load, 'Sparse weeks can be resumed without a request loop');
    load.click(); await wait(150);
    assert(items.firstElementChild === original, 'Appending older episodes preserves the original card DOM');
    assert(items.children.length === 15 && items.scrollWidth > items.clientWidth, 'Older episodes append into the horizontal row');
    items.scrollLeft = 250;
    const link = items.children[2].querySelector('a');
    await wait(180);
    link.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })); await wait(50);
    assert(!root.querySelector('.release-preview').hidden, 'A settled mouse hover opens its preview');
    link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, buttons: 1, button: 0, clientX: 300, clientY: 240 }));
    link.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 180, clientY: 240, cancelable: true }));
    assert(items.scrollLeft === 370, 'Mouse dragging scrolls by the native pointer delta');
    assert(root.querySelector('.release-preview').hidden, 'Dragging cancels the preview');
    link.dispatchEvent(new PointerEvent('pointerenter', { buttons: 1, pointerType: 'mouse' })); await wait(60);
    assert(root.querySelector('.release-preview').hidden, 'Cards passed during a drag cannot reopen the preview');
    window.dispatchEvent(new MouseEvent('mouseup'));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    assert(!link.dispatchEvent(click), 'The release click after dragging cannot navigate');
    await wait(180);
    items.dispatchEvent(new WheelEvent('wheel', { deltaX: 100 }));
    link.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })); await wait(60);
    assert(root.querySelector('.release-preview').hidden, 'Wheel scrolling suppresses hover previews');
    const before = requests.length;
    const previousScroll = items.scrollWidth - items.clientWidth;
    items.scrollLeft = previousScroll;
    await wait(200);
    assert(requests.length === before + 1, 'Reaching the right edge loads exactly one older page');
    assert(requests[1].end === requests[0].start, 'Scrolled pages cover contiguous earlier days');
    assert(items.children.length === 27 && items.firstElementChild === original, 'Pagination keeps loaded cards and appends the older page');
    assert(Math.abs(items.scrollLeft - previousScroll) < 1, 'Appending a page preserves horizontal scroll position');
    const count = items.children.length;
    failNext = true;
    items.scrollLeft = items.scrollWidth - items.clientWidth; await wait(120);
    const failedRequest = requests.at(-1);
    assert(items.children.length === count && !!status.querySelector('button'), 'A failed older-page request keeps cards and offers retry');
    status.querySelector('button').click(); await wait(150);
    assert(requests.at(-1).start === failedRequest.start && items.children.length === count + 12, 'Retry loads the failed window without skipping days');
    return { passed: results.length, results };
  } finally { chrome.runtime.sendMessage = send; }
};
