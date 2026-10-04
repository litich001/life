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

/* Longer prompts that cycle through the hero field when it is empty. A single
   static placeholder only ever advertises one thing; cycling shows the range.
   The animation is on a wrapper so it only stops when the field has content. */
const PROMPTS = [
  '押金被扣了怎么办',
  '刚被裁，先做什么',
  '睡不着，白天没精神',
  '房子租的时候要留意什么',
  '去医院前该准备什么',
  '父母老了要提前安排什么',
  '账号被盗了先做哪一步',
  '孩子上学要注意什么',
];

/* ── home ───────────────────────────────────────────────────────────── */
export function viewHome(book, state) {
  const m = book.meta;
  const root = el('div', { class: 'home' });

  /* ── hero: the search box is the headline ────────────────────────── */
  const input = el('input', {
    class: 'find__input', type: 'search', autocomplete: 'off', spellcheck: 'false',
    placeholder: '搜一件事',
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

  /* Rotating placeholder. Real placeholder text cannot be animated, so the field
     goes transparent and a sibling element does the typing instead -- which also
     means the moment you click it looks like focus, not like nothing happening. */
  const ghost = el('span', { class: 'find__ghost', 'aria-hidden': 'true' });
  const stop = () => {
    clearInterval(typer);
    typer = null;
    ghost.classList.remove('is-on');
  };
  let typer = null;
  let pi = 0;
  const typeNext = () => {
    const text = PROMPTS[pi % PROMPTS.length];
    pi += 1;
    ghost.textContent = '';
    ghost.classList.add('is-on');
    let n = 0;
    typer = setInterval(() => {
      n += 1;
      ghost.textContent = text.slice(0, n);
      if (n >= text.length) {
        clearInterval(typer);
        typer = setInterval(() => {
          if (!ghost.textContent.length) { clearInterval(typer); typer = null; typeNext(); return; }
          ghost.textContent = ghost.textContent.slice(0, -1);
        }, 34);
      }
    }, 72);
  };
  input.addEventListener('focus', () => { if (!input.value) { stop(); typeNext(); } });
  input.addEventListener('blur', stop);
  /* Start on a timer as well as on intersection. IntersectionObserver does not
     fire in an unfocused or background tab, which left the field looking broken
     rather than idle; the observer is now only used to pause when the field has
     genuinely scrolled away. */
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) stop();
    else if (!input.value && !typer) typeNext();
  }, { threshold: 0.4 });
  io.observe(input);
  setTimeout(() => { if (!input.value && !typer) typeNext(); }, 700);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) stop();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (input.value.trim()) go(input.value.trim()); }
  });

  input.addEventListener('input', stop);

  /* The keyword chips are the fallback for when the rotating placeholder is off
   (prefers-reduced-motion hides the ghost). With it on, they are redundant --
   they cost a whole row of hero height, which is the difference between a hero
   that fits on screen and one that does not. */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const examples = reduceMotion
  ? el('div', { class: 'find__eg' },
    el('span', { class: 'find__egl' }, '试试'),
    ...EXAMPLES.map((w) => el('a', { class: 'find__chip', href: `#/explore?q=${encodeURIComponent(w)}` }, w)))
  : null;

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
          // the ghost has to share the input's origin, not the field's padding box,
          // or it renders on top of the icon
          el('div', { class: 'find__field' }, input, ghost),
          el('button', { class: 'find__go', type: 'submit' }, '搜索'),
          el('kbd', { class: 'find__kbd', 'aria-hidden': 'true' }, '/')),

        counter,
        examples,
        quick),

      el('aside', { class: 'poster__side' },
        el('div', { class: 'ledger__t' }, '证据分级'),
        // explicit class, not :first-of-type -- that means "first div sibling",
        // and .ledger__t is the first div, so the A row never matched
        el('div', { class: 'ledger__b ledger__b--a' }, statBar('A', m.evidence.A, m.items)),
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
/* The chapter index used to be 33 cards and nothing else -- no way to search,
   filter or sort it, so finding "the chapter about my deposit" meant scrolling
   and reading every blurb. These controls make it a tool. */
export function viewChapters(book) {
  const root = el('div', { class: 'wrap chindex' });

  const SORTS = [
    ['no', '按编号'],
    ['n', '按条目数'],
    ['a', '按 A 级占比'],
    ['mark', '按我标记的'],
  ];
  let sort = 'no';
  let q = '';
  const cjSel = new Set();
  const markedOnly = { on: false };

  const search = el('input', {
    class: 'search__input', type: 'search', autocomplete: 'off', spellcheck: 'false',
    placeholder: '搜章节标题或内容，比如「押金」「夜班」', 'aria-label': '搜索章节',
  });
  const count = el('p', { class: 'chindex__count', 'aria-live': 'polite' });
  const grid = el('div', { class: 'chgrid' });

  /* every distinct 口径 present on a chapter, so the filter only offers real ones */
  const allCj = [...new Set(book.chapters.flatMap((c) => c.cj))];
  const cjBar = el('div', { class: 'chfilter' },
    el('span', { class: 'chfilter__l' }, '口径'),
    ...allCj.map((k) => el('button', {
      class: 'chfilter__c', type: 'button', 'aria-pressed': 'false',
      onclick: (e) => {
        const b = e.currentTarget;
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        if (on) cjSel.add(k); else cjSel.delete(k);
        draw();
      },
    }, CJ_LABEL[k] || k)));

  const sortSel = el('select', {
    class: 'select', 'aria-label': '章节排序方式',
    onchange: (e) => { sort = e.target.value; draw(); },
  }, ...SORTS.map(([v, t]) => el('option', { value: v }, t)));

  const markBtn = el('button', {
    class: 'ghostbtn', type: 'button', 'aria-pressed': 'false',
    onclick: (e) => {
      markedOnly.on = !markedOnly.on;
      e.currentTarget.setAttribute('aria-pressed', String(markedOnly.on));
      e.currentTarget.classList.toggle('on', markedOnly.on);
      draw();
    },
  }, '只看有标记的');

  function current() {
    const term = q.trim().toLowerCase();
    let list = book.chapters.filter((c) => {
      if (term && !`${c.title}${c.blurb}`.toLowerCase().includes(term)) return false;
      if (cjSel.size && ![...cjSel].every((k) => c.cj.includes(k))) return false;
      if (markedOnly.on && !c.items.some((it) => isMarked(it.ref))) return false;
      return true;
    });
    if (sort === 'n') list = [...list].sort((a, b) => b.stats.n - a.stats.n);
    else if (sort === 'a') list = [...list].sort((a, b) =>
      (b.stats.A / (b.stats.n || 1)) - (a.stats.A / (a.stats.n || 1)));
    else if (sort === 'mark') list = [...list].sort((a, b) =>
      b.items.filter((i) => isMarked(i.ref)).length - a.items.filter((i) => isMarked(i.ref)).length);
    else list = [...list].sort((a, b) => a.no - b.no);
    return list;
  }

  function card(c, i) {
    const bar = el('div', { class: 'chcard__bar' });
    for (const e of ['A', 'B', 'C']) {
      if (c.stats[e]) bar.append(el('i', { data: { e }, style: `flex:${c.stats[e]}` }));
    }
    const marks = c.items.filter((it) => isMarked(it.ref)).length;
    return el('a', {
      class: 'chcard reveal', data: { d: i % 8 }, href: `#/ch/${c.no}`,
    },
      el('div', { class: 'chcard__top' },
        el('span', { class: 'chcard__no' }, String(c.no).padStart(2, '0')),
        marks ? el('span', { class: 'chcard__marked num', title: `${marks} 条已标记` }, `◆ ${marks}`) : null,
        el('span', { class: 'chcard__n' }, `${c.stats.n} 条`)),
      el('div', { class: 'chcard__t' }, c.title),
      el('div', { class: 'chcard__b' }, c.blurb),
      bar,
      el('div', { class: 'chcard__cj' }, ...c.cj.map((k) => el('span', { class: 'chip chip--cj' }, CJ_LABEL[k] || k))));
  }

  function draw() {
    const list = current();
    count.textContent = list.length === book.chapters.length
      ? `${book.chapters.length} 节`
      : `${list.length} / ${book.chapters.length} 节`;
    grid.replaceChildren(...(list.length ? list.map(card) : [
      el('p', { class: 'empty__t' }, '没有符合条件的章节。')]));
  }

  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { q = search.value; draw(); }, 110);
  });

  root.append(el('div', { class: 'pagehead' },
    el('span', { class: 'u-label' }, `${book.chapters.length} 节 · ${fmt(book.items.length)} 条`),
    el('h1', {}, '章节'),
    el('p', {}, '每节内的条目按性价比从高到低排列。节标题说的是这一节要防的结果，具体做不做以条目标题为准。')));

  root.append(el('div', { class: 'chindex__bar' },
    el('div', { class: 'search' }, search),
    count,
    sortSel,
    markBtn));
  root.append(cjBar);
  root.append(grid);
  draw();
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

  /* A chapter is 18-21 screens tall. Without a way in and a sense of position you
   are just scrolling. Add an in-section index and a mark counter. */
  const list = el('details', { class: 'chjump' },
    el('summary', { class: 'chjump__sum' },
      el('span', {}, '本节目录'),
      el('span', { class: 'chjump__n num' }, `${c.items.length} 条`)),
    el('ol', { class: 'chjump__l' }, ...c.items.map((raw) => {
      const href = `#/ch/${c.no}/${raw.no}`;
      return el('li', {},
        el('a', { href },
          el('span', { class: 'chjump__no num' }, String(raw.no).padStart(2, '0')),
          el('span', { class: 'chjump__t' }, raw.title)));
    })));
  root.append(list);

  const cards = el('div', { class: 'cards' });
  root.append(el('h2', { class: 'sr-only' }, `本节 ${c.stats.n} 条`));
  c.items.forEach((raw, i) => {
    const it = book.byId.get(raw.id) || raw;
    cards.append(itemCard(book, it, { d: i % 8 }));
  });
  root.append(cards);

  /* Marked-count bar, kept in sync by the marks:change event in app.js. */
  const markedBar = el('div', { class: 'chmarked', hidden: true },
    el('span', { class: 'chmarked__t' }, '本节已标记'),
    el('b', { class: 'num' }, '0'),
    el('span', {}, '条'),
    el('a', { class: 'chmarked__go', href: `#/explore?ch=${c.no}&marks=1` }, '只看这些'));
  const syncMarked = () => {
    const n = c.items.filter((raw) => isMarked((book.byId.get(raw.id) || raw).ref)).length;
    markedBar.querySelector('b').textContent = String(n);
    markedBar.hidden = n === 0;
  };
  document.addEventListener('marks:change', syncMarked);
  root.append(markedBar);
  syncMarked();

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
export function viewLongIndex(book) {
  const root = el('div', { class: 'wrap longidx' });

  root.append(el('nav', { class: 'crumbs', 'aria-label': '面包屑' },
    el('a', { href: '#/' }, '概览'), el('i', {}, '/'),
    el('span', {}, '长文')));

  root.append(el('div', { class: 'pagehead' },
    el('span', { class: 'u-label' }, `${book.appendices.length} 篇`),
    el('h1', {}, '长文'),
    el('p', {}, '每个话题单独写一篇，比条目本身长。默认收起标题和第一段，点开看全文。')));

  for (const a of book.appendices) {
    const h3 = a.blocks.filter((b) => b.t === 'h3').length;
    const tables = a.blocks.filter((b) => b.t === 'table').length;
    const paras = a.blocks.filter((b) => b.t === 'p' || b.t === 'li');
    const chars = paras.reduce((n, p) => n + (p.x || '').length, 0);

    /* The first paragraph is the summary; the rest stays folded until asked. */
    const first = paras[0] ? paras[0].x : '';
    const body = el('div', { class: 'piece__body', hidden: true },
      ...paras.slice(1).map((p) => el('p', {}, linkify(p.x, book))));

    const toggle = el('button', {
      class: 'piece__more', type: 'button', 'aria-expanded': 'false',
      onclick: (e) => {
        const b = e.currentTarget;
        const open = b.getAttribute('aria-expanded') === 'true';
        b.setAttribute('aria-expanded', String(!open));
        body.hidden = open;
        b.textContent = open ? '展开全文' : '收起';
      },
    }, '展开全文');

    root.append(el('article', { class: 'piece' },
      el('div', { class: 'piece__top' },
        el('h2', {}, el('a', { href: `#/long/${a.id}` }, a.title)),
        el('span', { class: 'piece__meta num' },
          `${paras.length} 段 · ${h3} 节${tables ? ` · ${tables} 张表` : ''}`)),
      el('p', { class: 'piece__lead' }, linkify(a.lead || first.slice(0, 110), book)),
      el('p', { class: 'piece__first' }, linkify(first, book)),
      body,
      el('div', { class: 'piece__act' },
        toggle,
        el('a', { class: 'piece__read', href: `#/long/${a.id}` }, '单独阅读'))));
  }

  reveal(root);
  return root;
}

