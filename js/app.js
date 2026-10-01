/**
 * Card behaviour: toolchain groups, email, vCard, the c137 shell, portal retrieval windows,
 * section jumps, and the lazy boot of the 3D portal (js/portal.js).
 *
 * The 3D never blocks first paint: it loads after `load`, when the stage is
 * near the viewport and the main thread is idle (or on first touch of the
 * stage). Until then the stage shows a CSS poster of the vortex.
 */
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const tPin = q.has('t') ? Number(q.get('t')) : undefined;
const pins = {
  webgl: q.get('webgl') === '1',
  still: q.get('motion') === '0',
  t: Number.isFinite(tPin) ? tPin : undefined,
  no3d: q.get('3d') === '0',
  idleMs: q.has('idle') ? Number(q.get('idle')) : undefined, // test pin
};

/* ---------------------------------------------------------------- toolchain */
// Mirrors the skills section of the CV (the source of truth for claims).
const STACK = [
  ['Cloud & infra', ['AWS (EKS, EC2, RDS, S3, Lambda, DynamoDB)', 'GCP (GKE Autopilot)', 'Kubernetes', 'Terraform', 'Docker', 'Helm']],
  ['Reliability', ['SLOs & error budgets', 'Incident command', 'On-call & DR drills', 'Datadog', 'Grafana', 'ELK']],
  ['Delivery', ['Jenkins', 'GitHub Actions', 'GitOps', 'Blue/green deploys', 'n8n']],
  ['AI platform', ['RAG pipelines', 'AI agents & MCP', 'Amazon Bedrock', 'Anthropic · OpenAI · Groq APIs', 'Ollama', 'vLLM', 'Langfuse', 'LangSmith', 'Qdrant', 'pgvector']],
  ['Code & data', ['Python', 'TypeScript', 'Bash', 'PowerShell', 'PostgreSQL', 'Redis']],
];
const stackEl = $('stack-groups');
for (const [group, items] of STACK) {
  const row = document.createElement('div');
  row.className = 'tg';
  const h = document.createElement('h3');
  h.className = 'tg-h';
  h.textContent = group;
  const ul = document.createElement('ul');
  ul.className = 'tools';
  for (const name of items) {
    const li = document.createElement('li');
    li.className = 'tool';
    li.textContent = name;
    ul.appendChild(li);
  }
  row.append(h, ul);
  stackEl.appendChild(row);
}

/* ---------------------------------------------------------------- email */
// Assembled at runtime so the address is not in the HTML for scrapers.
const EMAIL = ['oleghanukayev', 'gmail.com'].join('@');
for (const a of document.querySelectorAll('[data-mail]')) a.href = `mailto:${EMAIL}`;
for (const t of document.querySelectorAll('[data-mail-text]')) t.textContent = EMAIL;

/* ---------------------------------------------------------------- vCard */
// A real file, not a generated blob: blob downloads fail silently in the
// LinkedIn / Instagram in-app browsers, where recruiters land. iOS opens a
// .vcf link as a contact preview; desktops and Android download it. The
// service worker precaches it, so it also works offline.
const VCF_URL = 'assets/oleg-hanukayev.vcf';
export function openVcard() {
  const a = document.createElement('a');
  a.href = VCF_URL;
  a.type = 'text/vcard';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------------------------------------------------------------- share · QR · toast */
const CARD_URL = 'https://see-137.github.io/digital-business-card/';
const qrDialog = $('qr-dialog');
const toastEl = $('toast');
let toastT, announceT;

/**
 * Screen-reader announcement through an always-rendered live region. Inside
 * the modal QR dialog the page behind is inert, so the dialog has its own.
 */
function announce(msg) {
  const region = qrDialog.open ? $('qr-status') : $('sr-status');
  region.textContent = '';
  clearTimeout(announceT);
  announceT = setTimeout(() => { region.textContent = msg; }, 60);
}

function hideToast() {
  toastEl.classList.remove('show', 'sticky');
  if (toastEl.matches?.(':popover-open')) toastEl.hidePopover();
}
toastEl.addEventListener('click', hideToast);

/**
 * Visual toast (a manual popover, so it shows above an open modal dialog).
 * Errors are sticky: they stay until clicked or replaced (WCAG 2.2.1), so a
 * link printed in one can be read and selected.
 */
function toast(msg, { sticky = false } = {}) {
  toastEl.textContent = msg;
  if (toastEl.showPopover) {
    if (toastEl.matches(':popover-open')) toastEl.hidePopover();
    toastEl.showPopover();
  }
  toastEl.classList.add('show');
  toastEl.classList.toggle('sticky', sticky);
  announce(msg);
  clearTimeout(toastT);
  toastT = setTimeout(hideToast, sticky ? 12000 : 2600);
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toastEl.classList.contains('sticky')) hideToast();
});

