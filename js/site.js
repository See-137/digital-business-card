/*
 * Progressive enhancement for the card page. Every fact is already in the HTML;
 * this file only adds: the turning card, the dealt deck, the click-to-load
 * YouTube player (a plain link without JS), Share, the QR dialog,
 * the email address (assembled here, never written in the HTML) and the
 * service worker. No third-party code.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  const phoneMq = matchMedia('(max-width: 767px)');
  const coarseMq = matchMedia('(pointer: coarse)');
  const reduced = () => reduceMq.matches;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pad2 = (n) => String(n).padStart(2, '0');

  document.documentElement.classList.add('js');

  /* ---------- announcements ---------- */
  function announce(text, region) {
    const r = region || $('#status');
    if (!r) return;
    r.textContent = '';
    setTimeout(() => { r.textContent = text; }, 60);
  }
  let toastTimer = 0;
  function toast(text, ms = 4000) {
    const t = $('#toast');
    const dlg = $('#qr-dialog');
    announce(text, dlg && dlg.open ? $('#dialog-status') : $('#status'));
    if (!t) return;
    t.textContent = text;
    try { if (!t.matches(':popover-open')) t.showPopover(); } catch (_) { /* no popover support: the live region still spoke */ }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { try { t.hidePopover(); } catch (_) { /* already hidden */ } }, ms);
  }

  /* ---------- the card: CSS 3D, turned by drag, keys or the Flip button ---------- */
  function initCard() {
    const stage = $('#stage');
    const card = $('#card');
    if (!stage || !card) return;
    // resting tilt: at most 4deg per axis; the pointer adds up to 4deg more (8deg max)
    const REST = { rx: 4, ry: -4 };
    const HOVER_MAX = 4;
    const s = { rx: REST.rx, ry: REST.ry, trx: REST.rx, try_: REST.ry };
    let raf = 0;
    let last = 0;
    let drag = null;
    let face = 'front';
    let hover = { x: 0, y: 0 };

    stage.tabIndex = 0;
    stage.setAttribute('aria-roledescription', 'turnable business card');
    stage.setAttribute('aria-label', 'Business card. Drag or use the arrow keys to turn it; Enter flips it.');

    function apply() {
      const rad = s.ry * Math.PI / 180;
      const c = Math.cos(rad);
      card.style.setProperty('--rx', s.rx.toFixed(2));
      card.style.setProperty('--ry', s.ry.toFixed(2));
      card.style.setProperty('--lx', (-Math.sin(rad) * 55).toFixed(1));
      card.style.setProperty('--shadeF', clamp((1 - c) * 0.55, 0, 0.6).toFixed(3));
      card.style.setProperty('--shadeB', clamp((1 + c) * 0.55, 0, 0.6).toFixed(3));
      stage.style.setProperty('--fs', (0.35 + 0.65 * Math.abs(c)).toFixed(3));
      const now = c >= 0 ? 'front' : 'back';
      if (now !== face) {
        face = now;
        $('#card-state').textContent = face === 'front' ? 'Showing the front of the card.' : 'Showing the back of the card, with the QR code.';
        $('#flip-label').textContent = face === 'front' ? 'Flip card' : 'Flip to front';
      }
    }
    function settled() { return Math.abs(s.trx - s.rx) < 0.02 && Math.abs(s.try_ - s.ry) < 0.02; }
    function tick(t) {
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      const k = 1 - Math.exp(-dt * 9);
      const tx = s.trx + hover.y;
      const ty = s.try_ + hover.x;
      s.rx += (tx - s.rx) * k;
      s.ry += (ty - s.ry) * k;
      apply();
      if (drag || Math.abs(tx - s.rx) > 0.02 || Math.abs(ty - s.ry) > 0.02) raf = requestAnimationFrame(tick);
      // at rest, drop will-change so the faces re-rasterise at their final transform (crisper text)
      else { s.rx = tx; s.ry = ty; apply(); raf = 0; last = 0; card.classList.remove('moving'); }
    }
    function kick() {
      if (reduced() || document.hidden) {
        s.rx = s.trx + hover.y; s.ry = s.try_ + hover.x; apply();
        return;
      }
      if (!raf) { card.classList.add('moving'); raf = requestAnimationFrame(tick); }
    }
    function go(rx, ry) { s.trx = rx; s.try_ = ry; kick(); }
    // the front rests tilted like a product shot; the back rests flat so the QR scans
    function restFor(k) {
      const back = Math.abs(k % 2) === 1;
      return back ? { rx: 0, ry: k * 180 } : { rx: REST.rx, ry: k * 180 + REST.ry };
    }
    function settle(vy = 0) {
      const p = restFor(Math.round((s.try_ + vy * 12) / 180));
      go(p.rx, p.ry);
    }
    function flip() {
      const p = restFor(Math.round(s.try_ / 180) + 1);
      hover = { x: 0, y: 0 };
      go(p.rx, p.ry);
    }

    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      hover = { x: 0, y: 0 };
      drag = { x: e.clientX, y: e.clientY, ry: s.try_, rx: s.trx, vx: 0, lx: e.clientX, lt: performance.now() };
      try { stage.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
      stage.classList.add('dragging');
      kick();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) {
        // a gentle tilt toward a hovering mouse, front face only
        if (e.pointerType !== 'mouse' || reduced() || face !== 'front') return;
        const r = stage.getBoundingClientRect();
        const nx = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
        const ny = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
        hover = { x: nx * 2 * HOVER_MAX, y: -ny * 2 * HOVER_MAX };
        kick();
        return;
      }
      const now = performance.now();
      drag.vx = (e.clientX - drag.lx) / Math.max(1, now - drag.lt) * 16;
      drag.lx = e.clientX; drag.lt = now;
      s.try_ = drag.ry + (e.clientX - drag.x) * 0.45;
      if (e.pointerType !== 'touch') s.trx = clamp(drag.rx - (e.clientY - drag.y) * 0.3, -32, 32);
      kick();
    });
    const end = () => {
      if (!drag) return;
      const v = drag.vx;
      drag = null;
      stage.classList.remove('dragging');
      settle(v);
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('pointerleave', () => { if (!drag && (hover.x || hover.y)) { hover = { x: 0, y: 0 }; kick(); } });
    stage.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 45 : 15;
      switch (e.key) {
        case 'ArrowLeft': go(s.trx, s.try_ - step); break;
        case 'ArrowRight': go(s.trx, s.try_ + step); break;
        case 'ArrowUp': go(Math.min(32, s.trx + 8), s.try_); break;
        case 'ArrowDown': go(Math.max(-32, s.trx - 8), s.try_); break;
        case 'Enter': case ' ': flip(); break;
        case 'Home': go(REST.rx, REST.ry); break;
        default: return;
      }
      e.preventDefault();
    });

    const flipBtn = $('#flip');
    flipBtn.hidden = false;
    flipBtn.addEventListener('click', flip);
    const hint = $('#hint');
    const writeHint = () => {
      hint.innerHTML = coarseMq.matches
        ? 'Swipe the card sideways to turn it, or tap Flip card'
        : 'Drag the card to turn it, or focus it and use <kbd>&larr;</kbd> <kbd>&rarr;</kbd> <kbd>Enter</kbd>';
    };
    writeHint();
    hint.hidden = false;
    coarseMq.addEventListener('change', writeHint);
    // motion preference honoured live: snap to the target when it turns on
    reduceMq.addEventListener('change', () => { if (reduced()) { cancelAnimationFrame(raf); raf = 0; hover = { x: 0, y: 0 }; kick(); } });

    // a short swing-in on load (under a second), skipped for reduced motion
    if (!reduced()) { s.ry = REST.ry - 38; apply(); kick(); } else apply();
    window.theCard = { state: () => ({ rx: +s.rx.toFixed(2), ry: +s.ry.toFixed(2), face, animating: !!raf }), flip };
  }

  /* ---------- the deck: one group dealt at a time, the rest wait off-table ---------- */
  function initDeck() {
    const root = $('#deck');
    if (!root) return;
    const view = $('.deck-view', root);
    const track = $('.deck-track', root);
    const all = $$('.pcard', track);
    const bar = $('.deck-bar', root);
    const prev = $('[data-deck="prev"]', root);
    const next = $('[data-deck="next"]', root);
    const pips = $('.pips', root);
    const count = $('.deck-count', root);
    const live = $('#deck-live');
    const readout = $('#readout');
    const btns = $$('[data-group-btn]');
    if (!all.length || !btns.length) return;

    let group = btns[0].dataset.groupBtn;
    let cards = [];
    let active = 0;
    let dealt = false;
    let moved = false;

    function slot(d) {
      // the active card sits at the left edge; the rest fan out behind it to the right; seen cards leave left
      const phone = phoneMq.matches;
      if (d < 0) return { t: `translateX(${-118 + d * 4}%) translateZ(-60px) rotateZ(-4deg)`, o: 0, dim: 0, z: 60 + d };
      const x = d * (phone ? 92 : 56);
      const z = -d * (phone ? 90 : 130);
      const ry = -d * (phone ? 5 : 9);
      const rz = d * (phone ? 0.6 : 1.1);
      const hidden = d > (phone ? 1 : 3);
      return { t: `translateX(${x}%) translateZ(${z}px) rotateY(${ry}deg) rotateZ(${rz}deg)`, o: hidden ? 0 : 1, dim: Math.min(0.72, d * 0.24), z: 50 - d };
    }
    function layout() {
      all.forEach((c) => {
        const i = cards.indexOf(c);
        if (i < 0) {
          c.classList.add('off'); c.classList.remove('is-active');
          c.setAttribute('aria-hidden', 'true');
          c.style.transform = 'translateY(40px) translateZ(-240px)'; c.style.zIndex = '0';
          return;
        }
        const p = slot(i - active);
        c.classList.remove('off');
        c.classList.toggle('is-active', i === active);
        c.style.transform = p.t; c.style.opacity = String(p.o); c.style.zIndex = String(p.z);
        c.style.setProperty('--dim', String(p.dim));
        c.style.pointerEvents = p.o ? '' : 'none';
        c.setAttribute('aria-hidden', i === active ? 'false' : 'true');
        // controls on cards behind the active one leave the tab order (they sit under aria-hidden)
        $$('a[href],button,iframe', c).forEach((el) => { el.tabIndex = i === active ? 0 : -1; });
      });
      prev.disabled = active === 0;
      next.disabled = active === cards.length - 1;
      [...pips.children].forEach((p, i) => p.classList.toggle('on', i === active));
      count.textContent = `${pad2(active + 1)} / ${pad2(cards.length)}`;
      renderReadout(cards[active]);
    }
    function renderReadout(c) {
      // the active card already shows the title and media: the readout adds "What it does" and the links
      const more = $('.pc-more', c);
      readout.replaceChildren(...[...more.children].map((n) => n.cloneNode(true)));
    }
    function go(i, quiet) {
      const n = clamp(i, 0, cards.length - 1);
      if (n === active) return;
      active = n;
      layout();
      if (!quiet) live.textContent = `${$('h3', cards[n]).textContent}, card ${n + 1} of ${cards.length}`;
    }
    function deal() {
      if (reduced() || document.hidden) { layout(); return; }
      root.classList.add('dealing');
      cards.forEach((c, i) => {
        c.classList.remove('off');
        c.style.transform = `translateY(60px) translateZ(-260px) rotateZ(${(i % 2 ? 1 : -1) * (2 + i)}deg)`;
        c.style.opacity = '0';
      });
      void track.offsetWidth;
      root.classList.remove('dealing');
      layout();
      cards.forEach((c, i) => { c.style.transitionDelay = `${i * 70}ms`; });
      setTimeout(() => cards.forEach((c) => { c.style.transitionDelay = ''; }), 70 * cards.length + 800);
    }
    function setGroup(id, announceIt) {
      group = id;
      cards = all.filter((c) => c.dataset.group === id);
      active = 0;
      pips.replaceChildren(...cards.map(() => document.createElement('i')));
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.groupBtn === id)));
      if (dealt) deal(); else layout();
      if (announceIt) {
        const name = $(`[data-group-btn="${id}"]`).firstChild.textContent;
        live.textContent = `${name}: ${cards.length} cards dealt. ${$('h3', cards[0]).textContent}, card 1 of ${cards.length}.`;
      }
    }

    btns.forEach((b) => b.addEventListener('click', () => { if (b.dataset.groupBtn !== group) setGroup(b.dataset.groupBtn, true); }));
    prev.addEventListener('click', () => go(active - 1));
    next.addEventListener('click', () => go(active + 1));
    all.forEach((c) => c.addEventListener('click', () => {
      const i = cards.indexOf(c);
      if (!moved && i >= 0 && i !== active) go(i);
    }));
    view.addEventListener('keydown', (e) => {
      const m = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: cards.length - 1 }[e.key];
      if (m === undefined) return;
      e.preventDefault();
      go(m);
    });
    // swipe (touch, pen and mouse); vertical movement stays page scroll via touch-action: pan-y
    let sx = null;
    view.addEventListener('pointerdown', (e) => { sx = e.clientX; moved = false; });
    view.addEventListener('pointermove', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 6) moved = true;
      if (moved && !reduced()) track.style.transform = `translateX(${dx * 0.25}px)`;
    });
    const up = (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx;
      sx = null;
      track.style.transform = '';
      if (dx < -40) go(active + 1); else if (dx > 40) go(active - 1);
      setTimeout(() => { moved = false; }, 0);
    };
    // a swipe that ends on a link or the player must not also activate it
    view.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', up);
    view.addEventListener('pointerleave', (e) => { if (sx != null && e.pointerType === 'mouse') up(e); });
    phoneMq.addEventListener('change', layout);

    $('#groups').hidden = false;
    bar.hidden = false;
    readout.hidden = false;
    setGroup(group, false);

    // deal once when the deck first comes into view
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((ents) => {
        if (!dealt && ents.some((x) => x.isIntersecting)) { dealt = true; deal(); io.disconnect(); }
      }, { threshold: 0.25 });
      io.observe(view);
    } else dealt = true;
    window.theDeck = { state: () => ({ group, active, total: cards.length, dealt }) };
  }

  /* ---------- YouTube facade: a plain link in the HTML, a click-to-load player here ----------
   * Nothing is requested from YouTube before the click except the lazy thumbnail; the
   * player loads from youtube-nocookie.com only when the visitor presses play. */
  function initYouTube() {
    $$('a.yt-facade[data-yt]').forEach((a) => {
      const id = a.dataset.yt;
      const title = a.dataset.ytTitle || 'YouTube video';
      if (!/^[\w-]{11}$/.test(id)) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'yt-facade';
      btn.setAttribute('aria-label', `Play the ${title.replace(/^Clay Town: /, 'Clay Town episode: ')}`);
      const img = $('img', a);
      const icon = $('.yt-play', a);
      btn.append(img, icon);
      if (a.tabIndex === -1) btn.tabIndex = -1;
      a.replaceWith(btn);
      btn.addEventListener('click', () => {
        // on a card still waiting behind the active one, the click only brings the card forward
        if (btn.closest('[aria-hidden="true"]')) return;
        const frame = document.createElement('iframe');
        frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
        frame.title = title;
        frame.allow = 'autoplay; encrypted-media; picture-in-picture';
        frame.allowFullscreen = true;
        frame.loading = 'lazy';
        btn.replaceWith(frame);
        frame.closest('.media')?.classList.add('playing');
        frame.focus();
      });
    });
  }

  /* ---------- email: assembled here so the address never sits in the HTML ---------- */
  function initMail() {
    const addr = ['oleghanukayev', 'gmail.com'].join('@');
    $$('[data-mail]').forEach((a) => {
      a.href = 'mailto:' + addr;
      a.removeAttribute('download');
    });
    $$('[data-mail-text]').forEach((n) => { n.textContent = addr; });
  }

  /* ---------- share ---------- */
  function initShare() {
    const btn = $('#share');
    if (!btn) return;
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      const url = location.href.split('#')[0];
      const payload = { title: document.title, url };
      if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
        try { await navigator.share(payload); return; } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      try {
        await navigator.clipboard.writeText(url);
        toast('Link copied to the clipboard.');
      } catch (_) {
        toast('Copy this link: ' + url, 15000);
      }
    });
  }

  /* ---------- QR dialog (native dialog: focus containment, Escape, focus return) ---------- */
  function initQr() {
    const dlg = $('#qr-dialog');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    let opener = null;
    let downOnBackdrop = false;
    $$('[data-open-qr]').forEach((b) => {
      b.hidden = false;
      b.addEventListener('click', () => { opener = b; dlg.showModal(); });
    });
    $('#qr-close').addEventListener('click', () => dlg.close());
    dlg.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === dlg; });
    dlg.addEventListener('click', (e) => { if (e.target === dlg && downOnBackdrop) dlg.close(); downOnBackdrop = false; });
    dlg.addEventListener('close', () => { if (opener) opener.focus(); });
  }

  /* ---------- offline support ---------- */
  function initSw() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('service worker not registered:', err && err.message));
    });
  }

  // initYouTube runs before initDeck so the deck manages the upgraded button's tab order
  const steps = [initMail, initShare, initQr, initCard, initYouTube, initDeck, initSw];
  for (const step of steps) {
    try { step(); } catch (err) { console.error(`${step.name} failed:`, err); }
  }
})();
