/* Home, chapter index, chapter reader, long-form reader, methodology. */
import { el, frag, linkify, hi, reveal, countUp, fmt, openSheet, closeSheet, toast, icon, spotlight, scrollSpy, onTeardown } from './ui.js';
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

/* How many of the free-and-high-value items the home page lists before it makes
   you ask for the rest. */
const SEVEN = 7;

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

/* ── the rose ───────────────────────────────────────────────────────────
 * The hero's right column: the whole book as one ring.
 *
 * Four things have been tried here -- an evidence ledger, a dot-matrix wordmark,
 * a bar chart, a text list of live results -- and the list was right about the
 * data and wrong about the form. This is the same chapter data drawn as 33
 * wedges: radial length is how many entries a chapter has, and the inner portion
 * is filled for the share of it that is grade A. So you read two things at a
 * glance without a legend: which sections of life are dense, and where the
 * evidence runs out.
 *
 * Only chapter counts and evidence grade, which is the one axis the book
 * publishes a tally for (410/149/49, matching evidenceStats exactly). Cost and
 * value are deliberately absent: this extraction contradicts the book on both
 * (the text list that occupied this column before it, and the two charts before that, are all noted in the history on this comment).
 *
 * A caveat worth stating rather than hiding: radius overstates differences,
 * because a wedge twice as long is four times the area. The exact count is
 * always in the readout on hover and focus, and the caption says what length
 * means, so nothing is left to the distorted channel alone.
 */
