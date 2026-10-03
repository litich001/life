/* Home, chapter index, chapter reader, long-form reader, methodology. */
import { el, frag, linkify, reveal, countUp, fmt, openSheet, closeSheet, toast } from './ui.js';
import { itemCard, openRefSheet, isMarked, toggleMark, marks, COST_LABEL, CJ_LABEL, MAG_LABEL } from './views-explore.js';

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const cn = (n) => (n <= 10 ? CN[n] : n < 20 ? '十' + CN[n - 10] : CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : ''));

function sectionHead(label, title, extra) {
  return el('div', { class: 'sec-head reveal' },
    el('span', { class: 'u-label' }, label), el('h2', {}, title),
    extra ? el('span', { class: 'sec-head__x' }, extra) : null);
}

/** Right-hand index in the hero — the four ways into the book. */
function heroRail(book, m) {
  const rows = [
    ['#/explore', '检索 608 条', '关键词 · 章节 · 证据 · 成本', `${m.items} 条`],
    ['#/chapters', '按章节读', '每节按性价比从高到低排列', `${m.chapters} 节`],
    ['#/long', '五篇长文', '把一件事从头讲到底', `${book.appendices.length} 篇`],
    ['#/method', '这本书怎么算账', '四种资源 · 证据分级 · 术语表', '方法论'],
  ];
  return el('nav', { class: 'hero__rail reveal', data: { d: '3' }, 'aria-label': '入口' },
    el('div', { class: 'u-label' }, '从哪儿进'),
    ...rows.map(([href, t, d, n], i) => el('a', { class: 'railrow', href },
      el('span', { class: 'railrow__i' }, String(i + 1).padStart(2, '0')),
      el('span', { class: 'railrow__b' },
        el('span', { class: 'railrow__t' }, t),
        el('span', { class: 'railrow__d' }, d)),
      el('span', { class: 'railrow__n' }, n),
      el('span', { class: 'railrow__a', 'aria-hidden': 'true' }, '→'))));
}

