/* Home, chapter index, chapter reader, long-form reader, methodology. */
import { el, frag, linkify, reveal, fmt, openSheet, closeSheet, toast, icon } from './ui.js';
import { itemCard, openRefSheet, isMarked, toggleMark, marks, badge, CJ_LABEL } from './views-explore.js';
import { runQuery } from './data.js';

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const cn = (n) => (n <= 10 ? CN[n] : n < 20 ? '十' + CN[n - 10] : CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : ''));

function sectionHead(label, title, extra) {
  return el('div', { class: 'sec-head reveal' },
    el('span', { class: 'u-label' }, label), el('h2', {}, title),
    extra ? el('span', { class: 'sec-head__x' }, extra) : null);
}

/* Words people actually type into this, offered as one-tap starting points. */
const EXAMPLES = ['押金', '加班费', '噪声', '离婚', '租房', '体检', '失眠', '裁员', '低保', '疫苗'];

/* ── home ───────────────────────────────────────────────────────────── */
export function viewHome(book, state) {
  const m = book.meta;
  const root = el('div', { class: 'home' });

  /* ── hero: the search box is the headline ────────────────────────── */
  const input = el('input', {
    class: 'find__input', type: 'search', autocomplete: 'off', spellcheck: 'false',
    placeholder: '押金没退、睡不着、刚被裁……',
    'aria-label': '搜索建议', enterkeyhint: 'search',
  });
  const counter = el('p', { class: 'find__count', 'aria-live': 'polite' });

  const go = (q) => { location.hash = `#/explore?q=${encodeURIComponent(q)}`; };

  /* The count has to match what the explore page will show. Search also matches
     cost / benefit / notes, and those now live in detail.json, so the count is
     only trustworthy once that has loaded -- otherwise it under-reports. Recount
     when it lands rather than showing a number we know is too low. */
  const paint = () => {
    const q = input.value.trim();
    if (!q) { counter.textContent = ''; counter.className = 'find__count'; return; }
    const n = runQuery(book, {
      q, ev: [], ch: [], cj: [], cost: [], mag: [], val: [], flag: [],
    }).hits.length;
    counter.textContent = n ? `找到 ${n} 条，按回车看全部` : '没有匹配，换个词试试';
    counter.className = n ? 'find__count' : 'find__count is-empty';
  };

  let recount = null;
  input.addEventListener('input', () => {
    paint();
    if (book.hydrated) return;
    if (!recount) {
      recount = book.ensureDetail().then(() => { recount = null; paint(); });
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (input.value.trim()) go(input.value.trim()); }
  });

  const examples = el('div', { class: 'find__eg' },
    el('span', { class: 'find__egl' }, '试试'),
    ...EXAMPLES.map((w) => el('a', { class: 'find__chip', href: `#/explore?q=${encodeURIComponent(w)}` }, w)));

  /* Three ways in besides free text. Each one is a real query, not a label. */
  const quick = el('div', { class: 'quick' },
    el('span', { class: 'quick__l' }, '按证据'),
    ...[['A', m.evidence.A], ['B', m.evidence.B], ['C', m.evidence.C]].map(([k, n]) =>
      el('a', { class: 'quick__c', href: `#/explore?ev=${k}` },
        el('b', { class: 'num' }, k), el('span', { class: 'num' }, `${n} 条`))),
    el('span', { class: 'quick__sep', 'aria-hidden': 'true' }),
    el('span', { class: 'quick__l' }, '按成本'),
    ...[['money', '不花钱'], ['time', '不占时间'], ['will', '不需要毅力']].map(([k, label]) =>
      el('a', {
        class: 'quick__c', href: `#/explore?cost=${k}`,
        title: `${label}的条目`,
      }, label)));

  const hero = el('section', { class: 'poster' },
    el('div', { class: 'wrap poster__in' },
      el('div', { class: 'poster__main' },
        el('h1', { class: 'poster__title' },
          '用最少的钱、时间和精力，', el('br'),
          '换回', el('em', {}, '寿命'), '、金钱和自由'),

        el('form', {
          class: 'find', role: 'search',
          onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) go(input.value.trim()); },
        },
          el('span', { class: 'find__ico', 'aria-hidden': 'true' },
            el('svg', { viewBox: '0 0 20 20', width: 17, height: 17 },
              el('circle', { cx: '8.5', cy: '8.5', r: '5.6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7' }),
              el('path', { d: 'M12.8 12.8 17 17', stroke: 'currentColor', 'stroke-width': '1.7', fill: 'none', 'stroke-linecap': 'round' }))),
          input,
          el('button', { class: 'find__go', type: 'submit' }, '搜索'),
          el('kbd', { class: 'find__kbd', 'aria-hidden': 'true' }, '/')),

        counter,
        examples,
        quick),

      el('aside', { class: 'poster__side' },
        el('div', { class: 'ledger__t' }, '证据分级'),
        el('div', { class: 'ledger__b' }, statBar('A', m.evidence.A, m.items)),
        el('div', { class: 'ledger__b' }, statBar('B', m.evidence.B, m.items)),
        el('div', { class: 'ledger__b' }, statBar('C', m.evidence.C, m.items)),
        el('p', { class: 'ledger__n' },
          el('a', { href: '#/method' }, '分级标准与算法'))),

    el('div', { class: 'poster__cta' },
        el('a', { class: 'cta cta--fire', href: '#/explore?ch=13' },
          el('span', { class: 'cta__ico' }, icon('pulse', 18)),
          el('b', {}, '情况紧急'),
          el('span', {}, '有人倒地、受伤、突然不舒服')),
        el('a', { class: 'cta', href: '#/explore' },
          el('span', { class: 'cta__ico' }, icon('filter', 18)),
          el('b', {}, '按条件筛'),
          el('span', {}, `${m.items} 条，按成本、证据、口径筛`)),
        el('a', { class: 'cta', href: '#/chapters' },
          el('span', { class: 'cta__ico' }, icon('book', 18)),
          el('b', {}, '按章节看'),
          el('span', {}, `${m.chapters} 节，每节内按性价比排`)))));

  root.append(hero);

  /* ── situations, grouped by what kind of problem it is ───────────── */
  const sitWrap = el('section', { class: 'wrap' });
  sitWrap.append(el('div', { class: 'band' },
    el('h2', {}, '你想了解什么情况'),
    el('p', { class: 'band__d' }, '按遇到的事情分了几类，点进去就是筛好的条目。')));

  const groups = book.situationGroups || [];
  const byGroup = new Map(groups.map((g) => [g, []]));
  for (const s of book.situations) {
    if (!byGroup.has(s.g)) byGroup.set(s.g, []);
    byGroup.get(s.g).push(s);
  }

  for (const [name, list] of byGroup) {
    if (!list.length) continue;
    const block = el('div', { class: 'sitgroup' },
      el('div', { class: 'sitgroup__t' },
        el('span', { class: 'sitgroup__dot', 'aria-hidden': 'true' }),
        name,
        el('span', { class: 'sitgroup__n num' }, `${list.length} 类`)));
    const grid = el('div', { class: 'situations' });
    for (const s of list) {
      grid.append(el('a', { class: 'sit', href: s.href },
        el('span', { class: 'sit__ico' }, icon(s.icon, 19)),
        el('span', { class: 'sit__b' },
          el('span', { class: 'sit__t' }, s.title),
          el('span', { class: 'sit__h' }, s.hint))));
    }
    block.append(grid);
    sitWrap.append(block);
  }
  root.append(sitWrap);

  /* ── free and high-value ───────────────────────────────────────────── */
  const seven = book.items.filter((i) => i.value === '极高').slice(0, 7);
  const sevenWrap = el('section', { class: 'wrap' });
  sevenWrap.append(el('div', { class: 'band' },
    el('h2', {}, '不花钱、不占时间、不费毅力'),
    el('p', { class: 'band__d' },
      `符合这三条的共 ${book.items.filter((i) => i.value === '极高').length} 条，先看前 ${seven.length} 条。`),
    el('a', { class: 'band__more', href: '#/explore?val=' + encodeURIComponent('极高') }, '查看全部')));
  const poster = el('ol', { class: 'seven' });
  seven.forEach((it, i) => {
    poster.append(el('li', { class: 'seven__i reveal', data: { d: i % 4 } },
      el('a', { href: it.href },
        el('span', { class: 'seven__no num' }, String(i + 1).padStart(2, '0')),
        el('span', { class: 'seven__b' },
          el('span', { class: 'seven__t' }, it.title),
          el('span', { class: 'seven__p' }, it.plain.length > 96 ? it.plain.slice(0, 96) + '…' : it.plain)),
        badge(it.evidence))));
  });
  sevenWrap.append(poster);
  root.append(sevenWrap);

  /* ── the four measures ─────────────────────────────────────────────── */
  const resWrap = el('section', { class: 'wrap' });
  resWrap.append(el('div', { class: 'band' },
    el('h2', {}, '每条建议算的是哪一种回报'),
    el('p', { class: 'band__d' }, '四类之间不换算，也不能直接比大小。')));
  const resGrid = el('div', { class: 'res res--4' });
  const RES_ICON = { '寿命': 'heart', '时间与精力': 'clock', '金钱': 'wallet', '人身自由': 'shield' };
  for (const r of book.method.resources) {
    const key = r.k === '时间与精力' ? '时间精力' : r.k;
    const n = book.items.filter((i) => i.cj.includes(key)).length;
    resGrid.append(el('a', {
      class: 'res__cell reveal', href: '#/explore?cj=' + encodeURIComponent(key),
    },
      el('span', { class: 'res__ico' }, icon(RES_ICON[r.k] || 'tag', 18)),
      el('div', { class: 'res__k' }, r.k),
      el('div', { class: 'res__d' }, r.d),
      el('div', { class: 'res__n num' }, `${fmt(n)} 条`)));
  }
  resWrap.append(resGrid);
  root.append(resWrap);

  /* ── chapter index, dense ─────────────────────────────────────────── */
  const chWrap = el('section', { class: 'wrap' });
  chWrap.append(el('div', { class: 'band' },
    el('h2', {}, `按 ${book.chapters.length} 节浏览`),
    el('p', { class: 'band__d' },
      '节标题说的是这一节要防的结果，具体做不做看条目标题。')));
  const idx = el('div', { class: 'index33' });
  book.chapters.forEach((c, i) => {
    idx.append(el('a', { class: 'idx33 reveal', data: { d: i % 6 }, href: `#/ch/${c.no}` },
      el('span', { class: 'idx33__no num' }, String(c.no).padStart(2, '0')),
      el('span', { class: 'idx33__t' }, c.title),
      el('span', { class: 'idx33__b' }, c.blurb.slice(0, 34) + (c.blurb.length > 34 ? '…' : '')),
      el('span', { class: 'idx33__n num' }, c.stats.n)));
  });
  chWrap.append(idx);
  root.append(chWrap);

  /* ── long-form ─────────────────────────────────────────────────────── */
  const lWrap = el('section', { class: 'wrap' });
  lWrap.append(el('div', { class: 'band' },
    el('h2', {}, '长文'),
    el('p', { class: 'band__d' }, '五个话题各写一篇，含对照表和决策表。')));
  const lg = el('div', { class: 'longgrid' });
  book.appendices.forEach((a, i) => {
    lg.append(el('a', { class: 'lg reveal', data: { d: i }, href: `#/long/${a.id}` },
      el('span', { class: 'lg__ico' }, icon('book', 17)),
      el('span', { class: 'lg__t' }, a.title)));
  });
  lWrap.append(lg);
  root.append(lWrap);

  reveal(root);
  return root;
}

