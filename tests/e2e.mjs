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
const PROJECTS = 13;
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
    page.on('requestfailed', (r) => errors.push(`failed ${r.url()}`));
    page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
    const res = await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);

    const s = await page.evaluate((title) => ({
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rows: document.querySelectorAll('#all-work li.row').length,
      mail: [...document.querySelectorAll('[data-mail]')].every((a) => a.href.startsWith('mailto:')),
      vcf: !!document.querySelector('a[href="assets/oleg-hanukayev.vcf"][download]'),
      fonts: [...document.fonts].filter((f) => f.status === 'loaded').length,
      title: document.title.includes(title),
    }), TITLE);
    check(`${width}: page 200 and no errors`, res.status() === 200 && errors.length === 0, errors.slice(0, 3).join(' | '));
    check(`${width}: one H1: name, then the job title`, s.h1.length === 1 && s.h1[0] === `Oleg Hanukayev ${TITLE}`, s.h1.join(' / '));
    check(`${width}: no horizontal overflow`, s.overflow === 0, `${s.overflow}px`);
    check(`${width}: all ${PROJECTS} projects in the plain list`, s.rows === PROJECTS, `${s.rows}`);
    check(`${width}: email links assembled, Save contact downloads the vCard`, s.mail && s.vcf);
    check(`${width}: web fonts loaded`, s.fonts >= 4, `${s.fonts} faces`);

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

    await page.addScriptTag({ content: AXE });
    const axe = await page.evaluate(async () => (await window.axe.run()).violations.map((v) => v.id));
    check(`${width}: axe finds no violations`, axe.length === 0, axe.join(', '));
    await page.close();
  }

  // 4. Without JavaScript the content is all there.
  const nojs = await browser.newPage();
  await nojs.setJavaScriptEnabled(false);
  await nojs.goto(`${base}/index.html`);
  const rows = await nojs.evaluate(() => document.querySelectorAll('#all-work li.row').length);
  check('no-JS: every project still listed', rows === PROJECTS, `${rows}`);
  await nojs.close();
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
