/* Command palette — the one input that can reach anything on the site.
 *
 * Replaces "focus the search box" as the primary shortcut. Search here is a
 * superset of the explore page: it also jumps to chapters, long-form pieces
 * and static pages, so / or Cmd-K is a genuinely useful thing to hit cold.
 */
import { el, hi, fmt } from './ui.js';
import { runQuery } from './data.js';

let book = null;
let open = false;
let nodes = null;
let cursor = 0;
let rows = [];

const PAGES = [
  { g: '页面', t: '首页', h: '从这里开始', href: '#/' },
  { g: '页面', t: '检索', h: '按关键词和条件筛', href: '#/explore' },
  { g: '页面', t: '章节', h: '按节读', href: '#/chapters' },
  { g: '页面', t: '长文', h: '把一件事讲到底', href: '#/long' },
  { g: '页面', t: '口径', h: '这些条目怎么算账', href: '#/method' },
  { g: '页面', t: '关于', h: '作者与出处', href: '#/about' },
];

/* ── shell ──────────────────────────────────────────────────────────── */

function build() {
  if (nodes) return;

  const input = el('input', {
    class: 'pal__input', type: 'search', autocomplete: 'off', spellcheck: 'false',
    placeholder: '搜一件事，或输入章节、页面…',
    'aria-label': '全站检索', role: 'combobox', 'aria-expanded': 'true',
    'aria-controls': 'palList', 'aria-autocomplete': 'list',
  });

  const list = el('div', { class: 'pal__list', id: 'palList', role: 'listbox' });

  const panel = el('div', { class: 'pal__panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': '检索' },
    el('div', { class: 'pal__head' },
      el('span', { class: 'pal__ico', 'aria-hidden': 'true' }, '⌘'),
      input,
      el('button', { class: 'pal__esc', type: 'button', onclick: () => close() }, 'esc')),
    list,
    el('div', { class: 'pal__foot' },
      el('span', {}, el('kbd', {}, '↑'), el('kbd', {}, '↓'), ' 选择'),
      el('span', {}, el('kbd', {}, '↵'), ' 打开'),
      el('span', {}, el('kbd', {}, 'esc'), ' 关闭')));

  const root = el('div', { class: 'pal', hidden: true },
    el('div', { class: 'pal__scrim', onclick: () => close() }), panel);

  document.body.append(root);
  nodes = { root, panel, input, list };

  input.addEventListener('input', () => { cursor = 0; render(); });
  input.addEventListener('keydown', onKey);
  root.addEventListener('mousedown', (e) => {
    if (!panel.contains(e.target)) { e.preventDefault(); close(); }
  });
}

function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); close(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!rows.length) return;
    cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
    paint();
    rows[cursor].node.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    const r = rows[cursor];
    if (r) { location.hash = r.href; close(); }
  }
}

/* ── results ────────────────────────────────────────────────────────── */

/** Rank everything reachable, then group for display. */
function collect(q) {
  const out = [];
  const term = q.trim().toLowerCase();
  const hit = (...fields) => {
    if (!term) return true; // empty query matches everything; caller trims the list
    return fields.some((f) => f && f.toLowerCase().includes(term));
  };

  for (const s of book.situations || []) {
    if (hit(s.title, s.hint)) {
      out.push({ g: '情境', t: s.title, h: s.hint, href: s.href, no: s.no });
    }
  }

  if (term) {
    for (const c of book.chapters) {
      if (hit(c.title, c.blurb) || String(c.no) === term) {
        out.push({
          g: '章节',
          t: `${String(c.no).padStart(2, '0')} ${c.title}`,
          h: `${c.stats.n} 条`,
          href: `#/ch/${c.no}`,
          no: String(c.no).padStart(2, '0'),
        });
      }
    }

    for (const a of book.appendices) {
      if (hit(a.title, a.lead)) out.push({ g: '长文', t: a.title, h: a.lead.slice(0, 30), href: `#/long/${a.id}` });
    }
  }

  for (const p of PAGES) {
    if (hit(p.t, p.h)) out.push({ g: '页面', t: p.t, h: p.h, href: p.href });
  }

  if (term) {
    const { hits } = runQuery(book, { q: term, ev: [], ch: [], cj: [], cost: [], mag: [], val: [], flag: [] });
    for (const { it } of hits.slice(0, 40)) {
      out.push({ g: '条目', t: it.title, h: it.plain, href: `#/ch/${it.ch}/${it.no}`, ref: it.ref });
    }
  }

  return out;
}

function render() {
  const q = nodes.input.value;
  let all = collect(q);

  /* Nothing typed: lead with the situations rather than an alphabetical dump. */
  if (!q.trim()) all = all.filter((r) => r.g === '情境' || r.g === '页面');

  /* Cap each group so one broad term can't bury the rest. */
  const perGroup = q.trim() ? 6 : 8;
  const seen = new Map();
  rows = [];
  for (const r of all) {
    const n = (seen.get(r.g) || 0) + 1;
    seen.set(r.g, n);
    if (n > perGroup) continue;
    r.node = null;
    rows.push(r);
  }

  if (!rows.length) {
    nodes.list.replaceChildren(el('p', { class: 'pal__none' },
      q.trim() ? `没有找到和「${q.trim()}」有关的。` : '输入点什么。'));
    return;
  }

  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.g)) groups.set(r.g, []);
    groups.get(r.g).push(r);
  }

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const frag = document.createDocumentFragment();

  for (const [g, list] of groups) {
    frag.append(el('div', { class: 'pal__g', 'aria-hidden': 'true' }, g));
    for (const r of list) {
      const row = el('a', {
        class: 'pal__row', href: r.href, role: 'option', id: `pal-${rows.indexOf(r)}`,
        onclick: () => close(),
      },
        r.no ? el('span', { class: 'pal__no num' }, r.no) : null,
        el('span', { class: 'pal__b' },
          el('span', { class: 'pal__t' }, hi(r.t, terms)),
          el('span', { class: 'pal__d' }, r.h.length > 76 ? r.h.slice(0, 76) + '…' : r.h)));
      r.node = row;
      frag.append(row);
    }
  }
  nodes.list.replaceChildren(frag);
  paint();
}

function paint() {
  rows.forEach((r, i) => {
    if (!r.node) return;
    const on = i === cursor;
    r.node.classList.toggle('is-on', on);
    r.node.setAttribute('aria-selected', String(on));
  });
}

/* ── open / close ───────────────────────────────────────────────────── */

export function openPalette(b) {
  book = b;
  build();
  if (open) { nodes.input.focus(); return; }
  open = true;
  nodes.root.hidden = false;
  nodes.input.value = '';
  cursor = 0;
  render();
  /* Commit the base (opacity 0 / offset) state before flipping to .is-on so the
     transition has a start value. Doing this with a forced reflow rather than
     requestAnimationFrame keeps it working in a background tab, where rAF never
     fires and the panel would otherwise stay invisible. */
  void nodes.root.offsetHeight;
  nodes.root.classList.add('is-on');
  nodes.input.focus();
  document.documentElement.classList.add('has-pal');
}

export function closePalette() {
  if (!open || !nodes) return;
  open = false;
  nodes.root.classList.remove('is-on');
  document.documentElement.classList.remove('has-pal');
  setTimeout(() => { if (!open) nodes.root.hidden = true; }, 220);
}

export const paletteOpen = () => open;
export { fmt };