function statBar(label, n, total) {
  return el('div', { class: 'sbar' },
    el('span', { class: 'sbar__l num' }, label),
    el('span', { class: 'sbar__t' }, el('i', { style: `width:${(n / total * 100).toFixed(1)}%` })),
    el('span', { class: 'sbar__n num' }, String(n)));
}

/* ── chapter index ──────────────────────────────────────────────────── */
export function viewChapters(book) {
  const root = el('div', { class: 'wrap' });
  root.append(el('div', { class: 'pagehead' },
    el('span', { class: 'u-label' }, `33 节 · ${fmt(book.items.length)} 条`),
    el('h1', {}, '章节'),
    el('p', {}, '每节内的条目按性价比从高到低排列。节标题说的是这一节要防的结果，具体做不做以条目标题为准。')));

  const grid = el('div', { class: 'chgrid' });
  book.chapters.forEach((c, i) => {
    const bar = el('div', { class: 'chcard__bar' });
    for (const e of ['A', 'B', 'C']) {
      if (c.stats[e]) bar.append(el('i', { data: { e }, style: `flex:${c.stats[e]}` }));
    }
    grid.append(el('a', {
      class: 'chcard reveal', data: { d: i % 8 }, href: `#/ch/${c.no}`,
    },
      el('div', { class: 'chcard__top' },
        el('span', { class: 'chcard__no' }, String(c.no).padStart(2, '0')),
        el('span', { class: 'chcard__n' }, `${c.stats.n} 条`)),
      el('div', { class: 'chcard__t' }, c.title),
      el('div', { class: 'chcard__b' }, c.blurb),
      bar,
      el('div', { class: 'chcard__cj' }, ...c.cj.map((k) => el('span', { class: 'chip chip--cj' }, CJ_LABEL[k] || k)))));
  });
  root.append(grid);
  reveal(root);
  return root;
}

