# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Overview

Personal site for Oleg Hanukayev: a portfolio and a digital business card in one
page, design "The Card" (a headline with a tiltable business card as the hero,
five case studies, six more projects dealt as one deck, every project named
in a plain HTML list). Static site, **no build step**,
hosted on **Cloudflare Pages** (project `oleg-hanukayev`, direct upload) at
https://oleg-hanukayev.pages.dev/ — the canonical URL, which the QR code and vCard point to.
GitHub Pages is switched off for this repo (2026-11-22); the old github.io address no longer serves the site.
A push or merge to `main` therefore deploys nothing by itself: deploy by hand, as below.
Deploy to Cloudflare from a clean copy of the site files only (index.html, 404.html, js/, fonts/, icons/, assets/,
sw.js, manifest.webmanifest): `npx wrangler pages deploy <clean-dir> --project-name oleg-hanukayev --branch main`.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page: all content as static HTML, all CSS inline, meta/OG/JSON-LD. Reads completely with JavaScript off. |
| `404.html` | The not-found page. Cloudflare Pages serves it, with a 404 status, for any address that does not exist (without it, unknown paths return the home page with 200). Root-absolute URLs so it works at any depth; `noindex`. |
| `js/site.js` | Progressive enhancement only: card flip/drag/keys, the project deck (one continuous deck: buttons, swipe, arrow keys, aria-live position; no group tabs or filters), Share, the QR dialog, email assembly into `[data-mail]`, service-worker registration. |
| `fonts/` | Self-hosted latin woff2 (OFL): `archivo-expanded-latin` (variable Archivo fixed at width 116, weights 650-800), `hanken-grotesk-latin-400/600`, `geist-mono-latin-400`. From `@fontsource` 5.3.0. |
| `icons/card-*.png`, `manifest.webmanifest`, `sw.js` | PWA: icons (incl. maskable + apple-touch), manifest, offline service worker. |
| `assets/work/*.webp` | Project stills (review dashboard crop, CMA dashboard, Free Kick gameplay `freekick-match-*`, bakery, the public finpulse.me home page with sample data, the Aegis console on demo data) and the two owner-supplied assistant screenshots (`assistant-brief-*`, `assistant-health-*`). See "Image rules". The Clay Town case study loads YouTube only after a click (thumbnail facade, `youtube-nocookie`). |
| `assets/qr-card.svg` | QR for the site URL in the site palette (black modules, white ground, orange centre mark). If the URL changes, regenerate and verify it decodes. |
| `assets/oleg-hanukayev.vcf` | The contact card, a static file (blob downloads fail in in-app browsers). vCard 3.0, CRLF, stored byte-exact via `.gitattributes`. Precached by the service worker. |
| `assets/og-card-v4.png` | 1200x630 social preview. Rendered from an HTML template with headless Chrome and the site's fonts; when it changes, use a NEW filename (LinkedIn/Slack cache previews by URL) and re-scrape with LinkedIn Post Inspector. |
| `tests/` | Headless regression checks (puppeteer-core + axe-core). Not loaded by the site. |
| `.github/workflows/tests.yml` | CI: runs `tests/` on push / PR. |

The previous design ("C-137 portal": WebGPU portal, shell, vendored three.js) was removed on 2026-11-22; it lives only in git history before tag `v2.0.0`.

## Commands

```bash
# Local preview (from the repo root)
python -m http.server 3137

# Regression checks (from tests/; uses the installed Chrome, CHROME_PATH overrides)
npm ci
npm test

# Deploy (Cloudflare Pages, direct upload; nothing deploys on push):
# 1. merge the PR to main and pull it; 2. copy ONLY the site files (index.html, 404.html, sw.js,
#    manifest.webmanifest, js/, fonts/, icons/, assets/) into a clean scratch folder; 3. upload it:
npx wrangler pages deploy <clean-dir> --project-name oleg-hanukayev --branch main
# then check https://oleg-hanukayev.pages.dev/ (HTTP 200, the new content, the capture sweep).
```

