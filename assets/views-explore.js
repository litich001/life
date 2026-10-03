/* Views: item card, explore, home, chapters, chapter reader, long-form, method. */
import { el, frag, esc, linkify, hi, store, toast, openSheet, closeSheet, reveal, countUp, fmt, $$ } from './ui.js';
import { runQuery, countBy, snippet, parseQuery } from './data.js';

export const COST_LABEL = { money: '不花钱', time: '不占时间', will: '不需要毅力' };
export const CJ_LABEL = { 寿命: '换寿命', 金钱: '换金钱', 时间精力: '换时间与精力', 人身自由: '换人身自由' };
export const MAG_LABEL = { 大: '收益 大', 中: '收益 中', 小: '收益 小' };

export const marks = store.get('htlb.marks', []);
export const isMarked = (ref) => marks.includes(ref);
export function toggleMark(ref) {
  const i = marks.indexOf(ref);
  if (i < 0) marks.push(ref); else marks.splice(i, 1);
  store.set('htlb.marks', marks);
  document.dispatchEvent(new CustomEvent('marks:change'));
  toast(i < 0 ? '已标记 · 在右上角可以回看' : '已取消标记');
  return i < 0;
}

/* ── evidence badge ─────────────────────────────────────────────────── */
export function badge(ev) {
  return el('span', {
    class: 'badge', data: { ev }, title: `证据等级 ${ev}`,
    'aria-label': `证据等级 ${ev}`,
  }, ev);
}

/* ── the item card ──────────────────────────────────────────────────── */
export function itemCard(book, it, opts = {}) {
  const terms = opts.terms || [];
  const marked = isMarked(it.ref);
  const free = Object.entries(it.flags).filter(([, v]) => v).map(([k]) => COST_LABEL[k]);

  const head = el('div', { class: 'card__head' },
    el('span', { class: 'card__no num' }, String(it.ch).padStart(2, '0')),
    el('span', { class: 'card__where' }, it.chTitle, el('i', { 'aria-hidden': 'true' }, '·'),
      el('span', { class: 'card__non' }, `第 ${it.no} 条`)),
    el('div', { class: 'card__tags' },
      it.dispute ? el('span', { class: 'tag tag--warn', title: '这条有争议，正文里列了反方证据' }, '争议') : null,
      it.todo ? el('span', { class: 'tag tag--mute', title: '正文里标了待核实' }, '待核实') : null,
      badge(it.evidence),
    ),
  );

  const title = el('h3', { class: 'card__title', id: `t-${it.ref}` }, hi(it.title, terms));

  const plain = el('p', { class: 'card__plain' }, linkify(it.plain, book));

  /* One quiet metadata line instead of a wall of chips. */
  const meta = el('div', { class: 'card__meta' },
    el('span', { class: 'card__cost' }, free.length ? free.join(' · ') : '要花钱或花时间'),
    el('span', { class: 'card__cj' }, it.cj.map((c) => CJ_LABEL[c] || c).join(' / ')),
    el('span', {
      class: 'card__val', tabindex: '0',
      title: '收益量级与性价比由本站按书里公布的界线，从「收益」和「成本」两栏自动套用，属估算',
    }, it.mag === '大' ? '收益大' : it.mag === '中' ? '收益中' : '收益小', ' · ', it.value),
  );

  const actions = el('div', { class: 'card__actions' },
    el('button', {
      class: 'btn-ghost', type: 'button', 'aria-expanded': 'false',
      onclick: (e) => toggleDetail(e.currentTarget, book, it, terms),
    }, el('span', { class: 'btn-ghost__i', 'aria-hidden': 'true' }, '＋'), '原文与来源'),
    el('button', {
      class: 'iconbtn iconbtn--mark', type: 'button', 'aria-pressed': String(marked),
      'aria-label': '标记这一条', title: '标记这一条',
      onclick: (e) => {
        const on = toggleMark(it.ref);
        e.currentTarget.setAttribute('aria-pressed', String(on));
        e.currentTarget.classList.toggle('on', on);
        e.currentTarget.querySelector('.markicon').innerHTML = on ? MARKED_PATH : MARK_PATH;
      },
    }, el('span', { class: 'markicon', html: marked ? MARKED_PATH : MARK_PATH })),
  );

  const card = el('article', {
    class: 'card reveal', id: `i-${it.ref}`, data: { ref: it.ref },
  }, head, title, plain, meta, el('div', { class: 'card__tail' }, actions),
     el('div', { class: 'card__detail', hidden: true }));

  if (marked) card.classList.add('is-marked');
  if (opts.snip) {
    plain.replaceChildren(document.createTextNode(''));
    plain.append(hi(snippet(it, terms), terms));
  }
  if (opts.d) card.dataset.d = opts.d;
  return card;
}