async function copyLink() {
  try {
    await navigator.clipboard.writeText(CARD_URL);
    toast('Link copied ✦');
    return true;
  } catch {
    toast('Copy failed — the link is see-137.github.io/digital-business-card', { sticky: true });
    return false;
  }
}

/** Native share sheet where there is one (phones); otherwise copy the link. */
async function shareCard() {
  const data = { title: 'Oleg Hanukayev — Senior SRE & AI Platform Engineer', text: 'Oleg Hanukayev · Senior SRE & AI Platform Engineer', url: CARD_URL };
  if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyLink()) ? 'copied' : 'failed';
}

function openQr() {
  if (!qrDialog.open) qrDialog.showModal();
}
// Backdrop click closes, but only when the press also started on the backdrop
// (a text selection dragged out of the dialog must not close it).
let downOnBackdrop = false;
qrDialog.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === qrDialog; });
qrDialog.addEventListener('click', (e) => {
  if (e.target === qrDialog && downOnBackdrop) qrDialog.close();
});
qrDialog.addEventListener('close', hideToast);
$('qr-copy').addEventListener('click', copyLink);
$('qr-share').addEventListener('click', shareCard);
$('save-btn').addEventListener('click', () => toast('Opening contact card ✦'));
$('share-btn').addEventListener('click', shareCard);
$('qr-btn').addEventListener('click', openQr);

/* ---------------------------------------------------------------- header height */
const headerEl = document.querySelector('body > header');
let headerH = 64;
function measureHeader() {
  const sticky = getComputedStyle(headerEl).position === 'sticky';
  headerH = sticky ? headerEl.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty('--header-h', `${Math.round(headerH)}px`);
}
new ResizeObserver(measureHeader).observe(headerEl);
window.addEventListener('resize', measureHeader, { passive: true });

/* ---------------------------------------------------------------- portal controller */
let portal = null; // set once js/portal.js is running
const DESTS = ['stack', 'contact'];
const LABELS = { stack: 'STACK', contact: 'CHANNEL' };
let nextIdx = 0, armed = null, jt1, jt2, flareT, flareUntil = 0;
const hintEl = $('portal-hint');
const wrap = $('portal-wrap');
const canvas = $('portal-canvas');
const flashEl = $('stage-flash');
const coarse = matchMedia('(pointer: coarse)').matches;

function refreshUi() {
  for (const b of document.querySelectorAll('.jbtn')) b.classList.toggle('armed', b.dataset.dest === armed);
  if (wrap.dataset.fallback) {
    hintEl.textContent = '3D OFF — THE BUTTONS STILL JUMP';
    hintEl.classList.toggle('live', Boolean(armed));
  } else if (armed) {
    hintEl.textContent = `JUMPING → ${LABELS[armed]}`;
    hintEl.classList.add('live');
  } else {
    hintEl.textContent = `${coarse ? 'TAP' : 'CLICK'} VORTEX → ${LABELS[DESTS[nextIdx]]}`;
    hintEl.classList.remove('live');
  }
}