**CI:** `.github/workflows/tests.yml` runs `tests/` on pushes to `main` and
`improve/**`, on PRs, and on demand. Actions are pinned to full commit SHAs.
A deploy is a separate manual step, so a red run does not block one: read it first.

## Page order

1. **Hero** (`#top`): kicker (name + job title), the H1 headline, the supporting line, the primary action, then the card (beside the copy on wide screens, below it on phones).
2. **Selected work** (`#work`): the featured five, in this order: CMA: Cost Monitoring Agent, Aegis, FinPulse, CISO Agent, Autonomous Video Studio: Clay Town. Each is Problem / Approach / Evidence / links, collapsed behind "Read the case study"; only the lead figure shows until it is opened. There is no "Trade-off" row or wording anywhere on the site (owner decision): a caveat that matters (not deployed, demo data, one environment) goes in the muted case note. Aegis has no status pill ("Private repository"; its console runs on demo data), CISO Agent is "Open source". The video studio keeps the word "autonomous" (owner decision), the click-to-load YouTube player and its three links; its copy describes what the engines do and never how publishing is triggered.
3. **More work, dealt** (`#more-work`): ONE deck with no category tabs or filters, exactly these six in this order: Agentic Personal Assistance System, Free Kick, Crypto Trading Core, Prediction-Market Systems, Editorial Automation Platform, Happiness bakery. Each card has one image or diagram, a tagline, stack chips, a status or note, and a collapsed note. The agentic card shows the morning brief; the weekly health check and its English reading sit inside its note. The two trading cards carry four labelled lines: strategy validation, risk controls, execution boundaries, evidence-based testing.
4. **Engineering tools and experiments** (`#tools`): above All work, in the page and in the nav.
5. **All work** (`#all-work`): the minimum: a plain list of the 11 project names (featured five, then the deck six), each with a one-line descriptor; the name is the link where a public link exists. No status column, labels, bullets or chips. Three columns on desktop, two on tablets, one on phones; readable without JavaScript.
6. **Proof**, **Specifications**, **Contact**.

Cardwatch is excluded from the site completely (owner decision): not in the deck, not in the list.

## Conventions and gotchas

