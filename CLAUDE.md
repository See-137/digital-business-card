# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Portfolio/digital business card — a single-page site deployed to GitHub Pages (see-137.github.io/digital-business-card).

## Tech Stack

- Vanilla HTML/CSS/JS — no build step, no bundler
- React (Babel CDN transpile) for the Tweaks panel only
- Three.js r128 (CDN) for the vortex background
- Python `http.server` for local dev

## Commands

```bash
# Local dev
python -m http.server 3137

# Deploy: push to main, then trigger Pages build
git push origin main
gh api -X POST repos/See-137/digital-business-card/pages/builds
```

## File Architecture

- **`operator-console.html`** — **the only authoring source**. Never edit `index.html` directly.
- **`index.html`** — always a byte-for-byte copy of operator-console.html. Sync before every commit: `cp operator-console.html index.html`
- **`terminal.js`** — interactive terminal REPL (commands, boot sequence)
- **`projects.js`** — projects strip (expandable rows)
- **`status-board.js`** — live clocks, sparkline, deploy log stream
- **`tweaks-panel.jsx`** — reusable Tweaks UI components (React, Babel)
- **`tweaks-app.jsx`** — Tweaks panel wiring + default config (React, Babel)
- **`vortex-bg.js`** — Three.js vortex background with gravity wells
- **`assets/`** — project screenshots and images

## Key Conventions

### Cache busting
All local scripts use a `?v=N` suffix (e.g. `terminal.js?v=4`). Increment N whenever a script changes or browsers will serve the old cached version.

### Accent / theme system
`data-accent` on `<html>` drives `--accent` CSS variable. Set via three aligned sources — all must agree on the same default (`emerald`):
1. Static HTML attr: `<html data-accent="emerald">`
2. Inline script: `var TWEAK_DEFAULTS = { "accent": "emerald", ... }` — must be `var`, not `const` (needs `window.TWEAK_DEFAULTS`)
3. `tweaks-app.jsx` fallback: `accent: 'emerald'`

### Sections (in order)
`[01] hero` → `[02] glance` → `[02.5] systems` → `[04] stack` → `[05] SAY HI (engage)` → footer

### Projects data
Projects strip is driven by `projects.js` `data` array. The terminal `projects` command in `terminal.js` must stay in sync with this array.

## Deployment Notes

- GitHub Pages **legacy branch mode** (not Actions) — builds don't always trigger automatically on push
- Force a build: `gh api -X POST repos/See-137/digital-business-card/pages/builds`
- Pages source branch: `main`, root directory
