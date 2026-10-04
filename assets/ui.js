/* Tiny DOM + UI primitives. No framework, no dependencies. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) n.dataset[dk] = dv;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(3)) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export const frag = (...kids) => {
  const f = document.createDocumentFragment();
  for (const k of kids.flat(3)) if (k) f.append(k.nodeType ? k : document.createTextNode(String(k)));
  return f;
};

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── theme ──────────────────────────────────────────────────────────── */
const THEME_KEY = 'htlb.theme';
export const theme = {
  get() { return localStorage.getItem(THEME_KEY) || 'auto'; },
  resolved() {
    const t = this.get();
    if (t !== 'auto') return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },
  set(v) {
    if (v === 'auto') { document.documentElement.removeAttribute('data-theme'); }
    else document.documentElement.dataset.theme = v;
    localStorage.setItem(THEME_KEY, v);
  },
};

/* ── scroll reveal ──────────────────────────────────────────────────── */
let io = null;
let guardIv = null;

/** Safety net: anything on screen becomes visible even if the observer can't. */
function selfHeal() {
  clearInterval(guardIv);
  guardIv = setInterval(() => {
    const left = $$('.reveal:not(.in)');
    if (!left.length) { clearInterval(guardIv); guardIv = null; return; }
    for (const n of left) {
      if (n.getBoundingClientRect().top < innerHeight) n.classList.add('in');
    }
  }, 700);
}

export function reveal(root = document) {
  const pending = $$('.reveal:not(.in)', root);
  if (!pending.length) return;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    pending.forEach((n) => n.classList.add('in'));
    return;
  }

  selfHeal();

  io ||= new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      const d = +(e.target.dataset.d || 0);
      e.target.style.animationDelay = d * 55 + 'ms';
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '420px 0px -4% 0px', threshold: 0.01 });

  pending.forEach((n) => io.observe(n));
}

/** Force-reveal everything (printing, full-page capture). */
export function revealAll() {
  $$('.reveal:not(.in)').forEach((n) => n.classList.add('in'));
  clearInterval(guardIv);
  guardIv = null;
}

