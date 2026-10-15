import { get } from 'svelte/store';
import { preferences } from './context.js';
const FORMATS = { TV: 'TV Series', TV_SHORT: 'TV Short', MOVIE: 'Movie', SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music', MANGA: 'Manga', NOVEL: 'Novel', ONE_SHOT: 'One Shot' };
export const format = media => FORMATS[media.format] || 'N/A';
export const duration = media => media.duration ? `${media.duration} Minute${media.duration > 1 ? 's' : ''}` : undefined;
export const season = media => [media.season?.toLowerCase() || (media.startDate?.month && ['winter', 'spring', 'summer', 'fall'][Math.floor((media.startDate.month % 12) / 3)]), media.seasonYear || media.startDate?.year].filter(Boolean).join(' ');
export function desc(media) {
  return (media.description?.replace(/<[^>]+>/g, '').replace(/\n+/g, '\n') || 'No description available.').replace(/\n?\(?Source: [^)]+\)?\n?/m, '').replace(/\n?Notes?:[ |\n][^\n]+\n?/m, '');
}
export function title(media) {
  const names = media.title || {};
  const settings = get(preferences);
  const language = typeof settings.titleLanguage === 'string' ? settings.titleLanguage.toLowerCase() : '';
  const preferred = names[language] || names.userPreferred || names.romaji || names.english || names.native || 'TBA';
  const type = settings.titleType;
  return type === 'ENGLISH' ? names.english || preferred : type === 'NATIVE' ? names.native || preferred : type === 'ROMAJI' ? names.romaji || preferred : preferred;
}
export const banner = media => media.bannerImage || (media.trailer?.id ? `https://i.ytimg.com/vi/${media.trailer.id}/maxresdefault.jpg` : media.coverImage?.extraLarge || media.coverImage?.large);
export const cover = media => media.coverImage?.extraLarge || media.coverImage?.large || banner(media);
