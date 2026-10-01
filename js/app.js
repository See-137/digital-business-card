/**
 * Card behaviour: stack chips, vCard, the c137 shell, portal retrieval windows,
 * section jumps, and the lazy boot of the 3D portal (js/portal.js).
 *
 * The 3D never blocks first paint: it loads after `load`, when the stage is
 * near the viewport and the main thread is idle (or on first touch of the
 * stage). Until then the stage shows a CSS poster of the vortex.
 */
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tPin = q.has('t') ? Number(q.get('t')) : undefined;
const pins = {
  webgl: q.get('webgl') === '1',
  still: prefersReduced || q.get('motion') === '0',
  t: Number.isFinite(tPin) ? tPin : undefined,
  no3d: q.get('3d') === '0',
};

/* ---------------------------------------------------------------- stack chips */
const CHIPS = ['AWS', 'EKS', 'Kubernetes', 'Docker', 'Helm', 'Terraform', 'GitHub Actions', 'ArgoCD', 'Claude · MCP', 'Bedrock', 'RAG', 'Agent infra', 'Datadog', 'Grafana', 'ELK', 'Python', 'Postgres', 'Vector dbs'];
const chipsEl = $('stack-chips');
for (const name of CHIPS) {
  const li = document.createElement('li');
  li.className = name === 'Claude · MCP' ? 'tool tool-hot' : 'tool';
  li.textContent = name;
  chipsEl.appendChild(li);
}

/* ---------------------------------------------------------------- vCard */
export function downloadVcard() {
  const v = ['BEGIN:VCARD', 'VERSION:3.0', 'N:Hanukayev;Oleg;;;', 'FN:Oleg Hanukayev', 'TITLE:DevOps & AI Engineer',
    'URL:https://see-137.github.io/digital-business-card/',
    'URL:https://www.linkedin.com/in/oleg-hanukayev-3765b910a/', 'END:VCARD'].join('\r\n');
  const url = URL.createObjectURL(new Blob([v], { type: 'text/vcard' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'oleg-hanukayev.vcf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
$('vcard-btn').addEventListener('click', downloadVcard);

/* ---------------------------------------------------------------- share · QR · toast */
const CARD_URL = 'https://see-137.github.io/digital-business-card/';
const toastEl = $('toast');
let toastT;
// The toast is a manual popover: shown after a modal dialog it is still in the
// top layer above it, so feedback inside the QR dialog is visible.
function toast(msg) {
  toastEl.textContent = msg;
  if (toastEl.showPopover) {
    if (toastEl.matches(':popover-open')) toastEl.hidePopover();
    toastEl.showPopover();
  }
  toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => {
    toastEl.classList.remove('show');
    if (toastEl.matches?.(':popover-open')) toastEl.hidePopover();
  }, 2600);
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(CARD_URL);
    toast('Link copied ✦');
    return true;
  } catch {
    toast('Copy failed — the link is see-137.github.io/digital-business-card');
    return false;
  }
}

/** Native share sheet where there is one (phones); otherwise copy the link. */
async function shareCard() {
  const data = { title: 'Oleg Hanukayev — DevOps & AI Engineer', text: 'Oleg Hanukayev · C137.OPS', url: CARD_URL };
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

const qrDialog = $('qr-dialog');
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
$('qr-copy').addEventListener('click', copyLink);
$('qr-share').addEventListener('click', shareCard);
$('save-btn').addEventListener('click', () => {
  downloadVcard();
  toast('contact.vcf saved ✦');
});
$('share-btn').addEventListener('click', shareCard);
$('qr-btn').addEventListener('click', openQr);

/* ---------------------------------------------------------------- portal controller */
let portal = null; // set once js/portal.js is running
const DESTS = ['stack', 'contact'];
const LABELS = { stack: 'STACK', contact: 'CHANNEL' };
let nextIdx = 0, armed = null, jt1, jt2, flareT, flareUntil = 0;
const hintEl = $('portal-hint');
const wrap = $('portal-wrap');
const canvas = $('portal-canvas');
const flashEl = $('stage-flash');

function refreshUi() {
  for (const b of document.querySelectorAll('.jbtn')) b.classList.toggle('armed', b.dataset.dest === armed);
  if (wrap.dataset.fallback) {
    hintEl.textContent = 'PORTAL OFFLINE — USE JUMP TO ↑';
    hintEl.classList.toggle('live', Boolean(armed));
  } else if (armed) {
    hintEl.textContent = `JUMPING → ${LABELS[armed]}`;
    hintEl.classList.add('live');
  } else {
    hintEl.textContent = `CLICK VORTEX → ${LABELS[DESTS[nextIdx]]}`;
    hintEl.classList.remove('live');
  }
}

function jump(dest) {
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
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: pins.still ? 'auto' : 'smooth' });
  }, pins.still ? 0 : 620);
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
  if (flashEl && !pins.still) {
    flashEl.classList.remove('flash');
    void flashEl.offsetWidth;
    flashEl.classList.add('flash');
  }
}