/* ── chapter reader ─────────────────────────────────────────────────── */
/** Set by viewChapter, consumed by the router once the view is mounted. */
export const jump = { ref: null };

export function viewChapter(book, no, jumpTo) {
  jump.ref = jumpTo != null ? `${no}-${jumpTo}` : null;
  const c = book.chapters.find((x) => x.no === no);
  if (!c) return el('div', { class: 'wrap' }, el('p', {}, '没有这一节。'));
  const root = el('div', { class: 'wrap' });

  root.append(el('nav', { class: 'crumbs', 'aria-label': '面包屑' },
    el('a', { href: '#/' }, '概览'), el('i', {}, '/'),
    el('a', { href: '#/chapters' }, '章节'), el('i', {}, '/'),
    el('span', {}, `第 ${c.no} 节`)));

  root.append(el('div', { class: 'pagehead pagehead--split' },
    el('div', { class: 'pagehead__lead' },
      el('div', { class: 'pagehead__no num' }, String(c.no).padStart(2, '0')),
      el('h1', {}, c.title)),
    el('div', { class: 'pagehead__side' },
      el('p', {}, c.blurb),
      el('div', { class: 'pagehead__meta' },
        ...c.cj.map((k) => el('span', { class: 'chip chip--cj' }, CJ_LABEL[k] || k)),
        el('span', { class: 'chip' }, `${c.stats.n} 条`),
        c.stats.A ? el('span', { class: 'chip chip--a' }, `A ${c.stats.A}`) : null,
        c.stats.B ? el('span', { class: 'chip chip--b' }, `B ${c.stats.B}`) : null,
        c.stats.C ? el('span', { class: 'chip chip--c' }, `C ${c.stats.C}`) : null)),
    el('div', { class: 'pagehead__full' },
      c.intro ? el('p', { class: 'pagehead__intro' }, linkify(c.intro, book)) : null,
      el('div', { class: 'pagehead__tools' },
        el('a', { class: 'btn btn--ghost', href: `#/explore?ch=${c.no}` }, `在检索里只看这一节`),
        navPrevNext(book, c.no)))));

  const cards = el('div', { class: 'cards' });
  root.append(el('h2', { class: 'sr-only' }, `本节 ${c.stats.n} 条`));
  c.items.forEach((raw, i) => {
    const it = book.byId.get(raw.id) || raw;
    cards.append(itemCard(book, it, { d: i % 8 }));
  });
  root.append(cards);
  reveal(root);
  return root;
}