const MARK_PATH = '<path d="M5.5 2.8h9v14.4l-4.5-3.2-4.5 3.2Z" fill="none" stroke="currentColor" stroke-width="1.6"/>';
const MARKED_PATH = '<path d="M5.5 2.8h9v14.4l-4.5-3.2-4.5 3.2Z" fill="currentColor"/>';

function toggleDetail(btn, book, it, terms) {
  const card = btn.closest('.card');
  const box = card.querySelector('.card__detail');
  const open = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!open));
  btn.querySelector('.btn-ghost__i').textContent = open ? '＋' : '－';

  if (open) {
    // Collapse, then restore [hidden] once the height transition is done so the
    // collapsed panel leaves the accessibility tree again.
    card.classList.remove('is-open');
    const done = () => { if (!card.classList.contains('is-open')) box.hidden = true; };
    box.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 420);
    return;
  }

  if (book.hydrated) {
    box.replaceChildren(detailBody(book, it, terms));
  } else {
    box.replaceChildren(el('p', { class: 'muted-note' }, '正在取原文…'));
    book.ensureDetail().then(() => {
      if (card.classList.contains('is-open')) box.replaceChildren(detailBody(book, it, terms));
    });
  }

  /* Unhide first, force layout so the transition has a start value, then open. */
  box.hidden = false;
  void box.offsetHeight;
  card.classList.add('is-open');
}

