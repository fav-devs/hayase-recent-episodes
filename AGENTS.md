# Project instructions

## Hayase is the UI source of truth

This plugin extends [Hayase](https://github.com/hayase-app/interface). Hayase's actual code is the primary reference and inspiration. Existing Hayase UI must be matched **1:1**, not loosely imitated or redesigned.

Before changing any UI, read the corresponding upstream component and its dependencies. Reuse the original component when technically possible. If the plugin needs a separate implementation, reproduce its markup, styles and behavior faithfully. Do not invent a replacement because it is easier to build.

Authoritative upstream references:

- `src/routes/app/home/+page.svelte`: Home sections and row layout.
- `src/lib/components/ui/cards/small.svelte`: poster cards.
- `src/lib/components/ui/cards/preview.svelte`: hover preview, composition and actions.
- `src/lib/components/ui/cards/query.svelte`: card rendering and loading behavior.
- `src/lib/components/ui/cards/YoutubeIframe.svelte`: trailer behavior.
- `src/lib/components/ui/button/play.svelte`: native playback action.
- `src/lib/components/ui/player/mediahandler.svelte`: episode playback handoff.
- `src/lib/components/SearchModal.svelte`: source search and selection.
- `src/lib/modules/navigate.ts`: hover, click, keyboard and scrolling behavior.
- `src/app.css` and the upstream theme/component files: shared styling.

Match the existing component's dimensions, spacing, typography, colors, borders, radii, image cropping, positioning, stacking, hover timing, animation, focus states, keyboard handling and scrolling behavior. Hover previews must match the real Hayase preview, including its image/trailer area, information hierarchy and action layout. A generic information popup is not an acceptable substitute.

Compare the result against the actual upstream component at the same viewport and theme. A standalone fixture is useful for testing, but it is not evidence of a 1:1 match with Hayase. Never claim exact parity without checking it. If the extension boundary prevents reuse or matching a feature, explain that specific limitation rather than silently approximating or adding nonfunctional controls.

## Explicit user changes take precedence

Keep the user's deliberate differences from upstream:

- Recent-episode cards show a poster, title and episode number. Omit year, format/TV labels and timestamps on the base card.
- A watched anime has a top-right history icon and released-episode number. No visible "In history" text; no badge without watch history.
- The preview playback action says **Play now**, selects the latest aired episode, and starts native source selection/loading.
- No visible scrollbar on the recent-episodes row.
- **Customize** sits at the top right and opens a layout-only modal.
- The removed credits/options footer and release-options block stay removed. Do not relocate removed content elsewhere.
- Keep copy minimal. Do not add explanations, toolbars or metadata the user removed.

These exceptions do not authorize redesigning the rest of Hayase's UI. User instructions in the conversation override this file.

## Data and playback

Use Hayase's existing data semantics and native actions as the reference. Do not confuse broadcast times with confirmed sub/dub availability, watched progress with the newest episode, or opening an anime page with starting playback. Do not copy account tokens into plugin requests or logs.

## Validation and packaging

Run `npm test`, syntax-check changed browser scripts, and build with `npm run package`. Keep `package.json` and `plugin/manifest.json` versions aligned when releasing a new build. Validate UI changes against upstream as well as the browser fixtures. Report real-app integration checks that remain unverified.
