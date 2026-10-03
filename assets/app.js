/* Router + boot. */
import { $, $$, el, theme, reveal, revealAll, initTip, toast, store, closeSheet, fmt } from './ui.js';
import { loadBook } from './data.js';
import { viewExplore, bindState, pushUrl, marks, resetFacets, initKeyboardNav } from './views-explore.js';
import { viewHome, viewChapters, viewChapter, viewLong, viewMethod, viewAbout, applyJump } from './views-pages.js';
import { openPalette, closePalette, paletteOpen } from './palette.js';

const main = $('#main');
const state = {
  q: '', ev: new Set(), ch: new Set(), cj: new Set(), cost: new Set(),
  mag: new Set(), val: new Set(), flag: new Set(),
  sort: 'relevance', onlyMarks: false, page: 1,
};
bindState(state);

let book = null;
let current = '';

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const p = new URLSearchParams(qs || '');
  return { parts: path.split('/').filter(Boolean), q: p };
}

function readExploreParams(p) {
  state.q = p.get('q') || '';
  for (const k of ['ev', 'ch', 'cj', 'cost', 'mag', 'val', 'flag']) {
    state[k] = new Set((p.get(k) || '').split(',').filter(Boolean));
  }
  state.onlyMarks = p.get('marks') === '1';
  state.sort = p.get('sort') || 'relevance';
  state.page = 1;
}

function route() {
  if (!book) return;
  closeSheet();
  const { parts, q } = parseHash();
  const key = parts.join('/');
  const rerender = () => { route(); };
  let view;

  switch (parts[0]) {
    case undefined:
    case '':
      view = viewHome(book, state); break;
    case 'explore':
      readExploreParams(q);
      view = viewExplore(book, state, rerender); break;
    case 'chapters':
      view = viewChapters(book); break;
    case 'ch': {
      const no = +parts[1];
      const jump = parts[2] != null ? +parts[2] : null;
      view = viewChapter(book, no, jump);
      break;
    }
    case 'long':
      view = viewLong(book, parts[1]); break;
    case 'method':
      view = viewMethod(book); break;
    case 'about':
      view = viewAbout(book); break;
    default:
      location.replace('#/');
      return;
  }

  main.replaceChildren(view);
  current = key;
  syncNav(parts[0] || 'home');
  afterRender(parts);
}

function afterRender(parts) {
  document.title = titleFor(parts);
  if (!['ch', 'long'].includes(parts[0])) scrollTo({ top: 0, behavior: 'instant' });
  requestAnimationFrame(() => { reveal(main); updateProgress(); applyJump(); });
  const jump = document.getElementById(location.hash.split('/').pop());
  if (jump && parts.length > 1) jump.scrollIntoView({ block: 'start' });
}

function titleFor(parts) {
  const base = '高性价比人生指南';
  if (parts[0] === 'ch') {
    const c = book.chapters.find((x) => x.no === +parts[1]);
    return c ? `${String(c.no).padStart(2, '0')} ${c.title} · ${base}` : base;
  }
  if (parts[0] === 'long') {
    const a = book.appendices.find((x) => x.id === parts[1]);
    return a ? `${a.title} · ${base}` : base;
  }
  if (parts[0] === 'explore') return state.q ? `${state.q} · 检索 · ${base}` : `检索 608 条 · ${base}`;
  if (parts[0] === 'chapters') return `33 节 · ${base}`;
  if (parts[0] === 'method') return `方法论 · ${base}`;
  if (parts[0] === 'about') return `关于 · ${base}`;
  return base;
}

