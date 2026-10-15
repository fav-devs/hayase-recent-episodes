window.runNativePreviewTests = async () => {
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
  const target = document.createElement('div'); target.style.cssText = 'position:fixed;left:400px;top:100px;width:184px;height:323px'; document.body.append(target);
  const release = { mediaId: 21, episode: 3, title: 'One Piece', media: {
    title: { english: 'One Piece', romaji: 'ONE PIECE' }, coverImage: { extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx21-ELSYx3yMPcKM.jpg' },
    description: 'Synopsis', averageScore: 87, format: 'TV', duration: 24, season: 'FALL', seasonYear: 1999, episodes: 12,
    trailer: { id: 'fixture0001', site: 'youtube' }
  } };
  const component = HayaseNativePreview.create(target, release, { states: { 21: { status: 'CURRENT', progress: 2, favorite: true } }, settings: { hideSpoilers: true, titleType: 'ENGLISH' } });
  try {
    await new Promise(resolve => setTimeout(resolve, 50));
    const root = component.root;
    assert(!root.querySelector('.details').textContent.includes('87%'), 'Native spoiler setting hides score for currently watched anime');
    assert(root.querySelector('.details').textContent.includes('2 / 12 Episodes'), 'Native progress text uses watched and total episodes');
    assert(root.querySelectorAll('button')[1].querySelector('svg').getAttribute('fill') === 'currentColor', 'Favorite icon reflects linked/local state');
    assert(root.querySelectorAll('button')[2].querySelector('svg').getAttribute('fill') === 'currentColor', 'Bookmark icon reflects native list status');
    if (!(navigator.deviceMemory < 4 || navigator.userAgent.includes('AndroidTV') || navigator.platform === 'Linux armv8l')) {
      assert(root.querySelectorAll('iframe').length === 2, 'Native foreground and blurred trailer frames are retained');
      assert(root.querySelector('iframe').src.includes('youtube-nocookie.com') && root.querySelector('iframe').src.includes('mute=1'), 'Trailer retains native cookie-free muted autoplay parameters');
    }
    return { passed: results.length, results };
  } finally { component.destroy(); target.remove(); }
};
