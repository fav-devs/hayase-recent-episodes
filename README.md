<img src="assets/icon.svg" width="64" height="64" alt="">

# Hayase Recent Episodes

A desktop Hayase plugin for recently aired anime and a customizable Home screen.

- Browse episode broadcasts by week with poster cards and hover previews.
- Choose a date or move between weeks with the compact date navigator.
- Open **Customize** at the top right to reorder, hide, or restore Home sections.
- Save your layout locally between app sessions.

**Experimental, version 0.5.0.** This is an independent plugin. The current build has been tested with browser fixtures; the new automatic playback handoff still needs verification in the real Hayase desktop app.

## Install

Build the plugin ZIP using the instructions below, then open **Settings → Plugins → Install Plugin** in desktop Hayase and select `dist/hayase-recent-episodes.zip`. Depending on your Hayase version, Plugins may be under Extensions. Restart Hayase after installation or updating.

You can also select `plugin/manifest.json` in Hayase's unpacked-plugin installer. Keep the other plugin files beside it. This manifest is a Chrome-extension manifest, not a content-source repository.

The plugin targets `https://hayase.app/*`, matching the current desktop wrapper. It does not support Android or self-hosted origins.

## Build and test

Requires Node.js 20+ and Python 3. No runtime dependencies or compilation step.

```sh
git clone https://github.com/fav-devs/hayase-recent-episodes.git
cd hayase-recent-episodes
npm test
npm run package
```

The generated ZIP contains the files in `plugin/`, with `manifest.json` at its root. Packaging checks that the version in `package.json` matches `plugin/manifest.json`.

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

API host permissions cover `graphql.anilist.co` and `tsuzuki.top`. The content script runs only on Hayase. Account credentials and watch history are not sent to either service. Titles and descriptions are rendered as text; images require HTTPS URLs.

Hayase does not expose its internal AniList client or compiled card components through a public plugin bridge. This plugin uses the public AniList API independently and does not access your connected account, authentication token, in-memory cache, favorites or list status.

## Compatibility

Home section discovery follows the current upstream heading/row structure. A Hayase UI update may require adapting `plugin/content.js` or `plugin/home-layout.js`. Section preferences use the native English headings as identifiers, so upstream renames may reset a section's preference.

The episode row hides its scrollbar while retaining horizontal scrolling. The playback handoff relies on current native anime-page/source-dialog controls and can require adapting if Hayase changes them.

The layout modal moves existing heading/row pairs without replacing their event handlers. Its trigger remains available even if all sections are hidden. **Reset layout** restores all sections in their default order.

## References

- [Hayase plugin documentation](https://github.com/hayase-app/wiki/blob/master/extensions/plugins.md)
- [Upstream research notes](docs/recent-releases-research.md)
- [Report an issue](https://github.com/fav-devs/hayase-recent-episodes/issues)

No distribution license has been selected; package metadata is currently marked `UNLICENSED`. This package is private for npm publishing purposes; install the generated ZIP through Hayase.