/** Scroll to and flash the item a deep link points at. Runs after mount. */
export function applyJump() {
  if (!jump.ref) return;
  const n = document.getElementById(`i-${jump.ref}`);
  jump.ref = null;
  if (!n) return;
  n.scrollIntoView({ block: 'center' });
  n.classList.add('flash');
  setTimeout(() => n.classList.remove('flash'), 1800);
}

function navPrevNext(book, no) {
  const prev = book.chapters.find((c) => c.no === no - 1);
  const next = book.chapters.find((c) => c.no === no + 1);
  return el('div', { class: 'pager' },
    prev ? el('a', { href: `#/ch/${prev.no}` }, '← ', prev.title) : el('span'),
    next ? el('a', { href: `#/ch/${next.no}` }, next.title, ' →') : el('span'));
}

/* ── long-form reader ───────────────────────────────────────────────── */
export function viewLong(book, id) {
  const a = book.appendices.find((x) => x.id === id) || book.appendices[0];
  const root = el('div', { class: 'wrap long' });

  root.append(el('nav', { class: 'crumbs', 'aria-label': '面包屑' },
    el('a', { href: '#/' }, '概览'), el('i', {}, '/'),
    el('a', { href: '#/long' }, '长文'), el('i', {}, '/'),
    el('span', {}, a.title.slice(0, 14) + '…')));

  const toc = el('nav', { class: 'toc', 'aria-label': '本文目录' },
    el('div', { class: 'toc__t u-label' }, '目录'),
    ...a.blocks.filter((b) => b.t === 'h3').map((b) =>
      el('a', { href: '#', onclick: (e) => { e.preventDefault(); jumpToBlock(b.x); } }, b.x)),
    el('div', { class: 'toc__sel' },
      el('span', { class: 'u-label' }, '换一篇'),
      el('select', {
        class: 'select', onchange: (e) => (location.hash = `#/long/${e.target.value}`),
      }, ...book.appendices.map((x) => el('option', { value: x.id, selected: x.id === a.id }, x.title)))));

  const body = el('article', { class: 'prose' });
  body.append(el('h1', {}, a.title));
  if (a.lead) body.append(el('p', { class: 'lead' }, a.lead));
  let tblN = 0;
  for (const b of a.blocks) {
    if (b.t === 'p') { body.append(el('p', {}, linkify(b.x, book))); continue; }
    if (b.t === 'h3') { body.append(el('h2', {}, b.x)); continue; }
    if (b.t === 'h4') { body.append(el('h3', {}, b.x)); continue; }
    if (b.t === 'li') { body.append(el('p', { class: 'li' }, linkify(b.x, book))); continue; }
    if (b.t === 'table') {
      tblN++;
      body.append(tableBlock(b.x, tblN));
    }
  }

  root.append(el('div', { class: 'long__grid' }, toc, body));
  reveal(root);
  return root;
}

