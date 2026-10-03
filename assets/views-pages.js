/* Home, chapter index, chapter reader, long-form reader, methodology. */
import { el, frag, linkify, reveal, fmt, openSheet, closeSheet, toast } from './ui.js';
import { itemCard, openRefSheet, isMarked, toggleMark, marks, badge, CJ_LABEL } from './views-explore.js';

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const cn = (n) => (n <= 10 ? CN[n] : n < 20 ? '十' + CN[n - 10] : CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : ''));

function sectionHead(label, title, extra) {
  return el('div', { class: 'sec-head reveal' },
    el('span', { class: 'u-label' }, label), el('h2', {}, title),
    extra ? el('span', { class: 'sec-head__x' }, extra) : null);
}

/* ── home ───────────────────────────────────────────────────────────── */
export function viewHome(book, state) {
  const m = book.meta;
  const root = el('div', { class: 'home' });

  /* ── poster hero ──────────────────────────────────────────────────── */
  const hero = el('section', { class: 'poster' },
    el('div', { class: 'poster__grid' }),
    el('div', { class: 'wrap poster__in' },
      el('div', { class: 'poster__eyebrow' },
        el('span', {}, '高性价比人生指南'),
        el('i'),
        el('span', {}, `${m.items} 条建议`),
        el('i'),
        el('span', {}, `${m.chapters} 节`),
        el('i'),
        el('span', {}, `正文 ${m.sourcePages} 页`)),
      el('div', { class: 'poster__body' },
        el('h1', { class: 'poster__title' },
          '用最少的钱、', el('br'), '时间和精力，', el('br'),
          el('em', {}, '换回寿命'), '、金钱', el('br'), '和自由'),
        el('div', { class: 'poster__side' },
          el('div', { class: 'poster__stat' },
            el('b', { class: 'num' }, String(m.items)),
            el('span', {}, '条建议'),
            el('em', {}, `每条都写明：花掉什么、换回什么、证据有多硬`)),
          el('div', { class: 'poster__bar' },
            statBar('证据 A', m.evidence.A, m.items),
            statBar('B', m.evidence.B, m.items),
            statBar('C', m.evidence.C, m.items)),
          el('p', { class: 'poster__note' },
            '来源只引期刊论文和官方文件。', el('br'),
            el('a', { href: '#/method' }, '这本书怎么算账 →')))),
      el('div', { class: 'poster__cta' },
        el('a', { class: 'cta cta--fire', href: '#/explore?ch=13' },
          el('b', {}, '现在很急'),
          el('span', {}, '有人倒地、受伤、突发不舒服 · 先做什么')),
        el('a', { class: 'cta', href: '#/explore' },
          el('b', {}, '全部 608 条'),
          el('span', {}, '按关键词和条件筛', el('kbd', {}, '/'))),
        el('a', { class: 'cta', href: '#/chapters' },
          el('b', {}, '按 33 节读'),
          el('span', {}, '每节按性价比从高到低')))));
  root.append(hero);

  /* ── situations: the real front door ──────────────────────────────── */
  const sitWrap = el('section', { class: 'wrap' });
  sitWrap.append(el('div', { class: 'band' },
    el('span', { class: 'u-label' }, '前 门'),
    el('h2', {}, '你现在是什么情况？'),
    el('p', { class: 'band__d' }, '不用通读全书。挑一个最像的，进去就是能直接做的事。')));
  const sit = el('div', { class: 'situations' });
  for (const s of book.situations) {
    sit.append(el('a', { class: 'sit', href: s.href },
      el('span', { class: 'sit__no num' }, s.no),
      el('span', { class: 'sit__t' }, s.title),
      el('span', { class: 'sit__h' }, s.hint),
      el('span', { class: 'sit__go', 'aria-hidden': 'true' }, '→')));
  }
  sitWrap.append(sit);
  root.append(sitWrap);

  /* ── the seven to start with (a poster list, not cards) ───────────── */
  const seven = book.items.filter((i) => i.value === '极高').slice(0, 7);
  const sevenWrap = el('section', { class: 'wrap' });
  sevenWrap.append(el('div', { class: 'band' },
    el('span', { class: 'u-label' }, '起 手'),
    el('h2', {}, '从这七条开始'),
    el('p', { class: 'band__d' },
      '不花钱、不占时间、不需要毅力，收益又落在最大一档。挑走一条就算数。'),
    el('a', { class: 'band__more', href: '#/explore?val=' + encodeURIComponent('极高') },
      `全部 ${book.items.filter((i) => i.value === '极高').length} 条 →`)));
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
  sevenWrap.append(el('p', { class: 'caveat' },
    '「收益」和「性价比」由本站按书里公布的界线从原文自动套用，用来排序，属估算。',
    el('a', { href: '#/method' }, ' 方法论 →')));
  root.append(sevenWrap);

  /* ── four resources ────────────────────────────────────────────────── */
  const resWrap = el('section', { class: 'wrap' });
  resWrap.append(el('div', { class: 'band' },
    el('span', { class: 'u-label' }, '四 样 东 西'),
    el('h2', {}, '这本书想帮你多留住四样')));
  const resGrid = el('div', { class: 'res res--4' });
  for (const r of book.method.resources) {
    const key = r.k === '时间与精力' ? '时间精力' : r.k;
    const n = book.items.filter((i) => i.cj.includes(key)).length;
    resGrid.append(el('a', {
      class: 'res__cell reveal', href: '#/explore?cj=' + encodeURIComponent(key),
    },
      el('div', { class: 'res__k' }, el('i', { 'aria-hidden': 'true' }), r.k),
      el('div', { class: 'res__d' }, r.d),
      el('div', { class: 'res__n' }, `${fmt(n)} 条按这个口径算 →`)));
  }
  resWrap.append(resGrid);
  root.append(resWrap);

  /* ── chapter index, dense ─────────────────────────────────────────── */
  const chWrap = el('section', { class: 'wrap' });
  chWrap.append(el('div', { class: 'band' },
    el('span', { class: 'u-label' }, '33 节'),
    el('h2', {}, '全部章节'),
    el('p', { class: 'band__d' }, '节标题说的是这一节想防住的结果，做还是别做以条目标题为准。')));
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
    el('span', { class: 'u-label' }, '长 文'),
    el('h2', {}, '五篇把一件事讲到底')));
  const lg = el('div', { class: 'longgrid' });
  book.appendices.forEach((a, i) => {
    lg.append(el('a', { class: 'lg reveal', data: { d: i }, href: `#/long/${a.id}` },
      el('span', { class: 'lg__no num' }, String(i + 1).padStart(2, '0')),
      el('span', { class: 'lg__t' }, a.title),
      el('span', { class: 'lg__go', 'aria-hidden': 'true' }, '→')));
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
    el('p', {}, '每节内的条目按性价比从高到低排列，从每节前几条开始看就行。节标题说的是这一节想防住的结果，条目本身要做还是别做，以条目标题为准。')));

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
    el('span', { class: 'u-label' }, '怎么读这本书'),
    el('h1', {}, '这本书是怎么算账的'),
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
      '本站的「收益量级」和「性价比」两栏，是按上面这张表公布的界线，从每条的「收益」和「成本」原文自动套用出来的估算。'
      + '它们用来帮你排序，不是原书逐条标注的结论，也替代不了自己读一遍原文。')));

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