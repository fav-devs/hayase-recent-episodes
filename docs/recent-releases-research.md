# Recent releases plugin: initial research

Reviewed 2026-10-14. This workspace initially contained only a README and icon; it is not a checkout of the Hayase app. Upstream repositories were read in `/tmp/hayase-research` without copying app code into this project.

## Findings

- The current UI lives in `hayase-app/interface`; the desktop wrapper and plugin loader live in `hayase-app/electron`.
- Home currently contains Continue Watching, Your List, Sequels You Missed, popularity/trending sections, and genre sections. There is no recent-episode release section.
- An Airing Calendar already exists at `/#/app/schedule`. Its “My list” filter defaults to enabled. Turning it off allows broader discovery. It groups AniList episode airing timestamps by local date, including past dates.
- Content-source extensions run in workers without DOM access. Their public methods search individual episodes, batches, or movies. They cannot add a home section through that API, and there is no documented recent-release discovery method.
- Desktop plugins are Chrome extensions. Electron loads them into the app window's session. A content script targeting `https://hayase.app/*` is a plausible way to add a home section, but actual injection and compatibility still require testing in Hayase. There is no documented home-widget registration API.
- AniList schedule data used by the app contains episode number and airing time, with no sub/dub release distinction. It can seed a “Recently aired” feature, but does not establish subtitle or dubbed episode availability.
- A source extension's `media: sub | dub | both` and language fields describe the extension, not individual releases. Torrent results have an upload date, but no structured per-result audio-language field. Upload time can also describe a re-upload or batch of older episodes.

## Proposed behavior

Place a “Recent episodes” panel near the top of Home. Offer Sub / Dub, Today / This week / Choose date, and previous/next period navigation. Use the user's local timezone, sort newest first, and show title, episode, release time, and language. Link each card to `/#/app/anime/{anilistId}` so the existing app handles episode selection and playback.

Deduplicate by anime ID, episode, and language rather than showing every encoding. Keep broadcast time, provider release time, and upload time distinct. Show stale-cache status, retryable errors, and an explicit empty state. Do not label an AniList broadcast timestamp as a confirmed dubbed or subtitled release.

## Implementation decision

For a desktop plugin, use a Chrome extension with a content script for the home panel and a release-data adapter. Observe hash navigation and DOM changes, mount only once, and remove the panel when leaving Home. Avoid reaching into private Svelte stores. Cache requests and handle pagination and API limits.

The unresolved dependency is a verified release feed with episode IDs/numbers, timestamps, language/version, and a mapping to AniList. Existing installed sources may help, but their documented API does not expose a universal recent-release feed. A proper dub feed must include older shows receiving new dubs; it cannot be limited to currently airing Japanese shows.

Before implementing, establish the user's platform, intended dub language, and whether “release” means broadcast, streaming availability, or upload availability. Android support would need separate investigation; the verified plugin loader is in Electron.

## Sources inspected

- [Plugin documentation](https://github.com/hayase-app/wiki/blob/f069858dad9c3208dc14f8eb4989487f6bfb13cf/extensions/plugins.md)
- [Content extension development](https://github.com/hayase-app/wiki/blob/f069858dad9c3208dc14f8eb4989487f6bfb13cf/extensions/development/creating-extensions.md)
- [Home sections](https://github.com/hayase-app/interface/blob/7e6e2675d5afa3afb1e17023bb67ed3a58faf785/src/routes/app/home/+page.svelte)
- [Airing Calendar](https://github.com/hayase-app/interface/blob/7e6e2675d5afa3afb1e17023bb67ed3a58faf785/src/routes/app/schedule/+page.svelte)
- [AniList queries](https://github.com/hayase-app/interface/blob/7e6e2675d5afa3afb1e17023bb67ed3a58faf785/src/lib/modules/anilist/queries.ts)
- [Source types](https://github.com/hayase-app/interface/blob/7e6e2675d5afa3afb1e17023bb67ed3a58faf785/src/lib/modules/extensions/types.d.ts)
- [Desktop plugin loader](https://github.com/hayase-app/electron/blob/b93b1a4f5ed67f17056b0ec8b790c7af3417933f/src/main/plugins.ts)

No plugin has been implemented or tested yet. These findings establish the integration route and the data gap, not runtime compatibility.
