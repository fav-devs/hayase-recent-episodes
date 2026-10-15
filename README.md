<img src="assets/icon.svg" width="64" height="64" alt="">

# Hayase Recent Episodes

A desktop Hayase plugin for recently aired anime and a customizable Home screen.

- Browse episode broadcasts by week with poster cards and hover previews.
- Choose a date or move between weeks with the compact date navigator.
- Open **Customize** at the top right to reorder, hide, or restore Home sections.
- Save your layout locally between app sessions.
- Show a small history icon and released-episode number on cards for anime you have watched.

**Experimental, version 0.7.0.** This is an independent plugin. The current build has been tested with browser fixtures; the new automatic playback handoff still needs verification in the real Hayase desktop app.

## Install

Build the plugin ZIP using the instructions below, then open **Settings → Plugins → Install Plugin** in desktop Hayase and select `dist/hayase-recent-episodes.zip`. Depending on your Hayase version, Plugins may be under Extensions. Restart Hayase after installation or updating.

You can also select `plugin/manifest.json` in Hayase's unpacked-plugin installer. Keep the other plugin files beside it. This manifest is a Chrome-extension manifest, not a content-source repository.

The plugin targets `https://hayase.app/*`, matching the current desktop wrapper. It does not support Android or self-hosted origins.

## Build and test

Requires Node.js 20+ and Python 3. Build dependencies are installed with npm; the resulting extension bundles its runtime and needs no separate installation.

```sh
git clone https://github.com/fav-devs/hayase-recent-episodes.git
cd hayase-recent-episodes
npm ci
npm test
npm run package
```

The build compiles the native Svelte preview into `plugin/native-preview.js`. The generated ZIP contains the plugin files and third-party license notices, with `manifest.json` at its root. Run the build before using an unpacked manifest from a source checkout. Packaging checks that the version in `package.json` matches `plugin/manifest.json`.

To preview the UI with sample data:

```sh
python3 -m http.server 7345
```

Open `http://localhost:7345/tests/preview.html`. This fixture is not the live Hayase app and is excluded from the ZIP. The playback fixture at `/tests/playback.html` provides `await runPlaybackTests()` to check latest-episode selection, native auto-selection and cancellation without starting real downloads.

Layout browser checks can be run with `await runHomeLayoutTests()` in the fixture's console. Card checks are available as `await runReleaseCardTests()` and require a focused browser tab for keyboard-focus assertions.

## Release data

The current UI queries [AniList](https://anilist.co/) for episode broadcast times and anime metadata. All pages in the selected week are fetched, future timestamps are excluded, and dates follow your computer's timezone. Cards show the poster, title and episode number; hovering or focusing reveals the banner, synopsis, score and other anime details.

**Broadcast dates do not confirm subtitled or dubbed availability.** The current UI has no sub/dub selector. Legacy [Tsuzuki](https://tsuzuki.netlify.app/api/) adapters remain in the code for version-specific release dates, but are not exposed in the UI.

Clicking a poster opens the anime page. **Play now** in the hover preview looks up the latest aired episode, opens Hayase's native source-search dialog, sets that episode, and invokes **Auto Select Torrent** to begin loading the native best match. It does not use watched progress or the historical week's older episode number. If AniList has no episode schedule for the title, the card's episode is used. Actual playback requires an available result from your installed sources.

## Storage and permissions

The plugin uses local extension storage for layout preferences and a ten-minute response cache. Cached periods remain readable when the feed is unavailable. The panel refreshes automatically every ten minutes.

API host permissions cover `graphql.anilist.co`, `tsuzuki.top`, and `hayase.ani.zip` (the same banner-image service used by native Hayase cards). The content script runs only on Hayase. Account credentials and watch history are not sent to either service. Titles and descriptions are rendered as text; images require HTTPS URLs.

Hayase does not expose its internal client through a public plugin bridge. This plugin uses the public AniList API independently, but now compiles Hayase's actual Svelte hover preview and its buttons, images and trailer components. See [native preview provenance](src/native-preview/UPSTREAM.md) for the pinned source and explicit adapters. For history badges, it reads local playback progress, the local watchlist, and the public viewer ID from the connected AniList account, then fetches public list progress for the displayed anime. The token is never forwarded, stored, logged, or used for requests. Private/unavailable AniList lists fall back to local history. Planning entries with no viewing progress do not get badges. The badge number is the episode shown on the card, not your watched-progress number.

## Native hover preview

The hover card reuses the pinned upstream Svelte markup and CSS: 280 × 320 dimensions, 45% banner/trailer area, title, native Play/Favorite/Bookmark controls, one details line and a four-line synopsis. Native image loading, trailer autoplay/mute behavior and animations are bundled as well. The Play label is changed to **Play now** as requested.

Favorite and Bookmark clicks open the anime page and invoke Hayase's native controls. They do not write account data through a copied token. Local/public state supplies icon fills, progress text, title preferences and spoiler hiding; unavailable private state remains a limitation. The preview uses a fixed portal so it can escape the scrolling row, with viewport-edge clamping.

The public app returned a 401 in the development browser. The compiled source and layout have been checked locally, but a side-by-side check in the installed app is still needed before claiming full live-app parity.

Validation: 15 Node tests and 52 browser assertions passed across layout, card geometry, trailer/state behavior and native action handoff. A real keyboard-focus assertion was skipped because the collaborative preview tab was unfocused.

## Compatibility

Home section discovery follows the current upstream heading/row structure. A Hayase UI update may require adapting `plugin/content.js` or `plugin/home-layout.js`. Section preferences use the native English headings as identifiers, so upstream renames may reset a section's preference.

The episode row hides its scrollbar while retaining horizontal scrolling. The playback handoff relies on current native anime-page/source-dialog controls and can require adapting if Hayase changes them.

The layout modal moves existing heading/row pairs without replacing their event handlers. Its trigger remains available even if all sections are hidden. **Reset layout** restores all sections in their default order.

## References

- [Hayase plugin documentation](https://github.com/hayase-app/wiki/blob/master/extensions/plugins.md)
- [Upstream research notes](docs/recent-releases-research.md)
- [Report an issue](https://github.com/fav-devs/hayase-recent-episodes/issues)

Original project code has no distribution license selected (`UNLICENSED`). Vendored Hayase components are covered separately by their included BUSL-1.1 license; other bundled dependencies retain their own notices. This package is private for npm publishing purposes; install the generated ZIP through Hayase.