- **Content is the owner's.** Identity, title, the three proof figures, employers and the toolchain trace to the owner's two CVs (kept outside the repo; this file is public in the repository). Project cards describe what each system does, not activity: no counts of commits, tests, lines or rules anywhere on the page. Statuses are only Live demo (a public demo or site can be visited), In production (deployed for real operational use), Open source (the source is public) or In daily use (the owner uses it regularly). A private or locally running project gets a plain muted note instead of a pill (`.pnote` on cards and case heads: "Private repository", "Client work, unbranded"; the All work list carries no status at all). The editorial platform carries no "In production" pill while its own repository describes it as running pre-launch with the site on staging. Case-study sentences trace to the project's own README; "Evidence" is a verifiable capability or behaviour, never a count, and never implies commercial production use (CISO Agent is built and tested, not deployed; the Aegis console runs on demo data and its repository is private). There is no CV link: the CVs stay out of the public repo. Do not add a claim, number or link without a source.
- **Employers are described, not named, on the page** (owner decision, 2026-11-22): "Fortune 500 enterprise SaaS", "fast-scaling FinTech (digital-asset custody) and threat-intelligence SaaS companies", "telecom software". Do not reintroduce company names without the owner's say-so.
- **Fixed content rules:** the editorial platform is shown unbranded (no client, brand, domain or org name) and claims no RAG and no agents (its orchestration is cron, a queue and a state machine); the trading projects never show P&L; private projects get no repo link.
- **Image rules:** owner-supplied images are used as supplied (resized to 480/720/960 WebP, new filenames, never substituted with older stills). The lower half of `assistant-brief-*` is an AI-generated illustration the assistant produced: caption it as an illustration and never describe it as the product. `assistant-health-*` is in Hebrew and gets an English reading beside it. Every `<img>` has width, height, lazy loading, srcset and descriptive alt text. Only small stills go in the service-worker precache. The email is assembled at runtime in `js/site.js` (never plain in HTML); phone and city stay off the public page.
- **The repository is public** (since 2026-11-22, so GitHub Actions is free): everything committed on any branch is world-readable. Never commit CVs, keys, phone numbers or client names.
- **One title everywhere:** "Senior SRE & AI Platform Engineer" in the hero kicker, `<title>`, meta, OG, JSON-LD, the card face, the footer, the manifest and the vCard.
- **The H1 is the offer:** "Making AI systems reliable enough for production." The supporting line and the section intros widen it (automation and custom solutions built end to end) using only facts already on the page; the meta descriptions stay in step. The job title sits directly above it in the kicker and must stay visible on the first screen. At 390 x 844 the headline, the supporting line and the primary action fit in the first viewport (tested).
- **One primary action:** Contact, the email link assembled at runtime (without JavaScript it jumps to the contact section). Save contact, GitHub, LinkedIn and the C137 Works site (https://c137-works.pages.dev/, the separate site, repo See-137/c137-works) are secondary and never need the card flipped.
- **One accent:** `#ff5f2e` for marks and the primary button; `#ff7a4d` is its text-safe variant (>= 4.5:1 on every surface). The hero headline is deliberately neutral. No glow.
- **The card is CSS 3D, not WebGL.** It is ordinary page content, so the QR on its back is the real SVG and stays scannable. It rests at a 4 degree tilt; pointer tilt peaks near 8 degrees. `will-change` applies only while it moves so text is sharp at rest.
- **QR on phones:** "Show QR" is visible on touch screens and opens the code at `min(86vw, 420px)` so it can be held out to another person. Keep one label, "Show QR".
- **The deck is the delight, the index is the record.** No project appears more than twice, and no full description is repeated: featured ones are in Selected work and the list, the rest in the deck and the list. A link on a card behind the active one brings that card forward instead of navigating. DOM order matches visual order.
- **Motion:** nothing animates longer than 5 s; `prefers-reduced-motion` is honoured live and the card and deck still work.
- **Dialogs** use native `<dialog>` + `showModal()` (focus containment, Escape, focus return).
- **Service worker:** `/fonts/` and `/icons/` are cache-first (immutable: a changed font or icon needs a NEW filename); everything else is network-first with a 3 s budget (then cache; after one timeout the network counts as degraded for 20 s). It only touches caches named `c137-card-*` (the origin is shared with other projects). Bump `VERSION` in `sw.js` when changing a cache-first file or the precache list.
- **Font fallbacks are metric-matched** (fallback `@font-face` rules in `index.html`) so the web-font swap does not move the layout. If a font or the headline copy changes, re-measure with fontTools against the real copy.
- **Honest labels:** nothing on the page is live data. Do not label static content "live", "real-time" or "AI-powered" unless the source says so.
- Windows: the repo has `core.autocrlf=true` on the author's machine; files are committed with LF.

## Measured baseline (2026-11-21, local gzip server, Lighthouse 13.5.0)

Mobile 99 / 100 / 100 / 100 (LCP 1.6 s, CLS 0, TBT 100 ms), desktop 100 / 100 / 100 / 100;
total transfer 90 KiB; axe-core 0 violations at 390 and 1440 px; the QR decodes at
540, 189 and 108 px and as rendered on the card back and in the dialog; `tests/` 37 checks. After the content revision the same day: mobile and desktop 100 / 100 / 100 / 100, CLS 0.024 mobile. After the review-handoff refinement (2026-11-22, same setup): mobile and desktop 100 / 100 / 100 / 100, CLS 0.001 mobile and 0.006 desktop, mobile transfer 126 KiB; `tests/` 58 checks. After the five-featured restructure (2026-11-22): `tests/` 81 checks. After the 404 page (2026-11-22): `tests/` 85 checks (85 passed, 0 failed).