/* ── home ───────────────────────────────────────────────────────────── */
export function viewHome(book, state, go) {
  const m = book.meta;
  const root = el('div', {});

  /* hero */
  const hero = el('section', { class: 'wrap hero' },
    el('div', { class: 'hero__meta' },
      el('span', {}, '版本 ', el('b', {}, m.bookGenerated.slice(0, 10))),
      el('span', {}, '正文 ', el('b', {}, String(m.sourcePages)), ' 页'),
      el('span', {}, el('b', {}, String(m.chapters)), ' 节'),
      el('span', {}, el('b', {}, String(m.items)), ' 条'),
      el('span', {}, 'A 级 ', el('b', {}, String(m.evidence.A)))),
    el('div', { class: 'hero__body' },
      el('div', { class: 'hero__main' },
        el('h1', { class: 'reveal' }, '高性价比', el('br'), '人生', el('em', {}, '指南')),
        el('p', { class: 'hero__lede reveal', data: { d: '1' } },
          '用最少的钱、时间和精力，换回寿命、金钱和自由。',
          el('br'),
          '每一条都写明：花掉什么、换回什么、证据有多硬。'),
        el('div', { class: 'hero__cta reveal', data: { d: '2' } },
          el('a', { class: 'btn btn--primary', href: '#/explore' }, '开始检索', el('kbd', {}, '/')),
          el('a', { class: 'btn btn--ghost', href: '#/method' }, '这本书怎么算账'),
          el('a', { class: 'btn btn--ghost', href: '#/ch/13' }, '紧急情况先做什么'))),
      heroRail(book, m)),
  );
  root.append(hero);

  /* four resources */
  const resWrap = el('section', { class: 'wrap' });
  resWrap.append(sectionHead('四 样 东 西', '这本书想帮你多留住四样'));
  const resGrid = el('div', { class: 'res res--4' });
  for (const r of book.method.resources) {
    const n = book.items.filter((i) => i.cj.includes(r.k === '时间与精力' ? '时间精力' : r.k)).length;
    resGrid.append(el('button', {
      class: 'res__cell reveal', type: 'button',
      onclick: () => { location.hash = `#/explore?cj=${encodeURIComponent(r.k === '时间与精力' ? '时间精力' : r.k)}`; },
    },
      el('div', { class: 'res__k' }, el('i', { 'aria-hidden': 'true' }), r.k),
      el('div', { class: 'res__d' }, r.d),
      el('div', { class: 'res__n' }, `${fmt(n)} 条按这个口径算`)));
  }
  resWrap.append(resGrid);
  root.append(resWrap);

  /* stats band */
  const band = el('section', { class: 'wrap' });
  band.append(sectionHead('数 字', '全书 608 条的分布'));
  const stats = el('div', { class: 'stats' });
  const cells = [
    [m.items, '条建议'], [m.chapters, '节'],
    [m.evidence.A, '条 A 级证据'], [m.evidence.B, '条 B 级'],
    [m.evidence.C, '条 C 级'], [m.dispute, '条标了争议'], [m.todo, '处待核实'],
  ];
  for (const [v, k] of cells) {
    const num = el('div', { class: 'stats__v num' }, '0');
    stats.append(el('div', { class: 'stats__c reveal' }, num, el('div', { class: 'stats__k' }, k)));
    countUp(num, v);
  }
  band.append(stats);
  root.append(band);

  /* pick-by-question */
  const qSec = el('section', { class: 'wrap' });
  qSec.append(sectionHead('从 问 题 入 口', '你遇到的是哪一件？'));
  const ql = el('div', { class: 'qlist' });
  book.questions.forEach((q, i) => {
    ql.append(el('a', { class: 'reveal', data: { d: i % 6 }, href: `#/ch/${q.ch}` },
      el('span', { class: 'qlist__q' }, q.q),
      el('span', { class: 'qlist__go' }, `${String(q.ch).padStart(2, '0')}`, el('i', {}, '→'))));
  });
  qSec.append(ql);
  root.append(qSec);

  /* best value first */
  const best = book.items.filter((i) => i.value === '极高').slice(0, 12);
  const bSec = el('section', { class: 'wrap' });
  bSec.append(sectionHead('先 看 这 些', '不花钱、不占时间、不需要毅力，收益落在最大一档',
    el('a', { class: 'sec-head__x', href: '#/explore?val=' + encodeURIComponent('极高') }, `全部 ${book.items.filter((i) => i.value === '极高').length} 条 →`)));
  const cards = el('div', { class: 'cards cards--2' });
  best.forEach((it, i) => cards.append(itemCard(book, it, { d: i % 4 })));
  bSec.append(cards);
  bSec.append(el('p', { class: 'caveat' },
    '性价比这一档是本站按书里公布的界线（收益 ≥20% 为大、三项成本全零为极高）从「收益」和「成本」两栏自动套用的估算，用来排序，不是原书逐条标注的结论。'));
  root.append(bSec);

  /* long-form */
  const lSec = el('section', { class: 'wrap' });
  lSec.append(sectionHead('长 文', '五篇把一件事讲到底'));
  const lg = el('div', { class: 'chgrid chgrid--long' });
  book.appendices.forEach((a, i) => {
    const tbl = a.blocks.filter((b) => b.t === 'table').length;
    lg.append(el('a', {
      class: 'chcard reveal', data: { d: i }, href: `#/long/${a.id}`,
    },
      el('div', { class: 'chcard__top' },
        el('span', { class: 'chcard__no u-mono' }, String(i + 1).padStart(2, '0')),
        el('span', { class: 'chcard__n' }, tbl ? `${tbl} 张表` : '')),
      el('div', { class: 'chcard__t' }, a.title),
      el('div', { class: 'chcard__b' }, a.lead.slice(0, 92) + (a.lead.length > 92 ? '…' : ''))));
  });
  lSec.append(lg);
  root.append(lSec);

  reveal(root);
  return root;
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
export function viewChapter(book, no, jumpTo) {
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

  if (jumpTo != null) {
    requestAnimationFrame(() => {
      const n = document.getElementById(`i-${c.no}-${jumpTo}`);
      if (n) {
        n.scrollIntoView({ block: 'center' });
        n.classList.add('flash');
        setTimeout(() => n.classList.remove('flash'), 1600);
      }
    });
  }
  return root;
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