/* ---------------------------------------------------------------- retrieval windows */
// Decorative duplicates of what the shell prints (the shell log is the
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
  label.textContent = `RETRIEVED VIA PORTAL — ${title}`;
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
    p('  stack      hire        clocks');
    p('  ls         vcard       share');
    p('  qr         clear');
    p('  open <stack|channel> — fire the portal', 'sys');
    p('  ↑/↓ history · Tab completes', 'sys');
  },
  about: (p) => {
    p('Oleg Hanukayev — Platform, DevOps & MLOps engineer.');
    p('I design and ship cloud platforms, CI/CD, and');
    p('production AI infrastructure.');
    retrieve('OPERATOR', [['name', 'Oleg Hanukayev'], ['role', 'Platform · DevOps · MLOps'], ['open to', 'Senior / Staff'], ['tracks', 'Platform · SRE · MLOps · Cloud']]);
  },
  whoami: (p) => p('oleg · platform+mlops · open to senior/staff'),
  stack: (p) => {
    p('cloud   AWS · EKS · K8s · Docker · Helm');
    p('deliver Terraform · GitHub Actions · ArgoCD');
    p('ai/llm  Claude · MCP · Bedrock · RAG · agent infra');
    p('obs     Datadog · Grafana · ELK · SLOs');
    retrieve('TOOLCHAIN', [['cloud', 'AWS · EKS · K8s · Docker · Helm'], ['deliver', 'Terraform · Actions · ArgoCD'], ['ai/llm', 'Claude · MCP · Bedrock · RAG'], ['obs', 'Datadog · Grafana · ELK · SLOs']]);
  },
  projects: (p) => {
    p('01  multi-region EKS platform      multi-AZ · zero-downtime');
    p('02  gitops delivery pipeline       argocd · progressive');
    p('03  rag + agent infrastructure     bedrock + claude');
    p('04  observability & SLO overhaul   datadog · error budgets');
    p('retrieved through the portal →', 'sys');
    retrieve('SELECTED WORK', [['01', 'multi-region EKS platform'], ['02', 'gitops delivery pipeline'], ['03', 'rag + agent infrastructure'], ['04', 'observability & SLO overhaul']]);
  },
  hire: (p) => {
    p('linkedin.com/in/oleg-hanukayev', 'ok');
    p('github.com/See-137');
    p("type 'vcard' to download my contact card", 'sys');
    retrieve('CHANNEL', [['linkedin', 'in/oleg-hanukayev'], ['github', '@See-137'], ['vcard', "run 'vcard' to download"]]);
  },
  clocks: (p) => {
    const fmt = (tz) => {
      try { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz }).format(new Date()); } catch { return '--:--:--'; }
    };
    p(`UTC ${fmt('UTC')}   NYC ${fmt('America/New_York')}   LON ${fmt('Europe/London')}   SFO ${fmt('America/Los_Angeles')}`);
  },
  ls: (p) => {
    p('about.md   projects/   stack.yaml   contact.vcf');
    p('try: vcard — downloads contact.vcf', 'sys');
  },
  vcard: (p) => {
    downloadVcard();
    p('contact.vcf downloaded ✦ see you in this dimension', 'ok');
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
const ALIASES = { contact: 'hire', 'contact.vcf': 'vcard' };
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
      jump(arg);
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

addLine('c137.ops shell — zsh 5.9 · session.live · portal linked ◉', 'sys');
addLine("type 'help' — content commands are retrieved through the portal", 'sys');
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    run(inputEl.value);
    inputEl.value = '';
  } else if (e.key === 'Tab' && !e.shiftKey && completionsFor(inputEl.value.trimStart().toLowerCase()).length) {
    // Tab is only captured when there is something to complete; otherwise
    // (and always with Shift) it moves focus as usual.
    e.preventDefault();
    complete(completionsFor(inputEl.value.trimStart().toLowerCase()));
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

/* ---------------------------------------------------------------- portal boot */

function portalFallback() {
  if (wrap.dataset.fallback) return;
  wrap.dataset.fallback = '1';
  canvas.hidden = true;
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', 'C-137 portal (static)');
  refreshUi();
}

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  import('./portal.js')
    .then((m) => m.startPortal({ canvas, wrap, pins, onJump: () => jump(DESTS[nextIdx]) }))
    .then((ctl) => {
      portal = ctl;
      wrap.dataset.backend = ctl.backend;
      canvas.classList.add('on');
    })
    .catch((err) => {
      console.warn('[portal] 3D unavailable, showing the poster', err);
      portalFallback();
    });
}

if (pins.no3d) portalFallback();
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
