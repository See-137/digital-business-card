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
| `fonts/` | Self-hosted latin woff2: Instrument Serif 400/italic, IBM Plex Mono 400/600 (OFL). |
| `icons/`, `manifest.webmanifest`, `sw.js` | PWA: icons (incl. maskable + apple-touch), manifest, offline service worker. |
| `assets/qr.svg` | QR for the card URL (error level H, portal mark overlay). Regenerate with `segno` if the URL changes, then verify it decodes. |
| `assets/oleg-hanukayev.vcf` | The contact card, a static file (blob downloads fail in in-app browsers). vCard 3.0, CRLF, stored byte-exact via `.gitattributes`. Precached by the service worker. |
| `assets/og-card-v2.png` | 1200x630 social preview (current design, CV claims). Rendered from an HTML template with headless Chrome; when it changes, use a NEW filename (LinkedIn/Slack cache previews by URL) and re-scrape with LinkedIn Post Inspector. |
| `tests/` | Headless regression checks (puppeteer-core + axe-core). Not loaded by the site. |
| `.github/workflows/tests.yml` | CI: runs `tests/` on push / PR. |

## Commands

```bash
# Local preview (from the repo root)
python -m http.server 3137

# Regression checks (from tests/; uses the installed Chrome, CHROME_PATH overrides)
npm ci
npm test

# Deploy: push main, then WAIT for the push-triggered Pages build. Only if
# none appears within ~2 min, force one (a POST right after a push cancels the
# push's build, which then reports "Page build failed").
git push origin main
gh api repos/See-137/digital-business-card/pages/builds/latest --jq '.commit[0:7] + " " + .status'
gh api -X POST repos/See-137/digital-business-card/pages/builds   # only if needed
```

**CI:** `.github/workflows/tests.yml` runs `tests/` on pushes to `main` and
`improve/**`, on PRs, and on demand. The runner has no GPU, so the portal is
checked on the WebGL2 fallback (SwiftShader); WebGPU is checked locally.
Actions are pinned to full commit SHAs. Pages deploys independently of CI.

## Conventions and gotchas

- **Content is the owner's, and the owner's two CVs are the source of truth** (kept outside the repo; this file is public on Pages). Every claim on the card (title, proof numbers, employers, toolchain, shell `projects`) must trace to them; no Argo CD (not on the CVs). The email is assembled at runtime (never plain in HTML); phone and city stay off the public page.
- **3D must never block first paint.** `app.js` boots `portal.js` only after `load` + 1.2 s, when the stage is on screen (phones: 15% visible), in an idle slot, or on first touch of the stage. Keep it that way; Lighthouse mobile is 100 because of it.
- **URL pins:** `?webgl=1` (force WebGL2), `?motion=0` (single still frame, also from `prefers-reduced-motion`), `?t=<s>` (pin the clock), `?3d=0` (CSS poster only), `?idle=<ms>` (idle-freeze delay, for tests). `window.c137.portalState()` is a read-only snapshot.
- **Motion:** the PAUSE MOTION control (portal bar) freezes the 3D and every CSS animation (`html.paused`), remembered per device; `prefers-reduced-motion` is honoured live. Required by WCAG 2.2.2 — keep it.
- **Portal budgets** (`BUDGET` in `portal.js`): phones 30 fps / pixel ratio 1.25 / no MSAA / 3 octaves / 900 particles; desktops 60 / 1.5 / MSAA / 4 / 2200. Frame-capped, freezes after 60 s without input, never downloads on data saver, still frame on low battery.
- **Honest labels:** the shell is canned client-side text. Never label it RAG / retrieval / live data — an AI-infra reader checks the source.
- **Portal failures fall back to the CSS poster.** `portal.js` turns three's logged shader/pipeline errors and WebGPU `uncapturederror` during startup into a thrown error.
- **Fallback loop** (`assets/portal-loop.mp4`, `syncLoop()` in `app.js`): where the 3D can't animate — software renderer, the slow-frame watchdog (`onStill`), or a boot error — a pre-rendered loop of the same portal plays over the still/poster. It is fetched only on that path and only while motion is on; never on a live GPU portal, under data saver or `?3d=0`, or with motion off; it pauses off-screen and in hidden tabs. `window.c137.loopState()` exposes it for tests. The service worker deliberately ignores `.mp4`/`.webm` (Range requests). Source and regeneration: `assets/SOURCES.md`.
- **Service worker:** fonts/vendor/icons are cache-first (immutable); everything else network-first with a 3 s budget (then cache; after one timeout the network counts as degraded for 20 s). It only touches caches named `c137-card-*` (the origin is shared with other projects). Bump `VERSION` in `sw.js` when changing a cache-first file or the precache list.
- **Font fallbacks are metric-matched** (`Instrument Fallback`, `Plex Mono Fallback` in `index.html`) so the web-font swap does not move the layout. If a font or the headline copy changes, re-measure `size-adjust` (fontTools, widths of the real copy) — the unmatched serif cost CLS 0.08 live and 0.2 on slow fonts; `tests/` checks it.
- **Contrast tokens** in `:root` (`--mute`, `--mute-2`, `--leaf`, `--leaf-2`) are measured at >= 4.5:1 on every dark surface. Don't use `#5a6f92` (3.7:1) for text.
- **Retrieval windows** duplicate the shell output, so their layer is `aria-hidden` and the close buttons are pointer-only. The shell log (`role="log"`) is the accessible record.
- **Dialogs** use native `<dialog>` + `showModal()` (focus containment, Escape, focus return) with `html:has(dialog[open])` for scroll lock; initial focus via `autofocus`.
- Windows: the repo has `core.autocrlf=true` on the author's machine; files are committed with LF.

## Measured baseline (2026-10-01, local gzip server, Lighthouse 13.5)

Mobile 100 / 100 / 100 / 100, desktop 100 / 100 / 100 / 100; axe-core 0 violations; `tests/` 52 checks (accessibility contract, portal budgets with measured fps, vCard, hanging network, offline with the server down, slow-font CLS).
The live site before this work measured mobile 79 / 96 / 100 / 100, desktop 96 / 100 / 100 / 100.