function jumpToBlock(label) {
  const h = [...document.querySelectorAll('.prose h2')].find((n) => n.textContent === label);
  h?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function tableBlock(t, n) {
  const wrap = el('div', { class: 'tablewrap', tabindex: '0', role: 'region',
    'aria-label': `表 ${n}，可横向滚动` });
  const tb = el('table', { class: 'dtable' });
  if (t.header) {
    tb.append(el('thead', {}, el('tr', {}, ...t.header.map((h, i) =>
      el('th', { scope: 'col', class: i === 0 ? 'rowh' : '' }, h || '—')))));
  }
  tb.append(el('tbody', {}, ...t.rows.map((r) =>
    el('tr', {}, ...r.map((c, i) => el('td', { class: i === 0 ? 'rowh' : '' }, c))))));
  wrap.append(tb);
  return wrap;
}

/* ── methodology ────────────────────────────────────────────────────── */
export function viewMethod(book) {
  const root = el('div', { class: 'wrap method' });
  const M = book.method;

  root.append(el('nav', { class: 'crumbs', 'aria-label': '面包屑' },
    el('a', { href: '#/' }, '概览'), el('i', {}, '/'), el('span', {}, '方法论')));
  root.append(el('div', { class: 'pagehead' },
    el('span', { class: 'u-label' }, '怎么读'),
    el('h1', {}, '这些条目是怎么算账的'),
    el('p', {}, '每一条建议都回答两个问题：要花掉什么（钱 / 时间 / 精力 / 毅力），能换回什么（总死亡率变化 / 特定死因下降 / 时间与精力节省 / 金钱节省 / 保障与人身自由）。条目按性价比排，不按类别排。')));

  /* resources */
  root.append(el('section', {}, sectionHead('一', '四种资源'),
    el('div', { class: 'res res--4' }, ...M.resources.map((r) =>
      el('div', { class: 'res__cell' },
        el('div', { class: 'res__k' }, el('i', {}), r.k),
        el('div', { class: 'res__d' }, r.d))))));

  /* tiers */
  root.append(el('section', {}, sectionHead('二', '好处落在谁身上'),
    el('ol', { class: 'tiers' }, ...M.tiers.map((t) =>
      el('li', {}, el('b', {}, t.k), el('span', {}, t.d))))));

  /* evidence */
  root.append(el('section', {}, sectionHead('三', '证据等级'),
    el('div', { class: 'evgrid' }, ...M.evidence.map((e) =>
      el('div', { class: 'evcard' },
        el('div', { class: 'badge badge--big', data: { ev: e.k } }, e.k),
        el('p', {}, e.d)))),
    el('p', { class: 'note' }, M.evidenceStats)));

  /* value dims */
  root.append(el('section', {}, sectionHead('四', '性价比怎么合出来'),
    el('div', { class: 'tablewrap' }, el('table', { class: 'dtable' },
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, '维度'), el('th', { scope: 'col' }, '取值'), el('th', { scope: 'col' }, '怎么定的'))),
      el('tbody', {}, ...M.value.map((v) =>
        el('tr', {}, el('td', { class: 'rowh' }, v.dim), el('td', {}, v.values), el('td', {}, v.how)))))),
    el('p', { class: 'note' }, M.valueStats),
    el('p', { class: 'note note--warn' },
      '本站的「收益量级」和「性价比」两栏，是按上面这张表公布的界线，从每条的「收益」和「成本」自动套用出来的估算。'
      + '它们用来帮你排序，不是逐条标注的结论，也替代不了自己读一遍原文。')));

  /* how to read */
  root.append(el('section', {}, sectionHead('五', '怎么读'),
    el('ul', { class: 'bullets' }, ...book.howToRead.map((t) => el('li', {}, t)))));

  /* glossary */
  root.append(el('section', {}, sectionHead('六', '术语表', '正文里带虚线的词都可以点开看解释'),
    el('div', { class: 'glossary' }, ...book.glossary.map((g) =>
      el('div', { class: 'gl' },
        el('dt', {}, g.t), el('dd', {}, g.d))))));

  /* changelog */
  if (book.changelog?.length) {
    root.append(el('section', {}, sectionHead('七', '版本说明'),
      el('ul', { class: 'bullets' }, ...book.changelog.map((t) => el('li', {}, t)))));
  }
  reveal(root);
  return root;
}