function jump(dest, { keepFocus = false } = {}) {
  const i = DESTS.indexOf(dest);
  if (i < 0) return;
  armed = dest;
  nextIdx = (i + 1) % DESTS.length;
  portal?.setBoost(1);
  refreshUi();
  clearTimeout(jt1);
  clearTimeout(jt2);
  jt1 = setTimeout(() => {
    const el = $(dest);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerH - 8, behavior: motionOff() ? 'auto' : 'smooth' });
    // Move focus with the view, so the next Tab continues from the section.
    if (!keepFocus) el.querySelector('h2')?.focus({ preventScroll: true });
  }, motionOff() ? 0 : 620);
  jt2 = setTimeout(() => {
    if (Date.now() >= flareUntil) portal?.setBoost(0);
    armed = null;
    refreshUi();
  }, 2000);
}
for (const b of document.querySelectorAll('.jbtn')) b.addEventListener('click', () => jump(b.dataset.dest));
refreshUi();

function flarePortal() {
  portal?.setBoost(1);
  clearTimeout(flareT);
  flareUntil = Date.now() + 1500;
  flareT = setTimeout(() => {
    if (!armed) portal?.setBoost(0);
  }, 1500);
  if (flashEl && !motionOff()) {
    flashEl.classList.remove('flash');
    void flashEl.offsetWidth;
    flashEl.classList.add('flash');
  }
}

/* ---------------------------------------------------------------- retrieval windows */
// Decorative pop-ups that echo what the shell prints (the shell log is the
// accessible record), so the layer is aria-hidden and its close buttons are
// pointer-only.
const rLayer = $('retrieval-layer');
const rSlots = [{ l: '5%', t: '16%' }, { l: '44%', t: '11%' }, { l: '22%', t: '35%' }];
let rIdx = 0, rOpen = [];
const isNarrow = () => matchMedia('(max-width: 900px)').matches;

function closeWin(win) {
  win?.remove();
  rOpen = rOpen.filter((w) => w !== win);
}
function retrieve(title, rows) {
  flarePortal();
  if (!rLayer || isNarrow()) return;
  const slot = rSlots[rIdx++ % rSlots.length];
  const win = document.createElement('div');
  win.className = 'pwin rwin mono';
  win.style.left = slot.l;
  win.style.top = slot.t;
  const bar = document.createElement('div');
  bar.className = 'pwin-bar';
  bar.innerHTML = '<span class="dots"><i class="d-r"></i><i class="d-y"></i><i class="d-g"></i></span>';
  const label = document.createElement('span');
  label.textContent = `PORTAL — ${title}`;
  const x = document.createElement('button');
  x.className = 'pwin-x';
  x.tabIndex = -1;
  x.textContent = '✕';
  x.addEventListener('click', () => closeWin(win));
  bar.append(label, x);
  const body = document.createElement('div');
  body.className = 'rwin-body';
  for (const [k, v] of rows) {
    const row = document.createElement('div');
    const kk = document.createElement('span');
    kk.className = 'k';
    kk.textContent = k;
    row.append(kk, `  ${v}`);
    body.appendChild(row);
  }
  win.append(bar, body);
  rLayer.appendChild(win);
  rOpen.push(win);
  while (rOpen.length > 3) closeWin(rOpen[0]);
}

/* ---------------------------------------------------------------- shell */
const linesEl = $('term-lines');
const scrollEl = $('term-scroll');
const inputEl = $('cc-term');

function addLine(text, type = 'out', isPrompt = false) {
  const d = document.createElement('div');
  d.className = `ln ln-${type}`;
  if (isPrompt) {
    const pr = document.createElement('span');
    pr.className = 'ln-prompt';
    pr.setAttribute('aria-hidden', 'true');
    pr.textContent = '~/c137 ❯ ';
    d.append(pr, text);
  } else d.textContent = text;
  linesEl.appendChild(d);
  scrollEl.scrollTop = scrollEl.scrollHeight;
}

