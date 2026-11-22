# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Overview

Personal site for Oleg Hanukayev: a portfolio and a digital business card in one
page, design "The Card" (a headline with a tiltable business card as the hero,
three case studies, the rest of the work dealt as a deck, every project listed
in a plain HTML index). Static site, **no build step**,
deployed by GitHub Pages (legacy branch mode, `main`, repo root) to
https://see-137.github.io/digital-business-card/.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page: all content as static HTML, all CSS inline, meta/OG/JSON-LD. The only HTML. Reads completely with JavaScript off. |
| `js/site.js` | Progressive enhancement only: card flip/drag/keys, the project deck (buttons, swipe, arrow keys, group tabs, aria-live position), Share, the QR dialog, email assembly into `[data-mail]`, service-worker registration. |
| `fonts/` | Self-hosted latin woff2 (OFL): `archivo-expanded-latin` (variable Archivo fixed at width 116, weights 650-800), `hanken-grotesk-latin-400/600`, `geist-mono-latin-400`. From `@fontsource` 5.3.0. |
| `icons/card-*.png`, `manifest.webmanifest`, `sw.js` | PWA: icons (incl. maskable + apple-touch), manifest, offline service worker. |
| `assets/work/*.webp` | Project stills for the cards (review dashboard crop, CMA dashboard, Free Kick, bakery, the public finpulse.me home page with sample data, the Aegis console prototype on demo data). No personal data or third-party headlines; precached. The Clay Town card loads YouTube only after a click (thumbnail facade, `youtube-nocookie`). |
| `assets/qr-card.svg` | QR for the site URL in the site palette (black modules, white ground, orange centre mark). If the URL changes, regenerate and verify it decodes. |
| `assets/oleg-hanukayev.vcf` | The contact card, a static file (blob downloads fail in in-app browsers). vCard 3.0, CRLF, stored byte-exact via `.gitattributes`. Precached by the service worker. |
| `assets/og-card-v3.png` | 1200x630 social preview. Rendered from an HTML template with headless Chrome and the site's fonts; when it changes, use a NEW filename (LinkedIn/Slack cache previews by URL) and re-scrape with LinkedIn Post Inspector. |
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

