// Smoke checks for the site ("The Card"): loads clean at phone and desktop widths,
// the content contract holds, the contact card and QR work, axe finds nothing.
// Run from tests/: npm test   (Chrome from CHROME_PATH, else the usual install paths)
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TITLE = 'Senior SRE & AI Platform Engineer';
const HEADLINE = 'Making AI systems reliable enough for production.';
const PROJECTS = 11;
const STATUSES = ['Live demo', 'Open source', 'In production', 'In daily use'];
// Selected work: these five, in this order, each as Problem / Approach / Evidence.
const FEATURED = ['CMA: Cost Monitoring Agent', 'Aegis', 'FinPulse', 'CISO Agent', 'Autonomous Video Studio: Clay Town'];
// The one deck: these six, in the owner's order.
const DECK = ['Agentic Personal Assistance System', 'Free Kick', 'Crypto Trading Core', 'Prediction-Market Systems',
  'Editorial Automation Platform', 'Happiness bakery'];
// Private or local projects carry a plain muted note, never a status pill.
const NOTES = ['Private repository', 'Client work, unbranded'];
const CASE_TERMS = 'Problem|Approach|Evidence';
// Third-party hosts the page may touch: only the lazy YouTube thumbnail, before any click.
const THIRD_PARTY_OK = /^https:\/\/i\.ytimg\.com\//;
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));


let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

