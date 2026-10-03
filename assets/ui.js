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