/* ── about ──────────────────────────────────────────────────────────── */

/** 李哲的个人信息，取自 https://www.lizhe.work/ */
const AUTHOR = {
  name: '李哲',
  en: 'Li Zhe',
  role: 'AI × Marketing',
  tagline: '把 AI 用到真实的活儿里',
  bio: '做市场 11 年，做过品牌、产品、内容和活动。这几年在搭自己的 AI 工具，'
    + '也接客户的活儿，偶尔去讲课。工作内容写在下面。',
  now: '2024 年 6 月起在杉数科技做市场，参与决策式 AI 产品的落地。'
    + '日常工作是把 GEO、智能体和内容工作流接进市场团队，看看哪些真能省时间，哪些目前还不行。',
  focus: ['AI 营销咨询', 'GEO', '品牌增长', '课程与分享'],
  skills: ['品牌战略', '品牌定位', '产品 GTM', 'B2B 营销', '整合传播', '内容策略',
    '市场活动', 'AI 产品', 'AI 工作流', 'GEO', '智能体', '课程与演讲'],
  jobs: [
    ['2024.06 — 现在', '杉数科技', '决策式 AI', '市场与 AI 产品'],
    ['2021.04 — 2024.06', '嘉诚信息', '数字政府、AI 与网络安全', '品牌升级与官网重构'],
    ['2017.02 — 2021.03', '亚控科技', '工业自动化软件', '发布会、展会与渠道'],
  ],
  numbers: [['11', '年在市场一线'], ['40+', '年度活动峰值'], ['30%', '活动转化提升'], ['2', '持续更新的产品']],
  honors: ['GMTS 2025 杰出 B2B 营销人物', '人工智能训练师（高级）',
    '数英奖专家评委', '虎啸奖评审团评委', 'DMAA 国际数字营销奖终审评委'],
  links: [
    ['李哲的个人站', 'https://www.lizhe.work/', '完整履历和近况'],
    ['天行 GEO', 'https://aigeo.games/', '研究 AI 怎么理解和引用一个品牌'],
    ['Creator OS', 'https://creatoros.com.cn/', '选题到发布的内容工作流工具'],
  ],
};