/* ── count-up ───────────────────────────────────────────────────────── */
export function countUp(node, to, dur = 900) {
  const from = 0;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    node.textContent = fmt(Math.round(from + (to - from) * e));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
export const fmt = (n) => n.toLocaleString('zh-CN');

/* ── icons ──────────────────────────────────────────────────────────────
 * One 24x24 grid, 1.6 stroke, round caps, no fills. Deliberately plain:
 * pictograms, not illustration. They inherit currentColor so they work on
 * paper, on the accent field, and in dark mode without a second set. */
const P = {
  pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  alert: '<path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.4-3 8.2-7.5 9.5-4.5-1.3-7.5-5.1-7.5-9.5V6z"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/>',
  gavel: '<path d="m14 4 6 6-3 3-6-6z"/><path d="m11 7-7 7 3 3 7-7"/><path d="M4 21h9"/>',
  receipt: '<path d="M6 3h12v18l-3-1.5L12 21l-3-1.5L6 21z"/><path d="M9.5 8h5M9.5 12h5"/>',
  door: '<path d="M14 3H6v18h8"/><path d="M14 12h7v9h-7"/><circle cx="11.5" cy="12" r=".9" fill="currentColor"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M9 7.5V5h6v2.5M3 12.5h18"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  stethoscope: '<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M6 3H4.5M14 3h1.5"/><path d="M10 12v3a5 5 0 0 0 10 0v-1"/><circle cx="20" cy="11" r="1.6"/>',
  baby: '<circle cx="12" cy="9" r="5.5"/><path d="M9.5 8.5v.1M14.5 8.5v.1M10 11.5c1.2 1 2.8 1 4 0"/><path d="M6 21a6 6 0 0 1 12 0"/>',
  elder: '<circle cx="12" cy="6" r="3"/><path d="M9 21v-5a4 4 0 0 1 4-4h2M17 21v-4"/><path d="M6 12h3"/>',
  passport: '<rect x="4.5" y="3" width="15" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5"/>',
  grief: '<path d="M12 3.5c-1.5 2-3 3-3 5.5a3 3 0 0 0 6 0c0-2.5-1.5-3.5-3-5.5"/><path d="M4.5 20.5h15"/>',
  heart: '<path d="M12 20s-7.5-4.4-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6c0 5-7.5 9.4-7.5 9.4"/>',
  rings: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/>',
  laugh: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5v.1M15 9.5v.1"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
  book: '<path d="M4 4.5A2 2 0 0 1 6 3h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 17.5V21h15v-2"/>',
  tag: '<path d="M3 12.5V4h8.5L21 13.5 13.5 21z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
  scale: '<path d="M12 4v16M6 8h12M4 20h16"/><path d="m6 8-2.5 6h5zM18 8l-2.5 6h5z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  clockSmall: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.4 6.4l3.5 3.5M14.1 14.1l3.5 3.5M17.6 6.4l-3.5 3.5M9.9 14.1l-3.5 3.5"/>',
  person: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.5 3.6 8.5S14.4 18 12 20.5C9.6 18 8.4 15 8.4 12S9.6 6 12 3.5Z"/>',
};

/** Inline SVG icon. `size` in px, `cls` for styling hooks. */
export function icon(name, size = 20, cls = '') {
  const d = P[name] || P.spark;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.6');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  if (cls) s.setAttribute('class', cls);
  s.innerHTML = d;
  return s;
}

export const hasIcon = (n) => Boolean(P[n]);

/* ── view teardown ───────────────────────────────────────────────────
 * A view that attaches global listeners has to be able to detach them. Without
 * this, navigating away leaves the handler attached and after a few route
 * changes several scroll-spies are fighting over one indicator. Lives here
 * rather than in app.js so views-pages.js does not have to import the router,
 * which would be a cycle. */
let teardowns = [];
export function onTeardown(fn) { teardowns.push(fn); }
export function runTeardown() {
  if (!teardowns.length) return;
  const list = teardowns;
  teardowns = [];
  for (const fn of list) { try { fn(); } catch (e) { /* a dead handler must not block the next page */ } }
}

/* ── scroll-spy ──────────────────────────────────────────────────────
 * Marks whichever heading you are currently reading, and slides a single bar
 * to it. Driven by scroll position rather than IntersectionObserver, because IO
 * fires on crossing rather than on "which one is nearest the top of the
 * viewport" -- which is the thing a reader actually expects.
 *
 * Returns a teardown so a route change can detach it; forgetting to is how you
 * end up with three handlers fighting over one indicator. */
export function scrollSpy(links, getTargets) {
  if (!links.length) return () => {};
  const host = links[0].parentElement;
  const ind = document.createElement('i');
  ind.className = 'toc__ind';
  ind.setAttribute('aria-hidden', 'true');
  host.append(ind);

  let on = -1;

  const place = (i) => {
    const a = links[i];
    if (!a) return;
    ind.style.height = a.offsetHeight + 'px';
    ind.style.transform = `translateY(${a.offsetTop}px)`;
    ind.style.opacity = '1';
    links.forEach((x, j) => {
      if (j === i) x.setAttribute('aria-current', 'true');
      else x.removeAttribute('aria-current');
    });
  };

  const clear = () => {
    on = -1;
    ind.style.opacity = '0';
    links.forEach((x) => x.removeAttribute('aria-current'));
  };

  const update = () => {
    /* The view calls this while it is still detached, so every offset reads 0
       on the first pass. Without this the bar sits at the origin and nothing
       corrects it until the reader happens to scroll. */
    if (!host.isConnected || !links[0].offsetHeight) return;

    /* Below the TOC breakpoint it lays out as a horizontal scroller, where every
       link shares a row and a sliding vertical bar means nothing. Detected from
       the layout itself rather than a width, so it cannot drift out of step with
       the media query that produced it. */
    if (links.length > 1 && links[0].offsetTop === links[1].offsetTop) { clear(); return; }

    const ts = getTargets();
    if (!ts.length) return;
    const LINE = 120;   // the reading line, clear of the sticky topbar
    let i = 0;
    for (let k = 0; k < ts.length; k++) {
      if (ts[k].getBoundingClientRect().top <= LINE) i = k;
      else break;
    }
    // At the very bottom the last heading is the active one even if it has not
    // reached the line, otherwise the bar empties out at the end of the page.
    // Guarded on the page actually being taller than the viewport, or a short
    // article pins itself to the last section on load.
    const doc = document.documentElement;
    if (doc.scrollHeight - window.innerHeight > 40
        && window.scrollY + window.innerHeight >= doc.scrollHeight - 8) {
      i = ts.length - 1;
    }
    if (i === on) return;
    on = i;
    place(i);
  };

  /* No rAF throttle here. A TOC is 14-40 links, so update() is a handful of
     getBoundingClientRect calls -- well under a tenth of a millisecond, and
     scroll already fires at most once per frame. Wrapping it in
     requestAnimationFrame bought nothing measurable and made the whole thing
     unverifiable in an unfocused tab, where rAF callbacks are simply dropped. */
  const schedule = () => update();

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });

  /* Fonts and images land after mount and change every offset. Observe the
     host and re-place rather than hoping the reader scrolls. */
  let ro = null;
  const attach = () => {
    if (ro || !host.isConnected) return;
    ro = new ResizeObserver(() => { on = -1; update(); });
    ro.observe(host);
    on = -1;
    update();
  };
  if (host.isConnected) attach();
  /* the view calls scrollSpy before it is mounted, so one retry next task */
  else setTimeout(attach, 0);

  return () => {
    removeEventListener('scroll', schedule);
    removeEventListener('resize', schedule);
    if (ro) ro.disconnect();
    clear();
    ind.remove();
  };
}

