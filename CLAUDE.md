# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Overview

Digital business card for Oleg Hanukayev, "C-137" portal + shell theme.
Static site, **no build step**, deployed by GitHub Pages (legacy branch mode,
`main`, repo root) to https://see-137.github.io/digital-business-card/.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page: markup, all CSS (inline), meta/OG/JSON-LD, importmap. The only HTML. |
| `js/app.js` | Everything non-3D: stack chips, vCard, Save/Share/QR, toast, the c137 shell (history, Tab completion), retrieval windows, section jumps, lazy portal boot, service-worker registration. |
| `js/portal.js` | The 3D portal: three r186 `WebGPURenderer` (auto WebGL2 fallback), TSL shaders, particle stream, bloom. Loaded lazily by `app.js`. |
| `vendor/three/` | Vendored three **0.186.1**, minified (from jsDelivr), MIT `LICENSE`. `three.webgpu.js` imports `./three.core.js`; `three/webgpu` and `three/tsl` resolve via the importmap in `index.html`. |
| `fonts/` | Self-hosted latin woff2: Instrument Serif 400/italic, IBM Plex Mono 400/500/600 (OFL). |
| `icons/`, `manifest.webmanifest`, `sw.js` | PWA: icons (incl. maskable + apple-touch), manifest, offline service worker. |
| `assets/qr.svg` | QR for the card URL (error level H, portal mark overlay). Regenerate with `segno` if the URL changes, then verify it decodes. |
| `assets/og-card.png` | 1200x630 social preview. Other images in `assets/` are unused (Work section removed on purpose). |
| `tests/` | Headless regression checks (puppeteer-core + axe-core). Not loaded by the site. |

## Commands

```bash
# Local preview (from the repo root)
python -m http.server 3137

# Regression checks (from tests/; uses the installed Chrome, CHROME_PATH overrides)
npm ci
npm test

# Deploy: push main, then force a Pages build (legacy mode does not always trigger)
git push origin main
gh api -X POST repos/See-137/digital-business-card/pages/builds
```

## Conventions and gotchas

- **Content is the owner's.** Copy, claims, roles and project lines change only on request. Email, location and the Work section were removed deliberately.
- **3D must never block first paint.** `app.js` boots `portal.js` only after `load` + 1.2 s, when the stage is on screen (phones: 15% visible), in an idle slot, or on first touch of the stage. Keep it that way; Lighthouse mobile is 100 because of it.
- **URL pins:** `?webgl=1` (force WebGL2), `?motion=0` (single still frame, also from `prefers-reduced-motion`), `?t=<s>` (pin the clock), `?3d=0` (CSS poster only).
- **Portal failures fall back to the CSS poster.** `portal.js` turns three's logged shader/pipeline errors and WebGPU `uncapturederror` during startup into a thrown error.
- **Service worker:** fonts/vendor/icons are cache-first (immutable); everything else network-first. Bump `VERSION` in `sw.js` when changing a cache-first file or the precache list.
- **Font fallbacks are metric-matched** (`Instrument Fallback`, `Plex Mono Fallback` in `index.html`) so the web-font swap does not move the layout. If a font or the headline copy changes, re-measure `size-adjust` (fontTools, widths of the real copy) — the unmatched serif cost CLS 0.08 live and 0.2 on slow fonts; `tests/` checks it.
- **Contrast tokens** in `:root` (`--mute`, `--mute-2`, `--leaf`, `--leaf-2`) are measured at >= 4.5:1 on every dark surface. Don't use `#5a6f92` (3.7:1) for text.
- **Retrieval windows** duplicate the shell output, so their layer is `aria-hidden` and the close buttons are pointer-only. The shell log (`role="log"`) is the accessible record.
- **Dialogs** use native `<dialog>` + `showModal()` (focus containment, Escape, focus return) with `html:has(dialog[open])` for scroll lock; initial focus via `autofocus`.
- Windows: the repo has `core.autocrlf=true` on the author's machine; files are committed with LF.

## Measured baseline (2026-10-01, local gzip server, Lighthouse 13.5)

Mobile 100 / 100 / 100 / 100, desktop 100 / 100 / 100 / 100; axe-core 0 violations; `tests/` 27/27 (incl. offline with the server down and a slow-font CLS check).
The live site before this work measured mobile 79 / 96 / 100 / 100, desktop 96 / 100 / 100 / 100.