export function viewLong(book, id) {
  const a = book.appendices.find((x) => x.id === id);
  /* No id used to silently fall back to article #1 and dump 14 screens of text
     on #/long. That is an index route; give it an index. */
  if (!a) return viewLongIndex(book);

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
/** Everything here is taken from https://www.lizhe.work/ — nothing invented. */
const AUTHOR = {
  name: '李哲',
  en: 'Li Zhe',
  role: 'GEO 专家 · AI 营销实践者 · 品牌增长顾问',
  tagline: '把 AI 的聪明，变成品牌的影响力。',
  lede: '让好产品被理解、被记住，也更值得被选择。',
  bio: '在市场一线待了 11 年。做过品牌、产品、内容和活动，现在一头扎进 AI：'
    + '亲手搭工具、做产品、跑客户，也把新发现带到课堂和现场。',
  focus: ['AI 营销咨询', 'GEO', '品牌增长', '课程与分享'],
  numbers: [
    ['11', '年在市场一线'], ['40+', '年度活动峰值'],
    ['30%', '活动转化提升'], ['2', '持续更新的产品'],
  ],

  products: [
    {
      no: '01', name: '天行 GEO', tag: 'AI SEARCH',
      href: 'https://aigeo.games/',
      lead: '帮品牌进入 AI 的答案。',
      desc: '围绕真实提问整理品牌实体、专业内容、案例证据与引用来源，'
        + '并持续观察不同 AI 平台如何理解、提及和推荐品牌。',
      points: ['问题与意图研究', '品牌知识库', '内容与证据工程', 'AI 可见性观察'],
      stats: [['175', '专题研究'], ['114', '知识文章'], ['14', '内容入口']],
    },
    {
      no: '02', name: 'Creator OS', tag: 'CONTENT WORKFLOW',
      href: 'https://creatoros.com.cn/',
      lead: '把内容运营接成一条工作流。',
      desc: '从信源、选题、写作、配图、排版、评审到推送，七个环节可以独立使用，'
        + '也可以连续执行，适合个人创作者与内容团队。',
      points: ['30+ 信源聚合', 'AI 写作与风格库', '配图和公众号排版', '评审、发布与多账号'],
      stats: [['30+', '日常信源'], ['10万+', '文章资料'], ['7', '工作步骤']],
    },
  ],

  jobs: [
    {
      when: '2024.06 — 现在', org: '杉数科技', what: '决策式 AI',
      note: '研究 AI 怎么真正进入市场工作。把 GEO、智能体和工作流放进真实业务里，'
        + '看它们能解决什么，也看清它们暂时做不到什么。',
      points: ['参与搭建市场团队和日常协作体系', '推动 GEO 产品从需求验证走向客户交付', '把 AI 用进内容、媒体和品牌工作流'],
    },
    {
      when: '2021.04 — 2024.06', org: '嘉诚信息', what: '数字政府、AI 与网络安全',
      note: '面对政府和企业客户，可信、准确、好理解比热闹的创意更重要。',
      points: ['完成品牌视觉与官网的系统升级', '连续出版 6 期行业刊物，年度深度内容 30+ 篇', '用市场数据帮助团队更早发现项目与行业变化'],
    },
    {
      when: '2017.02 — 2021.03', org: '亚控科技', what: '工业自动化软件',
      note: '工业软件不太会自己讲故事，得先理解产品，再理解客户，'
        + '最后用一句不绕的话把两边接起来。',
      points: ['每年参与 40+ 场发布会、沙龙和研讨会', '每年统筹 10+ 场大型展会，活动转化提升 20%—30%', '连续三年优秀员工'],
    },
  ],

  skills: ['品牌战略', '品牌定位', '产品 GTM', 'B2B 营销', '整合传播', '媒体公关',
    '内容策略', '市场活动', '生态合作', 'AI 产品', 'AI 工作流', 'GEO', '智能体', '课程与演讲'],

  pillars: [
    ['BRAND', '建立清晰、稳定的品牌认知',
      '从定位、叙事到官网、PR 和高管表达，让品牌长期说同一件重要的事。'],
    ['GROWTH', '让市场工作靠近业务结果',
      '市场洞察、产品 GTM、销售材料、活动和线索机制彼此相连，品牌声量才有机会走向客户选择。'],
    ['COMMUNICATION', '在碎片时代持续获得注意与信任',
      '媒体、公关、内容、活动和行业关系共同建立可信度。表达要有记忆点，事实、案例与来源要站得住。'],
    ['AI ERA', '把知识、流程和判断变成组织资产',
      '智能体、GEO 与内容系统都围绕清楚的知识底稿、可复用工作流和人的最终判断展开。'],
  ],

  network: [
    ['权威媒体', '人民网、新华网、央视、光明日报、经济日报、中国日报、环球时报、澎湃新闻'],
    ['科技与商业媒体', '36氪、虎嗅、雷锋网、极客公园、钛媒体、IT之家、DoNews、界面新闻'],
    ['AI 同行', '机器之心、量子位、AI 科技评论、新智元、InfoQ、DataFun、PaperWeekly'],
    ['研究与咨询', 'Gartner、IDC、Frost & Sullivan、爱分析、亿欧智库、艾瑞咨询、甲子光年、Forrester'],
    ['产业机构', '中国信通院、电子标准院、赛迪研究院、国家工业信息安全发展研究中心、工信部、中国软件行业协会'],
    ['技术生态', '华为、百度、深信服、龙芯、鲲鹏、飞腾、兆芯、麒麟软件、统信软件、海光信息'],
  ],

  standing: [
    ['分享现场', '数十场行业分享与主题演讲，专业会议与沙龙的主要嘉宾及讲师'],
    ['课程覆盖', '数千人课程与活动累计学员覆盖'],
  ],

  honors: [
    ['JURY · 行业评审', ['数英奖专家评委', '虎啸奖评审团评委', 'DMAA 国际数字营销奖终审评委']],
    ['EXPERT · 专业身份', ['AI+营销应用创新论坛专家', '指北 AI 社区导师', '趣营销 AI 实战专家']],
    ['CERTIFIED · AI 能力', ['人工智能训练师（高级）', 'Prompt / 智能体 / 微调工程师认证', 'Microsoft 生成式 AI 职业技能']],
    ['HONOR · 年度荣誉', ['GMTS 2025 杰出 B2B 营销人物']],
  ],

  contact: [
    ['邮箱', 'jaylee1993@foxmail.com', 'mailto:jaylee1993@foxmail.com'],
    ['电话', '185 1351 6890', 'tel:+8618513516890'],
    ['方向', 'AI 营销咨询、GEO、品牌增长、课程与分享', null],
  ],

  links: [
    ['李哲的个人站', 'https://www.lizhe.work/', '完整履历、作品与近况'],
    ['天行 GEO', 'https://aigeo.games/', '帮品牌进入 AI 的答案'],
    ['Creator OS', 'https://creatoros.com.cn/', '把内容运营接成一条工作流'],
    ['Alice 李哲站', 'https://alice-lizhesite.vercel.app/', '另一个我'],
    ['AI 品牌传播专家', 'https://dmpr.cn/', '同行站点'],
  ],

  icp: '京ICP备2026050119号-2',
};

export function viewAbout(book) {
  const root = el('div', { class: 'wrap about' });

  root.append(el('nav', { class: 'crumbs', 'aria-label': '面包屑' },
    el('a', { href: '#/' }, '概览'), el('i', {}, '/'), el('span', {}, '关于作者')));

  root.append(el('header', { class: 'about__hero' },
    el('div', { class: 'about__id' },
      el('span', { class: 'about__mark', 'aria-hidden': 'true' }, 'LZ'),
      el('h1', {}, AUTHOR.name, el('em', {}, AUTHOR.en))),
    el('p', { class: 'about__role' }, AUTHOR.role),
    el('p', { class: 'about__tag' }, AUTHOR.tagline),
    el('p', { class: 'about__lede' }, AUTHOR.lede),
    el('p', { class: 'about__bio' }, AUTHOR.bio),
    el('ul', { class: 'about__focus' }, ...AUTHOR.focus.map((f) => el('li', {}, f)))));

  root.append(el('section', { class: 'about__stats' },
    ...AUTHOR.numbers.map(([v, k], i) =>
      el('div', { class: 'about__stat reveal', data: { d: i } },
        el('b', { class: 'num' }, v), el('span', {}, k)))));

  /* products */
  root.append(el('section', { class: 'about__sec' },
    sectionHead('一', '在做的两个产品'),
    el('div', { class: 'prod' }, ...AUTHOR.products.map((p, i) =>
      el('a', { class: 'prod__c reveal', data: { d: i }, href: p.href, target: '_blank', rel: 'noopener' },
        el('div', { class: 'prod__top' },
          el('span', { class: 'prod__no num' }, p.no),
          el('span', { class: 'prod__tag' }, p.tag)),
        el('h3', { class: 'prod__name' }, p.name),
        el('p', { class: 'prod__lead' }, p.lead),
        el('p', { class: 'prod__d' }, p.desc),
        el('ul', { class: 'prod__points' }, ...p.points.map((x) => el('li', {}, x))),
        el('div', { class: 'prod__stats' },
          ...p.stats.map(([v, k]) => el('div', {}, el('b', { class: 'num' }, v), el('span', {}, k)))))))));

  /* work history */
  root.append(el('section', { class: 'about__sec' },
    sectionHead('二', '工作经历'),
    el('ol', { class: 'about__jobs about__jobs--full' }, ...AUTHOR.jobs.map((j, i) =>
      el('li', { class: 'reveal', data: { d: i } },
        el('span', { class: 'about__when num' }, j.when),
        el('div', { class: 'about__job' },
          el('b', {}, j.org, el('i', {}, j.what)),
          el('p', { class: 'about__jobnote' }, j.note),
          el('ul', { class: 'about__points' }, ...j.points.map((x) => el('li', {}, x)))))))));

  /* capabilities */
  root.append(el('section', { class: 'about__sec' },
    sectionHead('三', '怎么做事'),
    el('div', { class: 'pillars' }, ...AUTHOR.pillars.map(([k, t, d], i) =>
      el('div', { class: 'pillar reveal', data: { d: i } },
        el('span', { class: 'pillar__k' }, k),
        el('h3', {}, t),
        el('p', {}, d)))),
    el('ul', { class: 'about__skills' }, ...AUTHOR.skills.map((s, i) =>
      el('li', { class: 'reveal', data: { d: i % 8 } }, s)))));

  /* network */
  root.append(el('section', { class: 'about__sec' },
    sectionHead('四', '合作过的圈子'),
    el('p', { class: 'about__now' },
      '名单本身没那么重要的是——重要的是遇到问题时，知道该找谁。'),
    el('dl', { class: 'net' }, ...AUTHOR.network.flatMap(([k, v], i) => [
      el('dt', { class: 'reveal', data: { d: i } }, k),
      el('dd', { class: 'reveal', data: { d: i } }, v),
    ]))));

  /* standing + honours */
  root.append(el('section', { class: 'about__sec' },
    sectionHead('五', '行业里的记录'),
    el('div', { class: 'standing' }, ...AUTHOR.standing.map(([k, v], i) =>
      el('div', { class: 'reveal', data: { d: i } },
        el('b', {}, k), el('span', {}, v)))),
    el('div', { class: 'honors' }, ...AUTHOR.honors.map(([k, list], i) =>
      el('div', { class: 'honors__g reveal', data: { d: i } },
        el('div', { class: 'honors__k' }, k),
        el('ul', {}, ...list.map((x) => el('li', {}, x))))))));

  /* contact + links */
  const contactRows = AUTHOR.contact.map(([k, v, href]) =>
    el('div', { class: 'contact__r' },
      el('span', { class: 'contact__k' }, k),
      href ? el('a', { class: 'contact__v', href }, v) : el('span', { class: 'contact__v' }, v)));

  const linkCards = AUTHOR.links.map(([t, href, d]) =>
    el('a', { class: 'about__card reveal', href, target: '_blank', rel: 'noopener' },
      el('span', { class: 'about__cardt' }, t),
      el('span', { class: 'about__cardd' }, d),
      el('span', { class: 'about__cardgo', 'aria-hidden': 'true' }, '↗')));

  root.append(el('section', { class: 'about__sec' },
    sectionHead('六', '联系与友链'),
    el('div', { class: 'contact' }, ...contactRows),
    el('div', { class: 'about__cards' }, ...linkCards),
    el('p', { class: 'about__icp' }, AUTHOR.icp)));

  /* who wrote the content, and where it lives. CC BY 4.0 requires the credit. */
  root.append(el('section', { class: 'about__sec' },
    sectionHead('七', '内容作者'),
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