const server = await serve(ROOT, 0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  // 1. Source: the email is never in the HTML; the title is consistent.
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('no email address in index.html', !/@gmail|mailto:/i.test(html));
  check('title tag carries the job title', html.includes(`<title>Oleg Hanukayev — ${TITLE.replace('&', '&amp;')}</title>`));

  // 2. Contact card file.
  const vcf = readFileSync(path.join(ROOT, 'assets', 'oleg-hanukayev.vcf'), 'utf8');
  check('vCard: header, CRLF, title, no phone',
    vcf.startsWith('BEGIN:VCARD\r\n') && vcf.includes(`TITLE:${TITLE}`) && !/^TEL/m.test(vcf));

  // 3. Each width: clean load, no overflow, content contract, axe.
  for (const [width, mobile] of [[390, true], [1440, false]]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: mobile ? 844 : 900, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const thirdParty = [];
    page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) thirdParty.push(r.url()); });
    // the YouTube thumbnail is the one off-site file; offline or blocked, it must not fail the page
    page.on('requestfailed', (r) => THIRD_PARTY_OK.test(r.url()) || errors.push(`failed ${r.url()}`));
    page.on('response', (r) => r.status() >= 400 && !THIRD_PARTY_OK.test(r.url()) && errors.push(`${r.status()} ${r.url()}`));
    const res = await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);

    const s = await page.evaluate((title) => ({
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
      role: [...document.querySelectorAll('#top .who .role')].filter((n) => n.getBoundingClientRect().height > 0).map((n) => n.textContent.trim()),
      fold: ['#h1', '#top .sub', '#top .btn.primary'].map((q) => Math.round(document.querySelector(q)?.getBoundingClientRect().bottom ?? 1e6)),
      primaries: [...document.querySelectorAll('#top .btn.primary')].map((n) => n.textContent.trim()),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rows: document.querySelectorAll('#all-work li.row').length,
      mail: [...document.querySelectorAll('[data-mail]')].every((a) => a.href.startsWith('mailto:')),
      vcf: !!document.querySelector('a[href="assets/oleg-hanukayev.vcf"][download]'),
      fonts: [...document.fonts].filter((f) => f.status === 'loaded').length,
      title: document.title.includes(title),
      text: document.body.innerText,
      statuses: [...document.querySelectorAll('.case .status, .pcard .status')].map((n) => n.textContent.trim()),
      cases: [...document.querySelectorAll('#work .case')].map((c) => ({
        name: c.querySelector('h3').textContent.trim(),
        terms: [...c.querySelectorAll('dl.cs dt')].map((n) => n.textContent.trim()).join('|'),
        thin: [...c.querySelectorAll('dl.cs dd')].filter((n) => n.textContent.trim().length < 40).length,
        collapsedFigs: [...c.querySelectorAll('figure.shot')].filter((f) => f.checkVisibility()).length,
        ratios: [...c.querySelectorAll('.media:not(.nat):not(.yt)')].map((m) => { const r = m.getBoundingClientRect(); return r.width / r.height; }),
      })),
      tabs: document.querySelectorAll('#groups, [data-group-btn], [data-group], #more-work [aria-pressed], #more-work [role="tab"]').length,
      notes: [...document.querySelectorAll('.pnote, .rn')].map((n) => n.textContent.trim()),
      pills: [...document.querySelectorAll('.status, .rs')].filter((n) => /private|local/i.test(n.textContent)).length,
      privLinks: [...document.querySelectorAll('.pcard, .case')].filter((n) => n.querySelector('.pnote') && n.querySelector('a[href*="github.com"]')).length,
      evidence: [...document.querySelector('#d-agentic').closest('.pcard').querySelectorAll('img')].map((i) => `${i.getAttribute('src')}${i.closest('details') ? ':note' : ':card'}`),
      agenticCap: /illustration the assistant generated/.test(document.querySelector('#d-agentic').closest('.pcard').textContent),
      freekick: (() => { const c = document.querySelector('#d-freekick').closest('.pcard'); return `${c.querySelector('img').getAttribute('src')}|${c.querySelector('a.btn.primary')?.textContent.trim().split(' (')[0]}|${c.querySelector('a.btn.primary')?.href}`; })(),
      editorial: document.querySelector('#d-editorial').closest('.pcard').textContent,
      order: [...document.querySelectorAll('main > section')].map((n) => n.id).join(' '),
      deck: [...document.querySelectorAll('#deck .pcard h3')].map((n) => n.textContent.trim()),
      index: [...document.querySelectorAll('#all-work li.row .nm')].map((n) => n.textContent.trim()),
      indexStatus: document.querySelectorAll('#all-work .rs, #all-work .rn, #all-work .status, #all-work .pnote').length,
      indexLinks: [...document.querySelectorAll('#all-work li.row a')].map((a) => a.getAttribute('href')).join(' '),
      indexCols: new Set([...document.querySelectorAll('#all-work li.row')].map((n) => Math.round(n.getBoundingClientRect().left))).size,
      toolsFirst: !!(document.querySelector('#tools').compareDocumentPosition(document.querySelector('#all-work')) & Node.DOCUMENT_POSITION_FOLLOWING),
      html: document.documentElement.outerHTML,
      indexExtras: document.querySelectorAll('#all-work .row ul, #all-work .row .chips, #all-work .row .does').length,
      indexThin: [...document.querySelectorAll('#all-work li.row')].filter((r) => !(r.querySelector('.tag')?.textContent.trim().length > 20)).length,
      toolsH: document.querySelector('#tools h2')?.textContent.trim(),
      toolsN: document.querySelectorAll('#tools .tools li').length,
      nav: [...document.querySelectorAll('.top nav a')].map((a) => `${a.textContent.trim()}>${document.querySelector(a.getAttribute('href')) ? 'ok' : 'dead'}`).join(' '),
      ext: [...document.querySelectorAll('a[href^="http"]')].filter((a) => a.target !== '_blank' || !/\bnoopener\b/.test(a.rel) || !/opens in a new tab/.test(a.textContent)).map((a) => a.href),
      imgs: [...document.querySelectorAll('img')].filter((i) => !i.getAttribute('alt') || !i.getAttribute('width') || !i.getAttribute('height')).map((i) => i.src),
      yt: (() => { const b = document.querySelector('button.yt-facade'); return b ? b.getAttribute('aria-label') : null; })(),
    }), TITLE);
    check(`${width}: page 200 and no errors`, res.status() === 200 && errors.length === 0, errors.slice(0, 3).join(' | '));
    check(`${width}: one H1, the headline offer`, s.h1.length === 1 && s.h1[0] === HEADLINE, s.h1.join(' / '));
    check(`${width}: the job title is visible in the hero`, s.role.length === 1 && s.role[0] === TITLE, s.role.join(' / '));
    check(`${width}: headline, supporting line and the one primary action (Contact) sit in the first viewport`,
      s.fold.every((y) => y > 0 && y <= (mobile ? 844 : 900)) && s.primaries.length === 1 && s.primaries[0] === 'Contact', `bottoms ${s.fold.join(', ')}; ${s.primaries.join('|')}`);
    check(`${width}: no horizontal overflow`, s.overflow === 0, `${s.overflow}px`);
    check(`${width}: all ${PROJECTS} projects in the plain list`, s.rows === PROJECTS, `${s.rows}`);
    check(`${width}: email links assembled, Save contact downloads the vCard`, s.mail && s.vcf);
    check(`${width}: web fonts loaded`, s.fonts >= 4, `${s.fonts} faces`);
    const banned = (s.text.match(/\bcommits\b|tests? passing|\bpaper\b|prototype|private build/gi) || []);
    check(`${width}: no "commits", "tests passing", "paper", "prototype" or "private build" on the page`, banned.length === 0, banned.slice(0, 3).join(', '));
    check(`${width}: sections in order: hero, selected work, deck, tools, index, proof, specs, contact (Tools precedes All work, in the nav too)`,
      s.order === 'top work more-work tools all-work proof specs contact' && s.toolsFirst && /Tools>ok All work>ok/.test(s.nav), `${s.order}; ${s.nav}`);
    const gone = (s.html.match(/trade-?off|cardwatch/gi) || []);
    check(`${width}: no "Trade-off" and no "Cardwatch" anywhere in the document`, gone.length === 0, gone.slice(0, 3).join(', '));
    check(`${width}: Selected work is exactly CMA, Aegis, FinPulse, CISO Agent and the video studio, each with Problem / Approach / Evidence and one figure while collapsed`,
      s.cases.map((c) => c.name).join('|') === FEATURED.join('|') && s.cases.every((c) => c.terms === CASE_TERMS && c.thin === 0 && c.collapsedFigs === 1), JSON.stringify(s.cases.map((c) => [c.name, c.terms, c.thin, c.collapsedFigs])));
    if (!mobile) check('1440: framed case-study screenshots share one 16:10 frame', s.cases.flatMap((c) => c.ratios).length >= 2 && s.cases.flatMap((c) => c.ratios).every((r) => Math.abs(r - 1.6) < 0.02), s.cases.flatMap((c) => c.ratios).map((r) => r.toFixed(2)).join(' '));
    check(`${width}: one deck, no category tabs or filters`, s.tabs === 0, `${s.tabs}`);
    check(`${width}: the deck holds exactly the ${DECK.length} projects in the owner's order, none of them featured`,
      s.deck.join('|') === DECK.join('|') && !s.deck.some((t) => FEATURED.includes(t)), s.deck.join(', '));
    check(`${width}: Free Kick shows the gameplay still and a direct Play it link`, s.freekick === 'assets/work/freekick-match-720.webp|Play it|https://free-kick-demo.pages.dev/', s.freekick);
    check(`${width}: the agentic card shows the morning brief, keeps the health check in its note, and captions the illustration`,
      s.evidence.join(' ') === 'assets/work/assistant-brief-720.webp:card assets/work/assistant-health-480.webp:note' && s.agenticCap, s.evidence.join(' '));
    check(`${width}: private and local projects carry a plain note, not a status pill, and no repo link`,
      s.notes.length >= 4 && s.notes.every((t) => NOTES.includes(t)) && s.pills === 0 && s.privLinks === 0, `${s.notes.join(', ')}; pills ${s.pills}; links ${s.privLinks}`);
    check(`${width}: All work lists the five featured then the six deck projects, with no status elements`, s.index.join(';') === [...FEATURED, ...DECK].join(';') && s.indexStatus === 0, `${s.index.join(';')}; ${s.indexStatus} status elements`);
    check(`${width}: All work links only where a public link exists, in ${mobile ? 'one column' : 'three columns'}`,
      s.indexLinks === 'https://github.com/See-137/CMA https://finpulse.me https://github.com/See-137/ciso-agent https://youtu.be/4vUhPMhUVzk https://free-kick-demo.pages.dev https://happiness-bakery-ayo.pages.dev/' && s.indexCols === (mobile ? 1 : 3), `${s.indexLinks}; ${s.indexCols} columns`);
    check(`${width}: index rows are compact: a one-line descriptor, no bullets or stack chips`, s.indexExtras === 0 && s.indexThin === 0, `${s.indexExtras} extras, ${s.indexThin} without a descriptor`);
    check(`${width}: Engineering tools and experiments keeps its eight tools`, s.toolsH === 'Engineering tools and experiments' && s.toolsN === 8, `${s.toolsH} / ${s.toolsN}`);
    check(`${width}: every nav link has a target`, s.nav.length > 0 && !/dead/.test(s.nav), s.nav);
    check(`${width}: only the four allowed statuses`, s.statuses.length > 0 && s.statuses.every((t) => STATUSES.includes(t)), s.statuses.filter((t) => !STATUSES.includes(t)).join(', '));
    check(`${width}: external links open a new tab with noopener and say so`, s.ext.length === 0, s.ext.slice(0, 3).join(' '));
    check(`${width}: every img has alt text, width and height`, s.imgs.length === 0, s.imgs.slice(0, 3).join(' '));
    check(`${width}: YouTube facade is a named button`, s.yt === 'Play the Clay Town episode: Clyde jumps into GTA 6 on release day', String(s.yt));
    check(`${width}: the editorial platform stays unbranded and nothing claims RAG for it`,
      s.editorial.length > 400 && !/\bRAG\b|retrieval-augmented|In production/i.test(s.editorial), `${s.editorial.length} chars`);
    check(`${width}: nothing loaded from YouTube before a click but the thumbnail`, thirdParty.every((u) => THIRD_PARTY_OK.test(u)), thirdParty.filter((u) => !THIRD_PARTY_OK.test(u)).slice(0, 2).join(' '));

    // QR: visible button opens a modal dialog with the code; Escape closes it.
    const opened = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('[data-open-qr]')].find((b) => b.offsetParent);
      if (!btn) return { ok: false, why: 'no visible Show QR' };
      btn.click();
      const d = document.getElementById('qr-dialog');
      const img = d.querySelector('img');
      return { ok: d.open && !!img, width: img ? img.getBoundingClientRect().width : 0 };
    });
    check(`${width}: Show QR opens the dialog`, opened.ok, opened.why || `${Math.round(opened.width)}px`);
    if (mobile) check('390: QR is large enough to show someone', opened.width >= 300, `${Math.round(opened.width)}px`);
    await page.keyboard.press('Escape');
    check(`${width}: Escape closes the dialog`, await page.evaluate(() => !document.getElementById('qr-dialog').open));

    // The deck: arrow keys move it and announce the position; a link on a card behind brings that card forward.
    if (!mobile) {
      await page.evaluate(() => document.querySelector('#deck .deck-view').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.focus('#deck .deck-view');
      await page.keyboard.press('ArrowRight');
      const key = await page.evaluate(() => ({ ...window.theDeck.state(), live: document.getElementById('deck-live').textContent,
        readout: document.getElementById('readout').textContent }));
      check('1440: ArrowRight moves the deck and the live region says where it is',
        key.active === 1 && key.total === DECK.length && key.live === `Free Kick, card 2 of ${DECK.length}` && /Swipe to aim/.test(key.readout), JSON.stringify([key.active, key.live]));
      const pagesBefore = (await browser.pages()).length;
      const fwd = await page.evaluate(() => {
        const link = document.querySelector('#d-bakery').closest('.pcard').querySelector('a[href^="http"]');
        link.click();
        return { ...window.theDeck.state(), tab: link.tabIndex };
      });
      await new Promise((r) => setTimeout(r, 300));
      check('1440: a link on a background card brings the card forward instead of navigating',
        fwd.active === 5 && fwd.tab === 0 && (await browser.pages()).length === pagesBefore && page.url().startsWith(base), JSON.stringify(fwd));
    } else {
      // swipe left on the deck moves to the next card
      await page.evaluate(() => document.querySelector('#deck .deck-view').scrollIntoView({ block: 'center', behavior: 'instant' }));
      const box = await (await page.$('#deck .pcard.is-active h3')).boundingBox();
      await page.mouse.move(box.x + 200, box.y + 10);
      await page.mouse.down();
      await page.mouse.move(box.x + 60, box.y + 12, { steps: 6 });
      await page.mouse.up();
      const sw = await page.evaluate(() => window.theDeck.state().active);
      check('390: a swipe moves the deck to the next card', sw === 1, `${sw}`);
    }
    // let the deck's card transition finish before axe measures contrast through the dimming layer
    await new Promise((r) => setTimeout(r, 900));

    await page.addScriptTag({ content: AXE });
    const axe = await page.evaluate(async () => (await window.axe.run()).violations.map((v) => v.id));
    check(`${width}: axe finds no violations`, axe.length === 0, axe.join(', '));
    await page.close();
  }

  // Deck: the long text under the deck is collapsed, opens on demand, and stays open across cards.
  {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1440, height: 900 });
    await pg.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
    const st = () => pg.evaluate(() => { const d = document.querySelector('#readout details'); return d ? { open: d.open, items: d.querySelectorAll('li').length, shown: d.querySelector('ul').checkVisibility() } : null; });
    const a = await st();
    check('deck detail collapsed by default', !!a && !a.open && !a.shown && a.items > 0, JSON.stringify(a));
    await pg.evaluate(() => document.querySelector('#readout details > summary').click());
    const b2 = await st();
    await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /next/i.test(x.getAttribute('aria-label') || '')).click());
    await new Promise((r) => setTimeout(r, 300));
    const c = await st();
    check('deck detail opens and stays open on the next card', b2.open && b2.shown && !!c && c.open && c.shown, JSON.stringify([b2, c]));
    await pg.close();
  }

  // Case studies: long text is collapsed by default and opens on demand.
  {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1440, height: 900 });
    await pg.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
    const closed = await pg.evaluate(() => {
      const d = [...document.querySelectorAll('.case details.case-more')];
      return { n: d.length, open: d.filter((x) => x.open).length, hidden: d.every((x) => !x.querySelector('dl.cs').checkVisibility()) };
    });
    check('case studies: 5 collapsed by default', closed.n === 5 && closed.open === 0 && closed.hidden, JSON.stringify(closed));
    await pg.evaluate(() => document.querySelector('.case details.case-more > summary').click());
    const opened = await pg.evaluate(() => {
      const d = document.querySelector('.case details.case-more');
      return { open: d.open, h: Math.round(d.querySelector('dl.cs').getBoundingClientRect().height), dts: d.querySelectorAll('dt').length,
        figs: [...d.closest('.case').querySelectorAll('figure.shot')].filter((f) => f.checkVisibility()).length };
    });
    check('case study opens and shows Problem to Evidence and its second figure', opened.open && opened.h > 100 && opened.dts === 3 && opened.figs === 2, JSON.stringify(opened));
    await pg.close();
  }

  // 4. Without JavaScript the content is all there.
  const nojs = await browser.newPage();
  await nojs.setJavaScriptEnabled(false);
  await nojs.goto(`${base}/index.html`);
  const nj = await nojs.evaluate(() => ({
    rows: document.querySelectorAll('#all-work li.row').length,
    cases: document.querySelectorAll('#work .case dl.cs').length,
    contact: !!document.querySelector('#top a.btn.primary[href="#contact"]') && !!document.querySelector('#contact a[href="assets/oleg-hanukayev.vcf"][download]')
      && !!document.querySelector('#top a[href="https://github.com/See-137"]') && !!document.querySelector('#top a[href^="https://www.linkedin.com/in/"]'),
    facade: !!document.querySelector('a.yt-facade[href="https://youtu.be/4vUhPMhUVzk"][target="_blank"][rel~="noopener"]'),
    ext: [...document.querySelectorAll('a[href^="http"]')].filter((a) => a.target !== '_blank' || !/\bnoopener\b/.test(a.rel) || !/opens in a new tab/.test(a.textContent)).map((a) => a.href),
    names: [...document.querySelectorAll('#all-work li.row .nm')].map((n) => n.textContent.trim()),
    rowsShown: [...document.querySelectorAll('#all-work li.row')].filter((n) => n.checkVisibility() && n.getBoundingClientRect().height > 20).length,
    deckText: document.querySelector('#deck').textContent, // collapsed in native <details>, still present and openable without JS
    deckDetails: document.querySelectorAll('#deck .pc-more > details > summary').length,
  }));
  check('no-JS: the index names all five featured projects and all six deck projects', [...FEATURED, ...DECK].every((n) => nj.names.includes(n)), nj.names.join(', '));
  check('no-JS: the deck cards keep their detail (trading validation, risk and execution)', /Strategy validation/.test(nj.deckText) && /Execution boundaries/.test(nj.deckText) && nj.deckDetails === DECK.length, `${nj.deckDetails} details`);
  check('no-JS: every project still listed and readable', nj.rows === PROJECTS && nj.rowsShown === PROJECTS, `${nj.rows} / ${nj.rowsShown} shown`);
  check('no-JS: the five case studies are there', nj.cases === FEATURED.length, `${nj.cases}`);
  check('no-JS: Contact leads to the contact section; Save contact, GitHub and LinkedIn need no card flip', nj.contact);
  check('no-JS: the episode is a plain link to YouTube', nj.facade);
  check('no-JS: external links open a new tab with noopener and say so', nj.ext.length === 0, nj.ext.slice(0, 3).join(' '));
  await nojs.close();
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