const COMMANDS = {
  help: (p) => {
    p('AVAILABLE COMMANDS', 'ok');
    p('  about      whoami      projects');
    p('  stack      hire        email');
    p('  ls         vcard       share');
    p('  qr         clocks      clear');
    p('  open <stack|channel> — fire the portal', 'sys');
    p('  ↑/↓ history · Tab completes', 'sys');
  },
  about: (p) => {
    p('Oleg Hanukayev — Senior SRE & AI Platform Engineer.');
    p('10 years of production ops: enterprise SaaS, FinTech,');
    p('cybersecurity and telecom. Now: C137 AI.devops, an AI');
    p('infrastructure consultancy (4 clients, 2 end-to-end builds).');
    retrieve('OPERATOR', [['name', 'Oleg Hanukayev'], ['role', 'Senior SRE · AI Platform'], ['experience', '10 years in production'], ['open to', 'Senior roles']]);
  },
  whoami: (p) => p('oleg · senior sre + ai platform · open to senior roles'),
  stack: (p) => {
    p('cloud    AWS (EKS) · GKE · Kubernetes · Terraform · Helm');
    p('reliab.  SLOs · incident command · Datadog · Grafana · ELK');
    p('deliver  Jenkins · GitHub Actions · GitOps · blue/green');
    p('ai       RAG · agents + MCP · Bedrock · vLLM · Ollama · Langfuse');
    retrieve('TOOLCHAIN', [['cloud', 'AWS EKS · GKE · K8s · Terraform'], ['reliab.', 'SLOs · Datadog · Grafana · ELK'], ['deliver', 'Jenkins · Actions · GitOps'], ['ai', 'RAG · MCP · Bedrock · vLLM']]);
  },
  projects: (p) => {
    p('01  50+ EKS clusters, 5+ regions    zero-downtime blue/green · BMC');
    p('02  deploy-validation agent         checks ~2 h → ~30 min · BMC');
    p('03  Datadog alerting redesign       −60% alert noise · BMC');
    p('04  NOC RAG runbook base            synced with Confluence · BMC');
    p('05  multi-provider LLM routing      Anthropic/OpenAI/Groq · C137');
    p('06  RAG content platform            gaming client, agents · C137');
    retrieve('SELECTED WORK', [['01', '50+ EKS clusters · 5+ regions'], ['02', 'deploy checks ~2 h → ~30 min'], ['03', '−60% alert noise'], ['05', 'LLM routing · 3 providers']]);
  },
  hire: (p) => {
    p(EMAIL, 'ok');
    p('linkedin.com/in/oleg-hanukayev-3765b910a');
    p('github.com/See-137');
    p("type 'email' to write, 'vcard' to save my contact", 'sys');
    retrieve('CHANNEL', [['email', EMAIL], ['linkedin', 'in/oleg-hanukayev-3765b910a'], ['github', '@See-137']]);
  },
  clocks: (p) => {
    const fmt = (tz) => {
      try { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz }).format(new Date()); } catch { return '--:--:--'; }
    };
    p(`UTC ${fmt('UTC')}   NYC ${fmt('America/New_York')}   LON ${fmt('Europe/London')}   SFO ${fmt('America/Los_Angeles')}`);
  },
  ls: (p) => {
    p('about.md   projects/   stack.yaml   oleg-hanukayev.vcf');
    p('try: vcard — saves oleg-hanukayev.vcf', 'sys');
  },
  vcard: (p) => {
    openVcard();
    p('oleg-hanukayev.vcf ✦ see you in this dimension', 'ok');
  },
  email: (p) => {
    p(`opening mail to ${EMAIL} ✦`, 'ok');
    const a = document.createElement('a');
    a.href = `mailto:${EMAIL}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
  share: (p) => {
    p('opening share sheet ◉', 'ok');
    shareCard().then((r) => {
      if (r === 'copied') p('no share sheet here — link copied to clipboard', 'sys');
      else if (r === 'failed') p('share unavailable — the link is see-137.github.io/digital-business-card', 'err');
    });
  },
  qr: (p) => {
    openQr();
    p('portal QR on screen — scan to open this card', 'ok');
  },
  open: () => {},
  clear: () => {},
};
const ALIASES = { contact: 'hire', 'contact.vcf': 'vcard', 'oleg-hanukayev.vcf': 'vcard' };
const COMPLETIONS = [...Object.keys(COMMANDS).filter((c) => c !== 'open'), 'open stack', 'open channel'];

const history = [];
let hIdx = 0;

function run(raw) {
  const cmd = (raw || '').trim();
  const c = cmd.toLowerCase();
  if (cmd && history[history.length - 1] !== cmd) history.push(cmd);
  hIdx = history.length;
  if (c === 'clear') {
    linesEl.replaceChildren();
    return;
  }
  addLine(cmd, 'in', true);
  const p = (x, t) => addLine(x, t || 'out');
  if (!cmd) return;
  if (c === 'open' || c.startsWith('open ')) {
    const arg = c.slice(4).trim().replace('channel', 'contact');
    if (DESTS.includes(arg)) {
      p(`portal charging → ${LABELS[arg]} ◉`, 'ok');
      jump(arg, { keepFocus: true });
    } else p('usage: open <stack|channel>', 'err');
    return;
  }
  if (c === 'sudo --pls') {
    p('nice try. access granted anyway ✦ portal stays open ◉', 'ok');
    return;
  }
  const fn = COMMANDS[ALIASES[c] || c];
  if (fn) fn(p);
  else {
    p(`zsh: command not found: ${cmd}`, 'err');
    p("type 'help' for a list", 'sys');
  }
}

const completionsFor = (v) => (v ? COMPLETIONS.filter((c) => c.startsWith(v) && c !== v) : []);
const commonPrefix = (list) => list.reduce((a, b) => {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return a.slice(0, i);
});
function complete(hits) {
  const v = inputEl.value.trimStart().toLowerCase();
  if (hits.length === 1) {
    inputEl.value = hits[0];
    return;
  }
  const prefix = commonPrefix(hits);
  if (prefix.length > v.length) inputEl.value = prefix;
  else {
    addLine(inputEl.value, 'in', true);
    addLine(hits.join('   '), 'sys');
  }
}

// The two intro lines are static HTML (so they are not announced on load).
let lastTab = null; // input value at the last Tab that listed options
inputEl.addEventListener('input', () => { lastTab = null; });
inputEl.addEventListener('keydown', (e) => {
  const hits = e.key === 'Tab' ? completionsFor(inputEl.value.trimStart().toLowerCase()) : [];
  if (e.key === 'Enter') {
    run(inputEl.value);
    inputEl.value = '';
    lastTab = null;
  } else if (e.key === 'Escape' && inputEl.value) {
    e.preventDefault();
    inputEl.value = '';
  } else if (e.key === 'Tab' && !e.shiftKey && hits.length && lastTab !== inputEl.value) {
    // Tab is captured only when it can make progress: something to complete,
    // and not a repeat of a Tab that already listed the options (the second
    // Tab moves focus on, so the input never traps the keyboard).
    e.preventDefault();
    const before = inputEl.value;
    complete(hits);
    lastTab = inputEl.value === before ? before : null;
  } else if (e.key === 'ArrowUp' && history.length) {
    e.preventDefault();
    hIdx = Math.max(0, hIdx - 1);
    inputEl.value = history[hIdx];
  } else if (e.key === 'ArrowDown' && history.length) {
    e.preventDefault();
    hIdx = Math.min(history.length, hIdx + 1);
    inputEl.value = history[hIdx] ?? '';
  }
});
for (const b of document.querySelectorAll('[data-cmd]')) b.addEventListener('click', () => run(b.dataset.cmd));

/* ---------------------------------------------------------------- motion control */
// One switch for all motion: the 3D loop and every CSS animation. The OS
// reduced-motion setting is honoured live; the user's own choice is remembered
// on this device (a convenience only, so storage failures are ignored).
const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
const motionBtn = $('motion-btn');
let userPaused = false;
let lowBattery = false;
try { userPaused = localStorage.getItem('c137-motion') === 'paused'; } catch { /* no storage */ }
/** Motion forced off by the system or the context (the button cannot override). */
function motionForced() {
  return reduceMq.matches || pins.still || lowBattery;
}
function motionOff() {
  return userPaused || motionForced();
}
function applyMotion() {
  const off = motionOff();
  document.documentElement.classList.toggle('paused', off);
  motionBtn.setAttribute('aria-pressed', String(off));
  motionBtn.setAttribute('aria-disabled', String(motionForced()));
  motionBtn.title = motionForced() ? 'Motion is off (system reduced-motion setting, ?motion=0, or low battery)' : '';
  motionBtn.querySelector('.motion-ico').textContent = off ? '▶' : '❚❚';
  portal?.setPaused(off);
}
motionBtn.addEventListener('click', () => {
  if (motionForced()) return; // never overwrite the stored choice while forced
  userPaused = !userPaused;
  try { localStorage.setItem('c137-motion', userPaused ? 'paused' : 'on'); } catch { /* no storage */ }
  applyMotion();
});
reduceMq.addEventListener('change', applyMotion);
applyMotion();

/* ---------------------------------------------------------------- portal boot */

function portalFallback() {
  if (wrap.dataset.fallback) return;
  wrap.dataset.fallback = '1';
  canvas.hidden = true;
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', 'C-137 portal (static)');
  refreshUi();
}

/** Chromium only: a phone on battery below 20 % gets the still frame. */
async function lowPower() {
  try {
    const b = await navigator.getBattery?.();
    return Boolean(b && !b.charging && b.level < 0.2);
  } catch {
    return false;
  }
}

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  lowPower()
    .then((low) => {
      lowBattery = low;
      applyMotion();
      return import('./portal.js');
    })
    .then((m) => m.startPortal({ canvas, wrap, pins, onJump: () => jump(DESTS[nextIdx]) }))
    .then((ctl) => {
      portal = ctl;
      portal.setPaused(motionOff());
      wrap.dataset.backend = ctl.backend;
      canvas.classList.add('on');
    })
    .catch((err) => {
      console.warn('[portal] 3D unavailable, showing the poster', err);
      portalFallback();
    });
}

// Read-only state for tests and the console.
window.c137 = Object.freeze({ portalState: () => portal?.state?.() ?? null });

// Data saver: never download the ~318 KB of 3D at all.
const saveData = navigator.connection?.saveData === true;
if (pins.no3d || saveData) portalFallback();
else {
  // Never compete with first paint: wait for `load` plus a settle delay, then
  // for the stage to be on screen (phones: genuinely visible, not just near),
  // then for an idle slot. ~310 KB of three.js must not land before LCP.
  const SETTLE_MS = 1200;
  const whenIdle = (cb) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 700));
  const arm = () => {
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        io.disconnect();
        whenIdle(boot);
      }
    }, isNarrow() ? { threshold: 0.15 } : { rootMargin: '200px' });
    io.observe(wrap);
  };
  wrap.addEventListener('pointerdown', boot, { once: true });
  const settle = () => setTimeout(arm, SETTLE_MS);
  if (document.readyState === 'complete') settle();
  else window.addEventListener('load', settle, { once: true });
}

/* ---------------------------------------------------------------- offline */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('[sw] registration failed', err));
  }, { once: true });
}

export { run, jump };