function rose(book) {
  const chs = book.chapters;
  const N = chs.length;
  const max = Math.max(...chs.map((c) => c.stats.n));
  const STEP = 360 / N;
  const GAP = STEP * 0.16;        // breathing room, so 33 wedges stay countable
  const R0 = 52, R1 = 138, CX = 150, CY = 150;
  const TAU = Math.PI / 180;

  const pt = (a, r) => [CX + r * Math.cos(a * TAU), CY + r * Math.sin(a * TAU)];
  const sector = (a0, a1, ri, ro) => {
    const [x0, y0] = pt(a0, ro), [x1, y1] = pt(a1, ro);
    const [x2, y2] = pt(a1, ri), [x3, y3] = pt(a0, ri);
    const big = (a1 - a0) > 180 ? 1 : 0;
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}`
      + `A${ro} ${ro} 0 ${big} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
      + `L${x2.toFixed(2)} ${y2.toFixed(2)}`
      + `A${ri} ${ri} 0 ${big} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
  };

  const svg = el('svg', {
    class: 'rose', viewBox: '0 0 300 300', role: 'img',
    'aria-label': `全书 ${chs.length} 节共 ${book.items.length} 条建议，按条目数画成一圈，长度是条目数，`
      + `靠内的一段是其中 A 级的比例。用键盘左右键在节之间移动。`,
  });

  /* guide rings at 1/3 and 2/3 of the way out, plus the inner baseline */
  for (const f of [0, 1 / 3, 2 / 3, 1]) {
    svg.append(el('circle', {
      class: 'rose__ring', cx: CX, cy: CY,
      r: (R0 + (R1 - R0) * f).toFixed(1),
    }));
  }

  const g = el('g', { class: 'rose__g' });
  const tips = [];
  chs.forEach((c, i) => {
    const n = c.stats.n;
    const a = c.stats.A || 0;
    const share = n ? a / n : 0;
    const ro = R0 + (R1 - R0) * (n / max);
    const a0 = i * STEP - 90 + GAP / 2;
    const a1 = (i + 1) * STEP - 90 - GAP / 2;

    /* the B/C remainder, then the A portion drawn on top from the baseline */
    const rest = el('path', { class: 'rose__rest', d: sector(a0, a1, R0, ro) });
    const grade = el('path', {
      class: 'rose__a', d: sector(a0, a1, R0, R0 + (ro - R0) * share),
    });
    const g1 = el('g', {
      class: 'rose__w', tabindex: '0', role: 'link',
      'aria-label': `第 ${c.no} 节 ${c.title}，${n} 条，A 级 ${a} 条`,
      style: `--i:${i}`,
      onclick: () => { location.hash = `#/ch/${c.no}`; },
    }, rest, grade);
    const show = () => { read(c.no, c.title, n, a); mark(i, true); };
    const hide = () => { mark(i, false); };
    g1.addEventListener('pointerenter', show);
    g1.addEventListener('pointerleave', hide);
    g1.addEventListener('focus', show);
    g1.addEventListener('blur', hide);
    g.append(g1);
    tips.push(ro);
  });
  svg.append(g);

  /* The one number in the hero, counted up as the ring assembles around it.
     Rendered at its final value first: countUp starts from 0, so if rAF never
     fires -- a background tab, some headless setups -- the correct number is
     already on screen rather than a zero. */
  const bigN = el('text', {
    class: 'rose__n', x: CX, y: CY - 2, 'text-anchor': 'middle',
  }, fmt(book.items.length));
  svg.append(bigN);
  svg.append(el('text', {
    class: 'rose__u', x: CX, y: CY + 16, 'text-anchor': 'middle',
  }, '条建议'));

  const mark = (i, on) => {
    const w = g.childNodes[i];
    if (w) w.classList.toggle('is-on', on);
  };

  const first = chs[0];
  const out = el('p', { class: 'rose__out' },
    el('b', {}, `${String(first.no).padStart(2, '0')} ${first.title}`),
    el('span', { class: 'num' }, `${first.stats.n} 条 · A 级 ${first.stats.A || 0}`));
  function read(no, title, n, a) {
    out.replaceChildren(
      el('b', {}, `${String(no).padStart(2, '0')} ${title}`),
      el('span', { class: 'num' }, `${n} 条 · A 级 ${a}`));
  }

  /* left/right arrows walk the chapters, because 33 tab stops before the rest
     of the page is a lot of keystrokes to get past */
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const cur = g.querySelector('.is-on') ? [...g.childNodes].indexOf(g.querySelector('.is-on')) : -1;
    const next = (cur + (e.key === 'ArrowRight' ? 1 : -1) + N) % N;
    g.childNodes[cur]?.classList.remove('is-on');
    const w = g.childNodes[next];
    w.focus();
    w.dispatchEvent(new PointerEvent('pointerenter'));
  });

  /* Start the count a beat after the first wedge, so the number lands inside the
     animation rather than competing with it. requestAnimationFrame because a
     setTimeout(0) would still fire before the first paint on a cold cache. */
  requestAnimationFrame(() => {
    setTimeout(() => countUp(bigN, book.items.length, 900), 120);
  });

  return el('figure', { class: 'rosebox' },
    el('figcaption', { class: 'rose__cap' },
      el('span', {}, `${String(chs.length).padStart(2, '0')} 节`),
      el('span', { class: 'rose__key' },
        el('i', { class: 'rose__ka' }), 'A 级',
        el('i', { class: 'rose__kr' }), 'B / C 级')),
    svg, out);
}

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
  const rose_ = rose(book);
  let lastHits = 0;

  const paint = () => {
    const q = input.value.trim();    if (!q) { counter.textContent = ''; counter.className = 'find__count'; return; }
    const n = runQuery(book, {
      q, ev: [], ch: [], cj: [], cost: [], mag: [], val: [], flag: [],
    }).hits.length;
    lastHits = n;
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
  const field = el('div', { class: 'find__field' }, input, ghost);
  /* The real placeholder and the ghost are both transparent-by-default text at
     the same origin, so they must never both be visible. Earlier the placeholder
     was only hidden on :focus while the ghost animates unfocused -- which stacked
     「搜一件事」 exactly on top of the typing. The field carries the state. */
  const setGhostOn = (on) => field.classList.toggle('has-ghost', on);
  const stop = () => {
    clearInterval(typer);
    typer = null;
    ghost.classList.remove('is-on');
    setGhostOn(false);
  };
  let typer = null;
  let pi = 0;
  const typeNext = () => {
    const text = PROMPTS[pi % PROMPTS.length];
    pi += 1;
    ghost.textContent = '';
    ghost.classList.add('is-on');
    setGhostOn(true);
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

  /* One quiet row of ways in, under a rule. Everything on it is a real query,
     and every number on it is one the book itself publishes -- 410 / 149 / 49
     over 608 is exactly what evidenceStats says.

     The cost filters that used to sit here are gone rather than relabelled.
     `cost=money` selects entries whose money flag is SET (data.js filters on
     it.flags[c]), so the labels 不花钱 / 不占时间 / 不需要毅力 stated the reverse of
     what they returned. And the flags contradict the book anyway: howToRead says
     性价比「极高」means 既不花钱、不花时间、不需要毅力 and that there are 104 of them,
     where this extraction has 78 -- every one carrying all three cost markers --
     while the only 10 genuinely cost-free entries are labelled 一般. The
     per-item cost markers stay on the explore page, where a reader can see them
     next to the claim they belong to. */
  const ways = el('nav', { class: 'ways', 'aria-label': '按证据等级浏览' },
    el('span', { class: 'ways__l' }, '按证据等级'),
    ...[['A', m.evidence.A], ['B', m.evidence.B], ['C', m.evidence.C]].map(([k, n]) =>
      el('a', { class: 'ways__c', href: `#/explore?ev=${k}` },
        el('b', { class: 'num' }, k),
        el('span', { class: 'num' }, fmt(n)))),
    el('a', { class: 'ways__all', href: '#/explore' }, `全部 ${fmt(m.items)} 条`));

  /* Full measure, no side column. Three rounds in this corner all failed the
     same way -- a ~300px sidebar of small marks reads as a sidebar, and no
     amount of content in it makes the page feel composed. Removing the corner
     only works if the statement grows to fill the width, so the title is now
     roughly double its old size and the taxonomy widgets are gone rather than
     relocated. */
  const hero = el('section', { class: 'poster' },
    el('div', { class: 'wrap poster__in' },
      el('div', { class: 'poster__col' },
        el('p', { class: 'poster__eyebrow num' },
          `${fmt(m.items)} 条建议`, el('i', { 'aria-hidden': 'true' }, '/'),
          `${m.chapters} 节`, el('i', { 'aria-hidden': 'true' }, '/'),
          `${book.appendices.length} 篇长文`, el('i', { 'aria-hidden': 'true' }, '/'),
          el('a', { href: '#/method' }, '口径与分级')),

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
          field,
          el('button', { class: 'find__go', type: 'submit' }, '搜索'),
          el('kbd', { class: 'find__kbd', 'aria-hidden': 'true' }, '/')),

        counter,
        examples,
        ways),
      rose_));

  root.append(hero);

  /* ── situations, grouped by what kind of problem it is ───────────── */
  const sitWrap = el('section', { class: 'wrap tint-warm' });
  sitWrap.append(el('div', { class: 'band' },
    el('h2', {}, '按情况'),
    el('p', { class: 'band__d' }, `共 ${book.situations.length} 类。点进去就是筛好的条目。`)));

  const groups = book.situationGroups || [];
  const byGroup = new Map(groups.map((g) => [g, []]));
  for (const s of book.situations) {
    if (!byGroup.has(s.g)) byGroup.set(s.g, []);
    byGroup.get(s.g).push(s);
  }

  /* One hue per situation group, so the five kinds of problem are told apart at a
     glance instead of by reading five identical vermilion dots. Assigned in
     group order, which is the book's own order (急 钱 活 家 心).
     The value is a var() reference, not a literal, so each group follows the
     theme -- the light-theme hues only reached 2.6:1 on the dark ground. */
  const GROUP_HUE = ['var(--g1)', 'var(--g2)', 'var(--g3)', 'var(--g4)', 'var(--g5)'];

  let gi = 0;
  for (const [name, list] of byGroup) {
    if (!list.length) continue;
    const hue = GROUP_HUE[gi % GROUP_HUE.length];
    gi += 1;
    const block = el('div', { class: 'sitgroup' },
      el('div', { class: 'sitgroup__t' },
        el('span', { class: 'sitgroup__dot', 'aria-hidden': 'true', style: `--gh:${hue}` }),
        name,
        el('span', { class: 'sitgroup__n num' }, `${list.length} 类`)));
    const grid = el('div', { class: 'situations' });
    for (const s of list) {
      grid.append(el('a', { class: 'sit spot', href: s.href },
        el('span', { class: 'sit__ico' }, icon(s.icon, 19)),
        el('span', { class: 'sit__b' },
          el('span', { class: 'sit__t' }, s.title),
          el('span', { class: 'sit__h' }, s.hint))));
    }
    block.append(grid);
    sitWrap.append(block);
  }
  root.append(sitWrap);

  /* ── the entries with the most to gain, by evidence ──────────────────────
   This used to be a "不花钱、不占时间、不费毅力 · 符合这三条的共 78 条" section,
   built on value === '极高'. That claim is false against this extraction: the
   book's howToRead defines 极高 as 既不花钱、不花时间、不需要毅力 and says there are
   104 of them, whereas all 78 here carry all three cost markers and the only 10
   genuinely cost-free entries are labelled 一般. Removed rather than relabelled,
   because there is no way to phrase it honestly.
   What replaces it uses the one ordering the book itself vouches for: grade A,
   which its evidenceStats confirms at 410. */
  const topA = book.items
    .filter((i) => i.evidence === 'A')
    .sort((a, b) => (a.ch - b.ch) || (a.no - b.no))
    .slice(0, SEVEN);
  const aWrap = el('section', { class: 'wrap tint-cool' });
  aWrap.append(el('div', { class: 'band' },
    el('h2', {}, 'A 级条目，每节从最前面看起'),
    el('p', { class: 'band__d' },
      `共 ${m.evidence.A} 条有具体数字可查、出自荟萃分析或大型试验。下面按章节顺序取前 ${SEVEN} 条。`),
    el('a', { class: 'band__more', href: '#/explore?ev=A' }, '查看全部')));
  const poster = el('ol', { class: 'seven' });
  topA.forEach((it, i) => {
    poster.append(el('li', { class: 'seven__i reveal', data: { d: i % 4 } },
      el('a', { href: it.href },
        el('span', { class: 'seven__no num' }, String(i + 1).padStart(2, '0')),
        el('span', { class: 'seven__b' },
          el('span', { class: 'seven__t' }, it.title),
          el('span', { class: 'seven__p' }, it.plain.length > 96 ? it.plain.slice(0, 96) + '…' : it.plain)),
        badge(it.evidence))));
  });
  aWrap.append(poster);
  root.append(aWrap);

  /* ── chapter index, dense ─────────────────────────────────────────── */
  const chWrap = el('section', { class: 'wrap tint-warm' });
  chWrap.append(el('div', { class: 'band' },
    el('h2', {}, `按 ${book.chapters.length} 节浏览`),
    el('p', { class: 'band__d' },
      '节标题写的是这一节要防的结果，具体做不做以条目标题为准。')));
  const idx = el('div', { class: 'index33' });
  book.chapters.forEach((c, i) => {
    idx.append(el('a', { class: 'idx33 spot reveal', data: { d: i % 6 }, href: `#/ch/${c.no}` },
      el('span', { class: 'idx33__no num' }, String(c.no).padStart(2, '0')),
      el('span', { class: 'idx33__t' }, c.title),
      el('span', { class: 'idx33__b' }, c.blurb.slice(0, 34) + (c.blurb.length > 34 ? '…' : '')),
      el('span', { class: 'idx33__n num' }, c.stats.n)));
  });
  chWrap.append(idx);
  root.append(chWrap);

  /* ── long-form ─────────────────────────────────────────────────────── */
  const lWrap = el('section', { class: 'wrap tint-cool' });
  lWrap.append(el('div', { class: 'band' },
    el('h2', {}, '长文'),
    el('p', { class: 'band__d' }, `${book.appendices.length} 篇，含对照表和决策表。`)));
  const lg = el('div', { class: 'longgrid' });
  book.appendices.forEach((a, i) => {
    lg.append(el('a', { class: 'lg spot reveal', data: { d: i }, href: `#/long/${a.id}` },
      el('span', { class: 'lg__ico' }, icon('book', 17)),
      el('span', { class: 'lg__t' }, a.title)));
  });
  lWrap.append(lg);
  root.append(lWrap);

  reveal(root);
  spotlight(root);
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
    el('p', {}, '每节内的条目按性价比从高到低排列。节标题写的是这一节要防的结果，具体做不做以条目标题为准。')));

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
    el('a', { href: '#/' }, '首页'), el('i', {}, '/'),
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
    el('a', { href: '#/' }, '首页'), el('i', {}, '/'),
    el('span', {}, '长文')));

  root.append(el('div', { class: 'pagehead' },
    el('span', { class: 'u-label' }, `${book.appendices.length} 篇`),
    el('h1', {}, '长文'),
    el('p', {}, `每个话题单独成篇，比条目本身长。默认收起，点开看全文。`)));

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
    el('a', { href: '#/' }, '首页'), el('i', {}, '/'),
    el('a', { href: '#/long' }, '长文'), el('i', {}, '/'),
    el('span', {}, a.title.slice(0, 14) + '…')));

  const tocLinks = a.blocks.filter((b) => b.t === 'h3').map((b) =>
    el('a', { href: '#', onclick: (e) => { e.preventDefault(); jumpToBlock(b.x); } }, b.x));

  /* No wrapper element around the links. Below 1080px .toc becomes a
     grid-auto-flow: column scroller, and a single wrapper child collapses all
     the links into one full-width column -- which made the TOC 424px tall
     instead of 73px and pushed it into the article. */
  const toc = el('nav', { class: 'toc', 'aria-label': '本文目录' },
    el('div', { class: 'toc__t u-label' }, '目录'),
    ...tocLinks,
    el('div', { class: 'toc__sel' },
      el('span', { class: 'u-label' }, '换一篇'),
      el('select', {
        class: 'select', onchange: (e) => (location.hash = `#/long/${e.target.value}`),
      }, ...book.appendices.map((x) => el('option', { value: x.id, selected: x.id === a.id }, x.title)))));

  const body = el('article', { class: 'prose' });
  body.append(el('h1', {}, a.title));
  if (a.lead) body.append(el('p', { class: 'lead' }, a.lead));
  let tblN = 0;
  const heads = [];
  for (const b of a.blocks) {
    if (b.t === 'p') { body.append(el('p', {}, linkify(b.x, book))); continue; }
    if (b.t === 'h3') { const h = el('h2', {}, b.x); heads.push(h); body.append(h); continue; }
    if (b.t === 'h4') { body.append(el('h3', {}, b.x)); continue; }
    if (b.t === 'li') { body.append(el('p', { class: 'li' }, linkify(b.x, book))); continue; }
    if (b.t === 'table') {
      tblN++;
      body.append(tableBlock(b.x, tblN));
    }
  }
  /* Mark the heading being read and slide the bar to it. scrollSpy runs now and
     returns its own teardown -- wrapping it in another arrow would defer the
     call until teardown time, which is exactly backwards. */
  onTeardown(scrollSpy(tocLinks, () => heads));

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
    el('a', { href: '#/' }, '首页'), el('i', {}, '/'), el('span', {}, '口径')));
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