function syncNav(name) {
  $$('.nav a').forEach((a) => {
    const on = a.dataset.nav === name || (name === 'ch' && a.dataset.nav === 'chapters');
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function updateProgress() {
  const h = document.documentElement.scrollHeight - innerHeight;
  const p = h > 0 ? Math.min(1, scrollY / h) : 0;
  $('#progress').firstElementChild.style.width = (p * 100).toFixed(2) + '%';
}

addEventListener('scroll', updateProgress, { passive: true });
addEventListener('hashchange', route);
document.addEventListener('app:rerender', () => {
  if (!location.hash.startsWith('#/explore')) return;
  const { parts } = parseHash();
  if (parts[0] !== 'explore') return;
  main.replaceChildren(viewExplore(book, state, () => route()));
  const input = $('#q');
  if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
});

/* ── marks badge ────────────────────────────────────────────────────── */
function syncMarks() {
  const n = marks.length;
  $('#markCount').textContent = String(n);
  $('#markCount').dataset.empty = n ? '0' : '1';
  $('#markBtn').setAttribute('aria-label', n ? `我标记过的条目（${n}）` : '还没有标记任何条目');
  if (location.hash.startsWith('#/explore')) route();
}
document.addEventListener('marks:change', syncMarks);

/* ── keyboard ───────────────────────────────────────────────────────── */
addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  /* The palette owns its own keys while it is up. */
  if (paletteOpen()) {
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    return;
  }

  /* Cmd/Ctrl-K from anywhere, including inside a field. */
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    openPalette(book);
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '/') {
    e.preventDefault();
    openPalette(book);
    return;
  }

  if (e.key === '/' && !typing) {
    e.preventDefault();
    openPalette(book);
    return;
  }
  if (typing) {
    if (e.key === 'Escape') document.activeElement.blur();
    return;
  }
  const map = { h: '#/', e: '#/explore', c: '#/chapters', l: '#/long', m: '#/method', a: '#/about' };
  if (map[e.key]) { location.hash = map[e.key]; }
  if (e.key === '?') toast('快捷键：⌘K 或 / 检索 · h 概览 · e 检索 · c 章节 · l 长文 · m 方法论 · a 关于');
});

/* ── theme ──────────────────────────────────────────────────────────── */
function applyTheme() {
  theme.set(theme.get());
  const dark = theme.resolved() === 'dark';
  document.querySelector('meta[name="theme-color"]:not([media])')
    ?.setAttribute('content', dark ? '#0A0A0B' : '#F7F6F2');
}
$('#palBtn').addEventListener('click', () => openPalette(book));

$('#themeBtn').addEventListener('click', () => {
  const order = ['auto', 'light', 'dark'];
  theme.set(order[(order.indexOf(theme.get()) + 1) % 3]);
  applyTheme();
  toast('配色：' + { auto: '跟随系统', light: '浅色', dark: '深色' }[theme.get()]);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();

$('#markBtn').addEventListener('click', () => {
  if (!marks.length) { toast('还没有标记任何条目 · 在条目右下角点一下书签'); return; }
  location.hash = '#/explore?marks=1';
});

$$('[data-close]').forEach((n) => n.addEventListener('click', closeSheet));

addEventListener('beforeprint', revealAll);
window.__qa = { revealAll, book: () => book, state };
document.documentElement.classList.add('js');

/* ── boot ───────────────────────────────────────────────────────────── */
(async function boot() {
  const loader = el('div', { class: 'wrap boot' },
    el('div', { class: 'boot__bar' }, el('i')),
    el('p', { class: 'u-label' }, '正在载入 608 条建议…'));
  main.replaceChildren(loader);
  try {
    book = await loadBook();
  } catch (err) {
    main.replaceChildren(el('div', { class: 'wrap boot boot--err' },
      el('h1', {}, '数据没载入成功'),
      el('p', {}, '这个站点需要 data/book.json。如果你是在本地打开文件，浏览器不允许网页读本地文件，'
        + '请用一个静态服务器，例如：'),
      el('pre', {}, 'python -m http.server 8000'),
      el('p', {}, '然后打开 http://localhost:8000/')));
    return;
  }
  initTip(book);
  bindState(state);
  initKeyboardNav();
  syncMarks();
  fillFooter();
  route();
  window.__book = book;
  // Warm the long-text index in the background; the first search awaits it so
  // results never change underneath the reader.
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
  idle(() => book.ensureDetail());
})();

function fillFooter() {
  const m = book.meta;
  $('#footNote').textContent = m.subtitle + ' ' + m.tagline;
  $('#footStats').innerHTML =
    `${m.chapters} 节 · ${fmt(m.items)} 条<br>`
    + `A ${m.evidence.A} / B ${m.evidence.B} / C ${m.evidence.C}`;
  $('#footRepo').href = m.sourceRepo;
  $('#footHash').textContent = location.host || 'localhost';
}