export function viewAbout(book) {
  const root = el('div', { class: 'wrap about' });

  root.append(el('nav', { class: 'crumbs', 'aria-label': '面包屑' },
    el('a', { href: '#/' }, '概览'), el('i', {}, '/'), el('span', {}, '关于作者')));

  root.append(el('header', { class: 'about__hero' },
    el('div', { class: 'about__id' },
      el('span', { class: 'about__mark', 'aria-hidden': 'true' }, 'LZ'),
      el('h1', {}, AUTHOR.name, el('em', {}, AUTHOR.en))),
    el('p', { class: 'about__role2' }, '本站整理与维护者'),
    el('p', { class: 'about__role' }, AUTHOR.role),
    el('p', { class: 'about__tag' }, AUTHOR.tagline),
    el('p', { class: 'about__bio' }, AUTHOR.bio),
    el('ul', { class: 'about__focus' }, ...AUTHOR.focus.map((f) => el('li', {}, f)))));

  root.append(el('section', { class: 'about__stats' },
    ...AUTHOR.numbers.map(([v, k], i) =>
      el('div', { class: 'about__stat reveal', data: { d: i } },
        el('b', { class: 'num' }, v), el('span', {}, k)))));

  root.append(el('section', { class: 'about__sec' },
    sectionHead('一', '工作经历'),
    el('ol', { class: 'about__jobs' }, ...AUTHOR.jobs.map(([when, org, what, role], i) =>
      el('li', { class: 'reveal', data: { d: i } },
        el('span', { class: 'about__when num' }, when),
        el('div', { class: 'about__job' },
          el('b', {}, org, el('i', {}, what)),
          el('span', {}, role)))))));

  root.append(el('section', { class: 'about__sec' },
    sectionHead('二', '现在在做什么'),
    el('p', { class: 'about__now' }, AUTHOR.now),
    el('ul', { class: 'about__skills' }, ...AUTHOR.skills.map((s, i) =>
      el('li', { class: 'reveal', data: { d: i % 8 } }, s)))));

  root.append(el('section', { class: 'about__sec' },
    sectionHead('三', '行业里的记录'),
    el('ul', { class: 'about__honors' }, ...AUTHOR.honors.map((h, i) =>
      el('li', { class: 'reveal', data: { d: i } }, h)))));

  root.append(el('section', { class: 'about__sec' },
    sectionHead('四', '联系与友链'),
    el('div', { class: 'about__cards' }, ...AUTHOR.links.map(([t, href, d], i) =>
      el('a', { class: 'about__card reveal', data: { d: i }, href, target: '_blank', rel: 'noopener' },
        el('span', { class: 'about__cardt' }, t),
        el('span', { class: 'about__cardd' }, d),
        el('span', { class: 'about__cardgo', 'aria-hidden': 'true' }, '↗')))),
    el('p', { class: 'about__mail' },
      el('a', { href: 'mailto:jaylee1993@foxmail.com' }, 'jaylee1993@foxmail.com'))));

  /* who wrote the content, and where it lives. CC BY 4.0 requires the credit. */
  root.append(el('section', { class: 'about__sec' },
    sectionHead('五', '内容作者'),
    el('div', { class: 'credit' },
      el('div', { class: 'credit__row' },
        el('span', { class: 'credit__k' }, '作者'),
        el('span', { class: 'credit__v' }, 'eternity4719')),
      el('div', { class: 'credit__row' },
        el('span', { class: 'credit__k' }, '项目地址'),
        el('a', { class: 'credit__v credit__v--link', href: 'https://github.com/eternity4719/HowToLiveBetter', target: '_blank', rel: 'noopener' },
          'github.com/eternity4719/HowToLiveBetter')),
      el('div', { class: 'credit__row' },
        el('span', { class: 'credit__k' }, '在线阅读'),
        el('a', { class: 'credit__v credit__v--link', href: 'https://eternity4719.github.io/HowToLiveBetter/', target: '_blank', rel: 'noopener' },
          'eternity4719.github.io/HowToLiveBetter')),
      el('div', { class: 'credit__row' },
        el('span', { class: 'credit__k' }, '授权'),
        el('a', { class: 'credit__v credit__v--link', href: 'https://creativecommons.org/licenses/by/4.0/deed.zh', target: '_blank', rel: 'noopener nofollow' },
          'CC BY 4.0')),
      el('div', { class: 'credit__row' },
        el('span', { class: 'credit__k' }, '本站'),
        el('span', { class: 'credit__v' },
          `${book.items.length} 条建议、${book.chapters.length} 个章节、${book.appendices.length} 篇长文`,
          el('em', {}, '由李哲整理成可检索的站点。只做检索、筛选与排版，不改写结论。'))))));

  reveal(root);
  return root;
}