/* Kept deliberately small. This page used to carry the whole CV -- employers,
   dates, awards, a list of 60 organisations, phone number and email -- all of
   which is one click away on the personal site and none of which a reader of
   608 life-hacks needs. What stays: who made this, and where to go next.
   Name, role and the five links are all from https://www.lizhe.work/ -- nothing
   here is invented. */
const AUTHOR = {
  name: '李哲',
  en: 'Li Zhe',
  role: 'GEO · AI 营销',

  links: [
    ['个人站', 'https://www.lizhe.work/', '完整履历、作品与近况', 'person'],
    ['天行 GEO', 'https://aigeo.games/', '帮品牌进入 AI 的答案', 'target'],
    ['Creator OS', 'https://creatoros.com.cn/', '把内容运营接成一条工作流', 'layers'],
    ['Alice', 'https://alice-lizhesite.vercel.app/', '另一个我', 'spark'],
    ['品牌传播', 'https://dmpr.cn/', '同行站点', 'tag'],
  ],

  icp: '京ICP备2026050119号-2',
};

export function viewAbout(book) {
  const root = el('div', { class: 'wrap about' });

  root.append(el('nav', { class: 'crumbs', 'aria-label': '面包屑' },
    el('a', { href: '#/' }, '首页'), el('i', {}, '/'), el('span', {}, '关于')));

  root.append(el('header', { class: 'about__hero about__hero--tight' },
    el('div', { class: 'about__id' },
      el('span', { class: 'about__mark', 'aria-hidden': 'true' }, 'LZ'),
      el('h1', {}, AUTHOR.name, el('em', {}, AUTHOR.en))),
    el('p', { class: 'about__role' }, AUTHOR.role)));

  /* Provenance in one block: who wrote it, where it lives, under what licence.
     CC BY 4.0 requires the credit, so this cannot be trimmed away. */
  root.append(el('section', { class: 'about__sec' },
    sectionHead('一', '内容与出处'),
    el('div', { class: 'credit' },
      el('div', { class: 'credit__row' },
        el('span', { class: 'credit__k' }, '内容作者'),
        el('a', { class: 'credit__v credit__v--link', href: 'https://github.com/eternity4719', target: '_blank', rel: 'noopener' },
          'eternity4719')),
      el('div', { class: 'credit__row' },
        el('span', { class: 'credit__k' }, '项目'),
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
          el('em', {}, '只做检索、筛选与排版，不改写结论。'))))));

  root.append(el('section', { class: 'about__sec' },
    sectionHead('二', '相关站点'),
    el('div', { class: 'about__cards' },
      ...AUTHOR.links.map(([t, href, d, ic], i) =>
        el('a', { class: 'about__card spot reveal', data: { d: i }, href, target: '_blank', rel: 'noopener' },
          el('span', { class: 'about__cardi', 'aria-hidden': 'true' }, icon(ic, 18)),
          el('span', { class: 'about__cardb' },
            el('span', { class: 'about__cardt' }, t),
            el('span', { class: 'about__cardd' }, d)),
          el('span', { class: 'about__cardgo', 'aria-hidden': 'true' }, icon('arrow', 15))))),
    el('p', { class: 'about__icp' }, AUTHOR.icp)));

  reveal(root);
  return root;
}
