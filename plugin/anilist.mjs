const FIELDS = `id title { english romaji native } coverImage { large extraLarge color } bannerImage
  description(asHtml: false) format season seasonYear startDate { year } averageScore genres duration episodes isAdult`;

export async function graphql(query, variables) {
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST', credentials: 'omit', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) throw new Error(response.status === 429 ? 'AniList is busy. Wait a minute before refreshing.' : `AniList is unavailable (${response.status}). Try again later.`);
  const result = await response.json();
  if (result.errors?.length || !result.data) throw new Error('AniList could not return the requested anime data. Try again later.');
  return result.data;
}

export async function airingRows(request) {
  const rows = [];
  for (let page = 1; page <= 40; page++) {
    const data = await graphql(`query RecentAiring($page:Int,$start:Int,$end:Int) {
      Page(page:$page,perPage:50) { pageInfo { hasNextPage }
        airingSchedules(airingAt_greater:$start,airingAt_lesser:$end,sort:TIME_DESC) {
          episode airingAt media { ${FIELDS} }
        }
      }
    }`, { page, start: Math.floor(request.start / 1000) - 1, end: Math.ceil(request.end / 1000) });
    if (!Array.isArray(data.Page?.airingSchedules) || typeof data.Page?.pageInfo?.hasNextPage !== 'boolean') throw new Error('AniList returned an unexpected schedule response.');
    for (const item of data.Page.airingSchedules) {
      const media = item?.media;
      if (!media || media.isAdult) continue;
      rows.push({ mediaId: media.id, episode: item.episode, airingAt: item.airingAt, airType: 'aired', exact: true, estimated: false, title: media.title?.english || media.title?.romaji || media.title?.native || 'Untitled', media });
    }
    if (!data.Page.pageInfo.hasNextPage) return rows;
  }
  throw new Error('The airing schedule is too large. Choose a shorter period.');
}

export async function enrichRows(rows) {
  const ids = [...new Set(rows.map(row => row.mediaId).filter(id => Number.isInteger(id) && id > 0))];
  const media = new Map();
  for (let offset = 0; offset < ids.length; offset += 50) {
    const data = await graphql(`query RecentCards($ids:[Int]) { Page(perPage:50) { media(id_in:$ids,type:ANIME) { ${FIELDS} } } }`, { ids: ids.slice(offset, offset + 50) });
    if (!Array.isArray(data.Page?.media)) throw new Error('AniList returned an unexpected card response.');
    for (const item of data.Page.media) if (item) media.set(item.id, item);
  }
  return rows.filter(row => !media.get(row.mediaId)?.isAdult).map(row => ({ ...row, media: media.get(row.mediaId) }));
}