# Deploy: merge to main, then WAIT for the push-triggered Pages build. Only if
# none appears within ~2 min, force one (a POST right after a push cancels the
# push's build, which then reports "Page build failed").
gh api repos/See-137/digital-business-card/pages/builds/latest --jq '.commit[0:7] + " " + .status'
gh api -X POST repos/See-137/digital-business-card/pages/builds   # only if needed
```

**CI:** `.github/workflows/tests.yml` runs `tests/` on pushes to `main` and
`improve/**`, on PRs, and on demand. Actions are pinned to full commit SHAs.
Pages deploys independently of CI, so a red run does not block a deploy: read it.

## Page order

1. **Hero** (`#top`): kicker (name + job title), the H1 headline, the supporting line, the primary action, then the card (beside the copy on wide screens, below it on phones).
2. **Selected work** (`#work`): CMA, Aegis, CISO Agent, in that order, each as Problem / Approach / Trade-off / Evidence / links.
3. **More work, dealt** (`#more-work`): the deck, holding the ten projects that are not featured.
4. **All work** (`#all-work`): the compact index of all 13 projects: name, one-line descriptor, status, one link. No bullets or stack chips.
5. **Engineering tools and experiments** (`#tools`), **Proof**, **Specifications**, **Contact**.

## Conventions and gotchas

- **Content is the owner's.** Identity, title, the three proof figures, employers and the toolchain trace to the owner's two CVs (kept outside the repo; this file is public on Pages). Project cards describe what each system does, not activity: no counts of commits, tests, lines or rules anywhere on the page. Statuses are only Live demo (a public demo or site can be visited), In production (deployed for real operational use), Open source (the source is public) or In daily use (the owner uses it regularly); a project that fits none has no status. Case-study sentences trace to the project's own README; "Evidence" is a verifiable capability or behaviour, never a count, and never implies commercial production use (CISO Agent is built and tested, not deployed; the Aegis console runs on demo data and its repository is private). There is no CV link: the CVs stay out of the public repo. Do not add a claim, number or link without a source.
- **Fixed content rules:** the editorial platform is shown unbranded (no client, brand, domain or org name); the trading projects never show P&L; private projects get no repo link. The email is assembled at runtime in `js/site.js` (never plain in HTML); phone and city stay off the public page.
- **The repository is public** (since 2026-11-22, so GitHub Actions is free): everything committed on any branch is world-readable. Never commit CVs, keys, phone numbers or client names.
- **Production order** (All work; the deck keeps the same relative order for the cards it holds), set by the owner: FinPulse, CMA, Aegis, Editorial Automation Platform, CISO Agent.
- **One title everywhere:** "Senior SRE & AI Platform Engineer" in the hero kicker, `<title>`, meta, OG, JSON-LD, the card face, the footer, the manifest and the vCard.
- **The H1 is the offer:** "Making AI systems reliable enough for production." The job title sits directly above it in the kicker and must stay visible on the first screen. At 390 x 844 the headline, the supporting line and the primary action fit in the first viewport (tested).
- **One primary action:** Contact, the email link assembled at runtime (without JavaScript it jumps to the contact section). Save contact, GitHub and LinkedIn are secondary and never need the card flipped.
- **One accent:** `#ff5f2e` for marks and the primary button; `#ff7a4d` is its text-safe variant (>= 4.5:1 on every surface). The hero headline is deliberately neutral. No glow.
- **The card is CSS 3D, not WebGL.** It is ordinary page content, so the QR on its back is the real SVG and stays scannable. It rests at a 4 degree tilt; pointer tilt peaks near 8 degrees. `will-change` applies only while it moves so text is sharp at rest.
- **QR on phones:** "Show QR" is visible on touch screens and opens the code at `min(86vw, 420px)` so it can be held out to another person. Keep one label, "Show QR".
- **The deck is the delight, the index is the record.** No project appears more than twice: featured ones in Selected work and the index, the rest in the deck and the index. DOM order matches visual order.
- **Motion:** nothing animates longer than 5 s; `prefers-reduced-motion` is honoured live and the card and deck still work.
- **Dialogs** use native `<dialog>` + `showModal()` (focus containment, Escape, focus return).
- **Service worker:** `/fonts/` and `/icons/` are cache-first (immutable: a changed font or icon needs a NEW filename); everything else is network-first with a 3 s budget (then cache; after one timeout the network counts as degraded for 20 s). It only touches caches named `c137-card-*` (the origin is shared with other projects). Bump `VERSION` in `sw.js` when changing a cache-first file or the precache list.
- **Font fallbacks are metric-matched** (fallback `@font-face` rules in `index.html`) so the web-font swap does not move the layout. If a font or the headline copy changes, re-measure with fontTools against the real copy.
- **Honest labels:** nothing on the page is live data. Do not label static content "live", "real-time" or "AI-powered" unless the source says so.
- Windows: the repo has `core.autocrlf=true` on the author's machine; files are committed with LF.

## Measured baseline (2026-11-21, local gzip server, Lighthouse 13.5.0)

Mobile 99 / 100 / 100 / 100 (LCP 1.6 s, CLS 0, TBT 100 ms), desktop 100 / 100 / 100 / 100;
total transfer 90 KiB; axe-core 0 violations at 390 and 1440 px; the QR decodes at
540, 189 and 108 px and as rendered on the card back and in the dialog; `tests/` 37 checks. After the content revision the same day: mobile and desktop 100 / 100 / 100 / 100, CLS 0.024 mobile. After the review-handoff refinement (2026-11-22, same setup): mobile and desktop 100 / 100 / 100 / 100, CLS 0.001 mobile and 0.006 desktop, mobile transfer 126 KiB; `tests/` 58 checks.
