/**
 * Headless regression checks for the card. Run from tests/: `npm test`.
 * Uses the locally installed Chrome (set CHROME_PATH to override).
 *
 * Every check asserts on positive evidence (an element, a count, a backend
 * name), never on "nothing happened".
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const CHROME = process.env.CHROME_PATH
  || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome');
const AXE = readFileSync(path.join(here, 'node_modules/axe-core/axe.min.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failed++;
};

const server = await serve(root);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader'] });

async function open(url, viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport(viewport);
  await page.goto(url, { waitUntil: 'load' });
  return { page, errors };
}

try {
  // 1. Desktop: portal boots on a GPU backend, no console errors, axe clean.
  {
    const { page, errors } = await open(base);
    await page.waitForFunction(() => document.getElementById('portal-wrap').dataset.backend || document.getElementById('portal-wrap').dataset.fallback, { timeout: 15000 });
    const state = await page.evaluate(() => ({
      backend: document.getElementById('portal-wrap').dataset.backend || null,
      fallback: document.getElementById('portal-wrap').dataset.fallback || null,
      on: document.getElementById('portal-canvas').classList.contains('on'),
      chips: document.querySelectorAll('#stack-chips li').length,
    }));
    check('portal boots on webgpu or webgl', ['webgpu', 'webgl'].includes(state.backend) && state.on, JSON.stringify(state));
    check('stack chips rendered', state.chips === 18, `${state.chips}`);

    for (const c of ['about', 'projects', 'stack']) {
      await page.type('#cc-term', c);
      await page.keyboard.press('Enter');
    }
    await page.addScriptTag({ content: AXE });
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run(document);
      return { passes: r.passes.length, violations: r.violations.map((v) => `${v.id}:${v.nodes.length}`) };
    });
    check('axe: 0 violations', axe.violations.length === 0 && axe.passes > 30, `passes=${axe.passes} ${axe.violations.join(' ')}`);
    check('no console errors (desktop)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // 2. Shell: completion, history, Tab never traps.
  {
    const { page } = await open(`${base}?3d=0`);
    const r = await page.evaluate(() => {
      const inp = document.getElementById('cc-term');
      const key = (k, extra = {}) => {
        const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra });
        inp.dispatchEvent(e);
        return e.defaultPrevented;
      };
      const out = {};
      inp.value = 'who'; out.tabTaken = key('Tab'); out.who = inp.value; key('Enter');
      inp.value = 'op'; key('Tab'); out.op = inp.value;
      inp.value = 'xyz'; out.noMatchTaken = key('Tab');
      inp.value = 'st'; out.shiftTaken = key('Tab', { shiftKey: true });
      inp.value = ''; key('Enter'); key('ArrowUp'); out.up = inp.value;
      return out;
    });
    check('Tab completes a unique command', r.tabTaken && r.who === 'whoami', r.who);
    check('Tab completes the common prefix', r.op === 'open ', JSON.stringify(r.op));
    check('Tab is not captured without a match or with Shift', !r.noMatchTaken && !r.shiftTaken);
    check('ArrowUp recalls the latest command after an empty Enter', r.up === 'whoami', r.up);
    await page.close();
  }

  // 2b. Accessibility contract beyond axe: motion can be paused, focus follows
  // a jump, the shell log is keyboard-scrollable, Tab never traps, Esc clears,
  // announcements reach a live region, landmarks and honest labels.
  {
    const { page } = await open(base);
    await page.waitForFunction(() => document.getElementById('portal-wrap').dataset.backend || document.getElementById('portal-wrap').dataset.fallback, { timeout: 15000 });
    await page.click('#motion-btn');
    const paused = await page.evaluate(() => ({
      cls: document.documentElement.classList.contains('paused'),
      pressed: document.getElementById('motion-btn').getAttribute('aria-pressed'),
      label: document.querySelector('#motion-btn .motion-label').textContent,
      stored: localStorage.getItem('c137-motion'),
      anim: getComputedStyle(document.querySelector('.kicker span span')).animationPlayState,
    }));
    check('pause motion freezes CSS animations and is remembered', paused.cls && paused.pressed === 'true' && paused.anim === 'paused' && paused.stored === 'paused', JSON.stringify(paused));
    await page.click('#motion-btn');
    const resumed = await page.evaluate(() => document.documentElement.classList.contains('paused'));
    check('pause motion toggles back on', !resumed);

    await page.click('.jbtn[data-dest="stack"]');
    await page.waitForFunction(() => document.activeElement?.id === 'stack-h', { timeout: 4000 }).catch(() => {});
    const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    check('a portal jump moves focus to the section heading', focused === 'stack-h', focused);

    const r = await page.evaluate(() => {
      const log = document.getElementById('term-scroll');
      const inp = document.getElementById('cc-term');
      const key = (k) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); inp.dispatchEvent(e); return e.defaultPrevented; };
      const out = {
        logFocusable: log.tabIndex === 0,
        promptOutsideLog: !log.contains(inp),
        introStatic: document.querySelectorAll('#term-lines .ln').length >= 2,
      };
      inp.value = 'h'; out.firstTab = key('Tab'); out.secondTab = key('Tab');
      inp.value = 'stack'; out.esc = key('Escape'); out.cleared = inp.value === '';
      out.footerOutsideMain = !document.querySelector('main footer') && Boolean(document.querySelector('body > footer'));
      const visible = document.body.innerText;
      out.ragClaims = (visible.match(/RAG ACTIVE|retrieval engine|retrieved (via|through)/gi) || []).length;
      out.domOrderPhoneFirst = document.getElementById('save-btn').compareDocumentPosition(document.querySelector('.cta')) & Node.DOCUMENT_POSITION_FOLLOWING ? true : false;
      return out;
    });
    check('shell log is keyboard-focusable and the prompt sits outside it', r.logFocusable && r.promptOutsideLog && r.introStatic, JSON.stringify(r));
    check('Tab lists options once, then releases focus', r.firstTab === true && r.secondTab === false, `${r.firstTab}/${r.secondTab}`);
    check('Escape clears the prompt', r.esc && r.cleared);
    check('footer is its own landmark (outside main)', r.footerOutsideMain);
    check('no RAG / retrieval claims in visible text', r.ragClaims === 0, `${r.ragClaims}`);
    check('tab order: Save contact comes before the CTAs (matches the layout)', r.domOrderPhoneFirst);

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    });
    await page.click('#share-btn');
    await new Promise((res) => setTimeout(res, 300));
    const fail = await page.evaluate(() => ({
      sr: document.getElementById('sr-status').textContent,
      sticky: document.getElementById('toast').classList.contains('sticky'),
    }));
    await new Promise((res) => setTimeout(res, 3000));
    const still = await page.evaluate(() => document.getElementById('toast').classList.contains('show'));
    check('failure is announced to screen readers and stays on screen', /Copy failed/.test(fail.sr) && fail.sticky && still, JSON.stringify({ ...fail, stillShown: still }));
    await page.close();
  }

  // 2c. Portal budgets: desktop 60 fps / phone 30 fps with lower ceilings,
  // measured frame rate stays under the cap, the loop freezes when idle and
  // resumes on input, and data saver never downloads the 3D.
  {
    const bootAndWait = async (page) => {
      await page.evaluate(() => document.getElementById('portal-wrap').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
      await page.waitForFunction(() => window.c137.portalState()?.running, { timeout: 15000 });
    };
    const fpsOver = async (page, ms) => {
      const a = await page.evaluate(() => window.c137.portalState().frames);
      await new Promise((r) => setTimeout(r, ms));
      const b = await page.evaluate(() => window.c137.portalState().frames);
      return ((b - a) * 1000) / ms;
    };

    const { page: d } = await open(base);
    await bootAndWait(d);
    const ds = await d.evaluate(() => window.c137.portalState());
    const dFps = await fpsOver(d, 2000);
    check('desktop budget: 60 fps cap, pixel ratio <= 1.5, MSAA, 4 octaves', ds.fps === 60 && ds.maxPr === 1.5 && ds.antialias && ds.octaves === 4, JSON.stringify(ds));
    check('desktop renders frames, never above the cap', dFps > 5 && dFps <= 63, `${dFps.toFixed(1)} fps`);
    await d.close();

    const { page: m } = await open(`${base}?idle=1500`, { width: 390, height: 844, isMobile: true, hasTouch: true });
    await m.evaluate(() => window.scrollTo({ top: document.getElementById('portal-stage').offsetTop, behavior: 'instant' }));
    await bootAndWait(m);
    const ms = await m.evaluate(() => window.c137.portalState());
    const mFps = await fpsOver(m, 1000);
    check('phone budget: 30 fps cap, pixel ratio <= 1.25, no MSAA, 3 octaves, 900 motes', ms.fps === 30 && ms.maxPr === 1.25 && !ms.antialias && ms.octaves === 3 && ms.motes === 900, JSON.stringify(ms));
    check('phone renders frames, never above 30 fps', mFps > 3 && mFps <= 32, `${mFps.toFixed(1)} fps`);
    await new Promise((r) => setTimeout(r, 1200)); // idle pin is 1.5 s
    const idle = await m.evaluate(() => window.c137.portalState());
    const frozenAt = idle.frames;
    await new Promise((r) => setTimeout(r, 600));
    const stillFrozen = (await m.evaluate(() => window.c137.portalState().frames)) === frozenAt;
    await m.mouse.move(120, 300);
    await m.mouse.move(160, 340);
    await new Promise((r) => setTimeout(r, 600));
    const woke = await m.evaluate(() => window.c137.portalState());
    check('idle: the loop freezes with no input', idle.idle && !idle.running && stillFrozen, JSON.stringify({ idle: idle.idle, running: idle.running, stillFrozen }));
    check('idle: input resumes the loop', !woke.idle && woke.running && woke.frames > frozenAt, JSON.stringify({ idle: woke.idle, running: woke.running, frames: woke.frames - frozenAt }));
    await m.close();

    const ctx = await browser.createBrowserContext();
    const sd = await ctx.newPage();
    await sd.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }));
    await sd.goto(base, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 2500));
    const sdr = await sd.evaluate(() => ({
      fallback: document.getElementById('portal-wrap').dataset.fallback || null,
      three: performance.getEntriesByType('resource').filter((e) => e.name.includes('vendor/three')).length,
    }));
    check('data saver: no 3D download, poster shown', sdr.fallback === '1' && sdr.three === 0, JSON.stringify(sdr));
    await ctx.close();
  }

  // 2d. Contact card: a real .vcf (blob downloads fail in in-app browsers),
  // valid vCard 3.0 with CRLF line endings and profile fields, linked from both
  // save controls and requested by the shell's vcard command.
  {
    const res = await fetch(`${base}assets/oleg-hanukayev.vcf`);
    const text = await res.text();
    const lines = text.split('\r\n');
    check('vcf is served as text/vcard', res.status === 200 && /text\/vcard/.test(res.headers.get('content-type') || ''), `${res.status} ${res.headers.get('content-type')}`);
    check('vcf is vCard 3.0 with CRLF endings', lines[0] === 'BEGIN:VCARD' && lines.includes('VERSION:3.0') && lines.includes('END:VCARD') && !/[^\r]\n/.test(text), `${lines.length} lines`);
    check('vcf carries name, title and LinkedIn/GitHub profiles', lines.includes('FN:Oleg Hanukayev') && lines.some((l) => l.startsWith('TITLE:')) && lines.some((l) => l.startsWith('X-SOCIALPROFILE;TYPE=linkedin:')) && lines.some((l) => l.startsWith('X-SOCIALPROFILE;TYPE=github:')));

    const { page } = await open(`${base}?3d=0`);
    const links = await page.evaluate(() => ['save-btn', 'vcard-btn'].map((id) => {
      const el = document.getElementById(id);
      return `${el.tagName}:${el.getAttribute('href')}`;
    }));
    check('both save controls link to the static file', links.every((l) => l === 'A:assets/oleg-hanukayev.vcf'), links.join(' '));
    const requested = new Promise((resolve) => {
      page.on('request', (r) => { if (r.url().endsWith('/assets/oleg-hanukayev.vcf')) resolve(true); });
      setTimeout(() => resolve(false), 4000);
    });
    await page.evaluate(() => {
      const inp = document.getElementById('cc-term');
      inp.value = 'vcard';
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    check('the shell vcard command requests the file', await requested);
    await page.close();
  }

  // 3. QR dialog contract: modal, initial focus, scroll lock, focus return.
  {
    const { page } = await open(`${base}?3d=0`);
    await page.focus('#qr-btn');
    await page.click('#qr-btn');
    const opened = await page.evaluate(() => ({
      open: document.getElementById('qr-dialog').open,
      focus: document.activeElement?.textContent.trim(),
      lock: getComputedStyle(document.documentElement).overflow,
      img: document.querySelector('#qr-dialog img').naturalWidth,
    }));
    check('QR dialog opens modal with focus on Close', opened.open && opened.focus === 'Close', JSON.stringify(opened));
    check('QR image loaded', opened.img > 0, `${opened.img}px`);
    check('page scroll locked while open', opened.lock === 'hidden', opened.lock);
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(() => ({
      open: document.getElementById('qr-dialog').open,
      returned: document.activeElement?.id,
      lock: getComputedStyle(document.documentElement).overflow,
    }));
    check('Escape closes, focus returns, scroll unlocks', !closed.open && closed.returned === 'qr-btn' && closed.lock !== 'hidden', JSON.stringify(closed));

    // Feedback inside the dialog must be visible: the toast goes to the top layer.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
    });
    await page.click('#qr-btn');
    await page.click('#qr-copy');
    const t = await page.evaluate(() => ({
      text: document.getElementById('toast').textContent,
      topLayer: document.getElementById('toast').matches(':popover-open'),
      dialogOpen: document.getElementById('qr-dialog').open,
    }));
    check('copy feedback shows above the open dialog', t.topLayer && t.dialogOpen && /copied/i.test(t.text), JSON.stringify(t));
    await page.close();
  }

  // 4. Phone-first: save / share / QR above the fold, no overflow at any width.
  {
    const { page } = await open(`${base}?3d=0`, { width: 375, height: 667, isMobile: true, hasTouch: true });
    const r = await page.evaluate(() => ['save-btn', 'share-btn', 'qr-btn'].map((id) => document.getElementById(id).getBoundingClientRect().bottom <= innerHeight));
    check('save / share / QR above the fold at 375x667', r.every(Boolean), JSON.stringify(r));
    await page.close();
    for (const width of [320, 375, 768, 1024, 1440]) {
      const { page: p } = await open(`${base}?3d=0`, { width, height: 900 });
      const ox = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`no horizontal overflow at ${width}px`, ox === 0, `${ox}px`);
      await p.close();
    }
  }

  // 4b. Font swap must not move the layout (it cost CLS 0.08 live): with web
  // fonts held back 1.5 s on a phone, the summed layout shift stays tiny.
  // Proof the fonts really arrived late is part of the check.
  {
    const slow = await serve(root, 0, { fontDelayMs: 1500 });
    const { page } = await open(`http://127.0.0.1:${slow.address().port}/?3d=0`, { width: 375, height: 667, isMobile: true, hasTouch: true });
    const r = await page.evaluate(async () => {
      let cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; })
        .observe({ type: 'layout-shift', buffered: true });
      await document.fonts.ready;
      await new Promise((res) => setTimeout(res, 400));
      const font = performance.getEntriesByType('resource').find((e) => e.name.endsWith('instrument-serif-400.woff2'));
      return { cls, fontMs: Math.round(font ? font.responseEnd - font.startTime : -1) };
    });
    check('fonts were really delayed', r.fontMs >= 1400, `${r.fontMs} ms`);
    check('font swap causes no layout shift on a phone (CLS < 0.02)', r.cls < 0.02, r.cls.toFixed(4));
    await page.close();
    slow.close();
  }

  // 5. Fallbacks: ?3d=0 never fetches three.js and shows the poster; ?webgl=1 renders on WebGL2.
  {
    const { page } = await open(`${base}?3d=0`);
    await new Promise((r) => setTimeout(r, 2500));
    const r = await page.evaluate(() => ({
      fallback: document.getElementById('portal-wrap').dataset.fallback,
      hidden: document.getElementById('portal-canvas').hidden,
      three: performance.getEntriesByType('resource').filter((e) => e.name.includes('vendor/three')).length,
    }));
    check('?3d=0 shows the poster and loads no three.js', r.fallback === '1' && r.hidden && r.three === 0, JSON.stringify(r));
    await page.close();

    const { page: g, errors } = await open(`${base}?webgl=1`);
    await g.waitForFunction(() => document.getElementById('portal-wrap').dataset.backend || document.getElementById('portal-wrap').dataset.fallback, { timeout: 15000 });
    const b = await g.evaluate(() => document.getElementById('portal-wrap').dataset.backend);
    check('?webgl=1 renders on the WebGL2 backend', b === 'webgl', b);
    check('no console errors (webgl)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await g.close();
  }
  // 6. Offline (last: it shuts the server down). The service worker must
  // serve the card with the server GONE, so a pass cannot come from the
  // network (DevTools offline emulation does not reach the worker's fetches).
  // Opening another file as a page first must not overwrite the cached card.
  {
    const { page } = await open(`${base}?3d=0`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'load' }); // now controlled
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    check('service worker controls the page', controlled);

    // A network that hangs (connection accepted, no answer) must fall back to
    // the cache within the worker's 3 s budget, not the TCP timeout.
    server.state.hang = true;
    const t0 = Date.now();
    const navErr = await page.goto(`${base}?3d=0`, { waitUntil: 'domcontentloaded', timeout: 15000 }).then(() => '', (e) => String(e).slice(0, 120));
    const hangMs = Date.now() - t0;
    const hangTitle = await page.title().catch((e) => `title error: ${e}`);
    const hung = server.state.hung;
    server.state.hang = false;
    check('the server really hung the request', hung >= 1, `${hung} hung`);
    check('hanging network falls back to the cached card within ~3 s', /Oleg Hanukayev/.test(hangTitle) && hangMs < 6000, `${hangMs} ms; title="${hangTitle.slice(0, 40)}"; nav="${navErr}"`);

    await page.goto(`${base}manifest.webmanifest`, { waitUntil: 'load' });
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    const direct = await fetch(base).then(() => 'reachable', () => 'down');
    await page.goto(`${base}?3d=0`, { waitUntil: 'load' }).catch(() => {});
    const off = await page.evaluate(() => ({
      title: document.title,
      save: Boolean(document.getElementById('save-btn')),
    })).catch((e) => ({ error: String(e) }));
    check('server is really down for the offline check', direct === 'down', direct);
    check('card loads offline from the cache, not overwritten by another page', /Oleg Hanukayev/.test(off.title || '') && off.save, JSON.stringify(off));
    const vcfOffline = await page.evaluate(async () => {
      try {
        const r = await fetch('assets/oleg-hanukayev.vcf');
        return { status: r.status, card: (await r.text()).startsWith('BEGIN:VCARD') };
      } catch (e) {
        return { error: String(e) };
      }
    });
    check('contact card is available offline', vcfOffline.status === 200 && vcfOffline.card, JSON.stringify(vcfOffline));
    await page.close();
  }
} catch (err) {
  failed++;
  console.log(`FAIL  suite aborted: ${String(err).slice(0, 300)}`);
} finally {
  server.closeAllConnections?.();
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 10000))]);
  if (server.listening) server.close();
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exitCode = failed ? 1 : 0;