function detailBody(book, it, terms) {
  const rows = [];
  const row = (k, node) => rows.push(el('div', { class: 'drow' },
    el('div', { class: 'drow__k u-label' }, k), el('div', { class: 'drow__v' }, node)));

  row('花掉什么', linkify(it.cost, book));
  row('收益（原文数字）', linkify(it.benefit, book));
  if (it.notes) row('备注', linkify(it.notes, book));
  if (it.sources?.length) {
    row('来源', el('ul', { class: 'srcs' }, ...it.sources.map((s) => {
      const urls = s.match(/https?:\/\/\S+/g) || [];
      const clean = s.replace(/https?:\/\/\S+/g, '').replace(/[；;]\s*$/, '').trim();
      return el('li', {}, clean || s,
        ...urls.map((u) => el('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, u)));
    })));
  }
  if (it.refs?.length) {
    row('指路', el('div', { class: 'refs' }, ...it.refs.map((r) => refChip(book, r))));
  }
  return frag(...rows);
}

function refChip(book, r) {
  const target = r.no != null ? book.byId.get(`${r.ch}-${r.no}`) : null;
  const label = target ? target.title : `第 ${r.ch} 节`;
  return el('button', {
    class: 'ref', type: 'button',
    onclick: () => (target ? openRefSheet(book, target) : (location.hash = `#/ch/${r.ch}`)),
  }, el('i', { 'aria-hidden': 'true' }, '→'), r.label, el('span', { class: 'ref__t' }, label));
}

export function openRefSheet(book, it) {
  openSheet(() => {
    const head = el('div', { class: 'sheethead' },
      el('div', { class: 'u-label' }, `第 ${it.ch} 节 · 第 ${it.no} 条`),
      el('h3', { class: 'sheethead__t' }, it.title),
      el('div', { class: 'card__tags' },
        it.dispute ? el('span', { class: 'tag tag--warn' }, '争议') : null,
        badge(it.evidence)),
    );
    const plain = el('p', { class: 'card__plain' }, linkify(it.plain, book));
    const go = el('button', {
      class: 'btn btn--primary', type: 'button',
      onclick: () => { closeSheet(); location.hash = it.href; },
    }, '跳过去');
    return frag(head, plain, el('div', { class: 'sheetfoot' }, go));
  }, { right: false });
}

/* ── explore ────────────────────────────────────────────────────────── */
export function viewExplore(book, state, rerender) {
  rerenderFn = rerender;
  const res = runQuery(book, state);
  const counts = countBy(book, state);

  let hits = res.hits;
  if (state.onlyMarks) hits = hits.filter((h) => isMarked(h.it.ref));
  if (state.sort === 'ev') hits = [...hits].sort((a, b) => a.it.evidence.localeCompare(b.it.evidence) || b.sc - a.sc);
  else if (state.sort === 'val') hits = [...hits].sort((a, b) => b.it.mag.length - a.it.mag.length || b.sc - a.sc);
  else hits = [...hits].sort((a, b) => b.sc - a.sc || a.it.ch - b.it.ch || a.it.no - b.it.no);

  const root = el('div', { class: 'wrap explore' });
  root.append(el('h1', { class: 'sr-only' }, `检索全书 ${book.items.length} 条建议`));

  /* ── search bar */
  const input = el('input', {
    class: 'search__input', id: 'q', type: 'search', autocomplete: 'off',
    spellcheck: 'false', placeholder: '搜一件事：安全带、押金、加班费、噪声、离婚…',
    value: state.q, 'aria-label': '搜索 608 条建议',
  });
  input.addEventListener('input', async () => {
    state.q = input.value;
    pushUrl();
    // First keystroke waits for the long-text index so results never shift later.
    if (!book.hydrated && state.q.trim()) {
      list.setAttribute('aria-busy', 'true');
      await book.ensureDetail();
    }
    scheduleRender();
  });
  const clearBtn = el('button', {
    class: 'search__clear', type: 'button', 'aria-label': '清空',
    hidden: !state.q, onclick: () => { state.q = ''; input.value = ''; pushUrl(); rerender(); input.focus(); },
  }, '×');

  const bar = el('div', { class: 'search' },
    el('div', { class: 'search__box' },
      el('span', { class: 'search__i', 'aria-hidden': 'true' },
        el('svg', { viewBox: '0 0 20 20', width: 18, height: 18, html: '<circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M13.5 13.5 17 17" stroke="currentColor" stroke-width="1.7"/>' })),
      input, clearBtn),
    el('div', { class: 'search__hint' },
      el('span', {}, '按 ', el('kbd', {}, '/'), ' 聚焦 · '),
      el('span', {}, '支持 ', el('code', {}, '证据:A'), ' ', el('code', {}, '节:8'), ' ', el('code', {}, '换:金钱'), ' ', el('code', {}, '成本:money'))),
  );

  /* ── active filter chips */
  const chipsRow = el('div', { class: 'fchips' });
  const renderChips = () => {
    chipsRow.replaceChildren();
    const groups = [
      ['节', state.ch], ['证据', state.ev], ['换回', state.cj],
      ['成本', state.cost], ['量级', state.mag], ['性价比', state.val], ['标记', state.flag],
    ];
    let any = false;
    for (const [label, set] of groups) {
      for (const v of set) {
        any = true;
        chipsRow.append(el('button', {
          class: 'fchip', type: 'button', title: '移除这个条件',
          onclick: () => { set.delete(v); pushUrl(); rerender(); },
        }, `${label}：${prettyFacet(label, v, book)}`, el('i', { 'aria-hidden': 'true' }, '×')));
      }
    }
    if (state.onlyMarks) {
      any = true;
      chipsRow.append(el('button', {
        class: 'fchip fchip--mark', type: 'button',
        onclick: () => { state.onlyMarks = false; pushUrl(); rerender(); },
      }, '只看标记', el('i', { 'aria-hidden': 'true' }, '×')));
    }
    chipsRow.hidden = !any;
    if (any) chipsRow.append(el('button', {
      class: 'fchip fchip--reset', type: 'button',
      onclick: () => resetFacets(state, pushUrl, rerender),
    }, '全部清除'));
  };
  renderChips();

  /* ── sidebar facets */
  const rail = el('aside', { class: 'rail', 'aria-label': '筛选条件' },
    el('div', { class: 'rail__head' },
      el('span', { class: 'u-label' }, '筛选'),
      el('button', {
        class: 'rail__toggle', type: 'button', 'aria-expanded': 'false',
        onclick: (e) => {
          const on = rail.dataset.open === '1';
          rail.dataset.open = on ? '0' : '1';
          e.currentTarget.setAttribute('aria-expanded', String(!on));
          rail.querySelector('.rail__toggle').textContent = (on ? '展开' : '收起')
            + (nActive ? `（${nActive}）` : '');
        },
      }, '展开'),
      el('button', { class: 'rail__reset', type: 'button', onclick: () => resetFacets(state, pushUrl, rerender) }, '重置')),
    el('div', { class: 'rail__body' },
      facetGroup('换回什么', state.cj, counts.cj, book.facets.cj, (v) => CJ_LABEL[v] || v, 'cj'),
      facetGroup('证据等级', state.ev, counts.ev, book.facets.ev, (v) => `等级 ${v}`, 'ev'),
      facetGroup('花掉什么', state.cost, counts.cost, book.facets.cost, (v) => COST_LABEL[v] || v, 'cost'),
      facetGroup('收益量级', state.mag, counts.mag, book.facets.mag, (v) => MAG_LABEL[v] || v, 'mag'),
      facetGroup('性价比', state.val, counts.val, book.facets.val, (v) => v, 'val'),
      facetGroup('章节', state.ch, counts.ch, book.chapters.map((c) => [c.no, String(c.no)]),
        (v) => `${v}. ${book.chTitle.get(+v)}`, 'ch'),
      el('div', { class: 'rail__note' },
        el('p', {}, '收益量级与性价比是本站按方法论公布的界线自动套用的估算。'),
        el('p', {}, el('a', { href: '#/method' }, '看方法论 →')))),
  );
  // A search term alone must not push the results below the fold: the panel only
// starts open when the reader has actually picked facets.
const nActive = ['ev', 'ch', 'cj', 'cost', 'mag', 'val', 'flag']
  .reduce((n, k) => n + state[k].size, 0);
  rail.dataset.open = nActive ? '1' : '0';
  const toggle = rail.querySelector('.rail__toggle');
  const label = () => {
    toggle.textContent = (rail.dataset.open === '1' ? '收起' : '展开')
      + (nActive ? `（${nActive}）` : '');
  };
  label();
  toggle.setAttribute('aria-expanded', String(nActive > 0));
  toggle.setAttribute('aria-label', nActive ? `筛选条件，当前 ${nActive} 个` : '筛选条件');

  /* ── results */
  const head = el('div', { class: 'res__head' },
    el('div', { class: 'res__count' },
      el('b', { class: 'num' }, fmt(hits.length)),
      el('span', {}, hits.length === 1 ? ' 条' : ' 条'),
      el('span', { class: 'res__of' }, ` / ${fmt(book.items.length)}`)),
    res.relaxed ? el('div', { class: 'res__relaxed' },
      '没有同时命中全部词的条目，已改为「命中任意一个词」') : null,
    el('div', { class: 'res__tools' },
      sortSel(state, rerender),
      el('button', {
        class: 'ghostbtn', type: 'button', 'aria-pressed': String(state.onlyMarks),
        onclick: () => { state.onlyMarks = !state.onlyMarks; pushUrl(); rerender(); },
      }, `标记 ${marks.length}`),
    ),
  );

  const list = el('div', { class: 'cards cards--grid' });
  if (!hits.length) {
    list.append(emptyState(book, state, pushUrl, rerender));
  } else {
    const step = Math.max(1, Math.ceil(hits.length / 60));
    hits.slice(0, state.page * 60 || 60).forEach((h, i) => {
      list.append(itemCard(book, h.it, { terms: res.terms, d: i % step }));
    });
    if (hits.length > (state.page * 60 || 60)) {
      list.append(el('button', {
        class: 'loadmore', type: 'button',
        onclick: () => { state.page = (state.page || 1) + 1; rerender(); },
      }, `再看 ${Math.min(60, hits.length - (state.page * 60 || 60))} 条`));
    }
  }

  const main = el('div', { class: 'res' },
    el('h2', { class: 'sr-only' }, '结果'),
    head, list);

  root.append(el('div', { class: 'explore__top' }, bar, chipsRow),
              el('div', { class: 'explore__body' }, rail, main));
  reveal(root);
  return root;
}

function prettyFacet(label, v, book) {
  if (label === '节') return `${v} ${book?.chTitle.get(+v) ?? ''}`.trim();
  if (label === '成本') return COST_LABEL[v] || v;
  if (label === '换回') return CJ_LABEL[v] || v;
  if (label === '量级') return MAG_LABEL[v] || v;
  if (label === '标记') return v === 'dispute' ? '争议' : '待核实';
  if (label === '证据') return `等级 ${v}`;
  return v;
}

function facetGroup(title, set, live, all, label, key) {
  const total = new Map(all);
  for (const [k, v] of (live || new Map())) total.set(k, v);
  const keys = [...total.keys()].sort((a, b) => (total.get(b) || 0) - (total.get(a) || 0));
  return el('fieldset', { class: 'facet' },
    el('legend', { class: 'facet__t u-label' }, title),
    el('div', { class: 'facet__list' }, ...keys.map((k) => {
      const n = total.get(k) || 0;
      return el('label', { class: 'facet__i', data: { on: set.has(String(k)) ? '1' : '0', zero: n ? '0' : '1' } },
        el('input', {
          type: 'checkbox', checked: set.has(String(k)),
          onchange: () => {
            const v = String(k);
            set.has(v) ? set.delete(v) : set.add(v);
            pushUrl(); rerenderFn();
          },
        }),
        el('span', { class: 'facet__box', 'aria-hidden': 'true' }),
        el('span', { class: 'facet__l' }, label(k)),
        el('span', { class: 'facet__n num' }, fmt(n)));
    })));
}

function sortSel(state, rerender) {
  const sel = el('select', {
    class: 'select', 'aria-label': '排序方式',
    onchange: (e) => { state.sort = e.target.value; pushUrl(); rerender(); },
  });
  for (const [v, t] of [['relevance', '按相关度'], ['book', '按书的顺序'], ['ev', '按证据等级']]) {
    sel.append(el('option', { value: v, selected: state.sort === v }, t));
  }
  return sel;
}

function emptyState(book, state, pushUrl, rerender) {
  const has = state.q || state.ev.size || state.cj.size || state.cost.size ||
              state.ch.size || state.mag.size || state.val.size || state.flag.size || state.onlyMarks;
  return el('div', { class: 'empty' },
    el('p', { class: 'empty__t' }, has ? '没有一条同时满足这些条件。' : '输入一个词试试。'),
    el('p', { class: 'empty__d' },
      '可以搜具体的事（', el('em', {}, '押金'), '、', el('em', {}, '加班费'), '、', el('em', {}, '噪声'),
      '），也可以用条件：', el('code', {}, '证据:A'), ' ', el('code', {}, '节:8'), ' ',
      el('code', {}, '换:金钱'), ' ', el('code', {}, '成本:money'), '。'),
    has ? el('button', { class: 'btn', type: 'button', onclick: () => resetFacets(state, pushUrl, rerender) },
      '把条件清掉') : null);
}

export function resetFacets(state, pushUrl, rerender) {
  for (const k of ['ev', 'ch', 'cj', 'cost', 'mag', 'val', 'flag']) state[k].clear();
  state.onlyMarks = false;
  state.page = 1;
  pushUrl(); rerender();
}

/* ── keyboard navigation through the result list ──────────────────── */
let kbdBound = false;
let activeIdx = -1;

function cards() {
  return $$('.cards--grid .card, .res .card');
}

function setActive(i) {
  const list = cards();
  if (!list.length) return;
  activeIdx = Math.max(0, Math.min(list.length - 1, i));
  list.forEach((c, k) => c.classList.toggle('is-active', k === activeIdx));
  const node = list[activeIdx];
  node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  node.querySelector('.btn-ghost')?.focus({ preventScroll: true });
}

export function initKeyboardNav() {
  if (kbdBound) return;
  kbdBound = true;
  addEventListener('keydown', (e) => {
    if (!location.hash.startsWith('#/explore')) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); setActive(activeIdx + 1); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); setActive(activeIdx - 1); }
    else if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.classList.contains('btn-ghost')) {
      e.preventDefault();
      document.activeElement.click();
    }
  });
}

export function pushUrl() {
  const p = new URLSearchParams();
  if (state0.q) p.set('q', state0.q);
  for (const k of ['ev', 'ch', 'cj', 'cost', 'mag', 'val', 'flag']) {
    if (state0[k].size) p.set(k, [...state0[k]].join(','));
  }
  if (state0.onlyMarks) p.set('marks', '1');
  if (state0.sort !== 'relevance') p.set('sort', state0.sort);
  const qs = p.toString();
  history.replaceState(null, '', `#/explore${qs ? '?' + qs : ''}`);
}
let state0 = {};
let rerenderFn = () => {};
export function bindState(s) { state0 = s; }

let scheduleT;
export function scheduleRender() {
  clearTimeout(scheduleT);
  scheduleT = setTimeout(() => document.dispatchEvent(new CustomEvent('app:rerender')), 130);
}