/* ── pointer spotlight ───────────────────────────────────────────────
 * A radial highlight that tracks the cursor across a tile. Implemented with two
 * custom properties the CSS reads, so there is no per-element listener: one
 * delegated pointermove on the document does all of them. */
export function spotlight(root = document) {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  root.addEventListener('pointermove', (e) => {
    const t = e.target instanceof Element ? e.target.closest('.spot') : null;
    if (!t) return;
    const b = t.getBoundingClientRect();
    t.style.setProperty('--sx', ((e.clientX - b.left) / b.width * 100).toFixed(1) + '%');
    t.style.setProperty('--sy', ((e.clientY - b.top) / b.height * 100).toFixed(1) + '%');
  }, { passive: true });
}

/* ── toast ──────────────────────────────────────────────────────────── */
let toastT;
export function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ── sheet (bottom sheet / side panel) ──────────────────────────────── */
let sheetClose = null;
export function openSheet(build, opts = {}) {
  const sheet = $('#sheet'), body = $('#sheetBody');
  if (!sheet) return;
  body.innerHTML = '';
  body.append(build(closeSheet));
  sheet.hidden = false;
  sheet.classList.toggle('sheet--right', !!opts.right);
  requestAnimationFrame(() => sheet.classList.add('on'));
  document.body.style.overflow = 'hidden';
  sheetClose = closeSheet;
  $('.sheet__x', sheet)?.focus();
  document.addEventListener('keydown', onSheetKey, true);
}
function onSheetKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); closeSheet(); }
}
export function closeSheet() {
  const sheet = $('#sheet');
  if (!sheet || sheet.hidden) return;
  sheet.classList.remove('on');
  document.removeEventListener('keydown', onSheetKey, true);
  document.body.style.overflow = '';
  setTimeout(() => { sheet.hidden = true; }, 260);
  sheetClose = null;
}

/* ── glossary tooltip ───────────────────────────────────────────────── */
let tipT;
export function initTip(book) {
  const tip = $('#tip');
  if (!tip) return;
  const glossary = new Map(book.glossary.map((g) => [g.t.trim(), g.d]));

  const show = (target, x, y) => {
    const d = glossary.get(target.dataset.term);
    if (!d) return;
    tip.innerHTML = `<b>${esc(target.dataset.term)}</b>${esc(d)}`;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, x - r.width / 2), innerWidth - r.width - 8);
    const top = y - r.height - 12 < 8 ? y + 20 : y - r.height - 12;
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };
  const hide = () => { clearTimeout(tipT); tip.hidden = true; };

  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.('.term');
    if (!t) return;
    clearTimeout(tipT);
    tipT = setTimeout(() => {
      const r = t.getBoundingClientRect();
      show(t, r.left + r.width / 2, r.top);
    }, 180);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest?.('.term')) hide();
  });
  document.addEventListener('focusin', (e) => {
    const t = e.target.closest?.('.term');
    if (!t) return;
    const r = t.getBoundingClientRect();
    show(t, r.left + r.width / 2, r.top);
  });
  document.addEventListener('focusout', hide);
  addEventListener('scroll', hide, { passive: true });
}

/** Wrap glossary terms inside a plain-text node, returning a DocumentFragment. */
export function linkify(text, book) {
  const out = document.createDocumentFragment();
  if (!book.termRe) { out.append(document.createTextNode(text)); return out; }
  book.termRe.lastIndex = 0;
  let last = 0, m;
  while ((m = book.termRe.exec(text))) {
    if (m.index > last) out.append(document.createTextNode(text.slice(last, m.index)));
    out.append(el('button', { class: 'term', type: 'button', data: { term: m[0] }, tabindex: '0' }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.append(document.createTextNode(text.slice(last)));
  return out;
}

/** Highlight query terms inside plain text. */
export function hi(text, terms) {
  const out = document.createDocumentFragment();
  if (!terms.length) { out.append(document.createTextNode(text)); return out; }
  const rx = new RegExp('(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  let last = 0, m;
  while ((m = rx.exec(text))) {
    if (m.index > last) out.append(document.createTextNode(text.slice(last, m.index)));
    out.append(el('mark', { class: 'hl' }, m[0]));
    last = m.index + m[0].length;
    if (!m[0].length) rx.lastIndex++;
  }
  if (last < text.length) out.append(document.createTextNode(text.slice(last)));
  return out;
}

/* ── storage ────────────────────────────────────────────────────────── */
export const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } },
};

/* ── misc ───────────────────────────────────────────────────────────── */
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const uniq = (a) => [...new Set(a)];
export const debounce = (fn, ms = 120) => {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};