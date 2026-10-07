/* Data layer: load the book, flatten it, build the search index. */

const MODULE_URL = new URL(import.meta.url);
const MODULE_VERSION = MODULE_URL.searchParams.get('v');
const dataUrl = (name) => new URL(
  `../data/${name}${MODULE_VERSION ? `?v=${encodeURIComponent(MODULE_VERSION)}` : ''}`,
  MODULE_URL,
).href;

export const DATA_URL = dataUrl('book.json');
const DETAIL_URL = dataUrl('detail.json');

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** Heavy per-item text (收益原文 / 来源 / 备注), fetched once on first need. */
let detailPromise = null;
export function loadDetail() {
  detailPromise ||= fetch(DETAIL_URL).then((r) => (r.ok ? r.json() : {}));
  return detailPromise;
}

export async function loadBook() {
  const res = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error('book.json ' + res.status);
  const book = await res.json();
  return shape(book);
}

function shape(book) {
  const items = [];
  const byId = new Map();
  const chTitle = new Map();

  for (const ch of book.chapters) {
    chTitle.set(ch.no, ch.title);
    ch.items.forEach((it) => {
      const flat = {
        ...it,
        benefit: '', sources: [], notes: '',
        ch: ch.no,
        chTitle: ch.title,
        cj: ch.cj,
        ref: it.id,
        href: `#/ch/${ch.no}/${it.no}`,
      };
      flat.hay = [it.title, it.plain, it.cost, ch.title].join('\n').toLowerCase();
      items.push(flat);
      byId.set(flat.ref, flat);
    });
  }

  // longest-first so "总死亡率" wins over "死亡"
  const terms = book.glossary
    .filter((g) => {
      const t = g.t.trim();
      if (/^[a-z]$/i.test(t)) return false;
      return t.length >= 2;
    })
    .sort((a, b) => b.t.length - a.t.length);
  const termRe = terms.length
    ? new RegExp('(?<![0-9A-Za-z])(?:' + terms.map((g) => escapeRe(g.t.trim())).join('|') +
                 ')(?![0-9A-Za-z])', 'g')
    : null;

  const api = {
    meta: book.meta,
    method: book.method,
    howToRead: book.howToRead,
    situations: book.situations || [],
    questions: book.questions,
    glossary: book.glossary,
    chapters: book.chapters,
    appendices: book.appendices,
    changelog: book.changelog,
    items,
    byId,
    chTitle,
    termRe,
    facets: buildFacets(items),
    hydrated: false,
    async ensureDetail() {
      if (this.hydrated) return true;
      const d = await loadDetail();
      for (const it of items) {
        const x = d && d[it.ref];
        if (!x) continue;
        // cost / refs / evidenceNote are deferred out of book.json too, because
        // nothing on the first paint reads them — see DEFERRED in build_data.py
        it.benefit = x.benefit || '';
        it.sources = x.sources || [];
        it.notes = x.notes || '';
        it.cost = x.cost || '';
        it.refs = x.refs || [];
        it.evidenceNote = x.evidenceNote || '';
        it.hay = [it.title, it.plain, it.benefit, it.cost, it.notes, it.chTitle]
          .join('\n').toLowerCase();
      }
      this.hydrated = true;
      return true;
    },
  };
  return api;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ── facets ─────────────────────────────────────────────────────────── */

function buildFacets(items) {
  const tally = (get) => {
    const m = new Map();
    for (const it of items) for (const v of [].concat(get(it) ?? [])) {
      if (v == null || v === '') continue;
      m.set(v, (m.get(v) || 0) + 1);
    }
    return m;
  };
  const costTally = new Map();
  for (const it of items) {
    for (const [k, v] of Object.entries(it.flags)) if (v) {
      costTally.set(k, (costTally.get(k) || 0) + 1);
    }
  }
  const ev = tally((it) => it.evidence);
  const cj = new Map();
  for (const it of items) for (const v of it.cj) cj.set(v, (cj.get(v) || 0) + 1);
  return {
    ev: [...ev].sort((a, b) => a[0].localeCompare(b[0])),
    cj: [...cj],
    cost: [...costTally],
    mag: tally((it) => it.mag),
    val: tally((it) => it.value),
    flag: [
      ['dispute', items.filter((i) => i.dispute).length],
      ['todo', items.filter((i) => i.todo).length],
    ],
  };
}

/* ── query parsing ──────────────────────────────────────────────────── */

export function parseQuery(raw) {
  const q = { text: '', ev: [], ch: [], cj: [], cost: [], mag: [], val: [], flag: [] };
  const rest = [];
  for (const tok of String(raw).split(/\s+/)) {
    if (!tok) continue;
    let m;
    if ((m = tok.match(/^(?:证据|ev|grade):(.+)$/i))) q.ev.push(...m[1].split(/[,，|]/).filter(Boolean));
    else if ((m = tok.match(/^(?:节|chapter|ch):(\d+)$/i))) q.ch.push(+m[1]);
    else if ((m = tok.match(/^(?:换|口径|cj):(.+)$/i))) q.cj.push(...m[1].split(/[,，|]/).filter(Boolean));
    else if ((m = tok.match(/^(?:成本|cost):(.+)$/i))) q.cost.push(...m[1].split(/[,，|]/).filter(Boolean));
    else if ((m = tok.match(/^(?:量级|mag):(.+)$/i))) q.mag.push(...m[1].split(/[,，|]/).filter(Boolean));
    else if ((m = tok.match(/^(?:性价比|val|value):(.+)$/i))) q.val.push(...m[1].split(/[,，|]/).filter(Boolean));
    else if ((m = tok.match(/^(?:标记|flag):(.+)$/i))) q.flag.push(...m[1].split(/[,，|]/).filter(Boolean));
    else if (tok.startsWith('"') && tok.endsWith('"') && tok.length > 2) q.text += ' ' + tok.slice(1, -1);
    else rest.push(tok);
  }
  q.text = rest.join(' ').trim().toLowerCase();
  return q;
}

const GROUPS = ['ev', 'ch', 'cj', 'cost', 'mag', 'val', 'flag'];

/** Merge the inline `证据:A` syntax with the facet sets held in app state. */
function effective(state) {
  const q = parseQuery(state.q || '');
  for (const g of GROUPS) {
    const inline = q[g].map((v) => String(v));
    q[g] = [...new Set([...inline, ...(state[g] || [])].map((v) => String(v)))];
  }
  return q;
}

export function runQuery(book, state) {
  const q = effective(state);
  const terms = q.text.split(/\s+/).filter(Boolean);
  const hits = scan(book, q, terms, terms.length > 0 ? 'all' : null);
  // A multi-word query is AND by default. If nothing matches every term, fall back
  // to "any term" rather than showing a dead end.
  let relaxed = false;
  if (!hits.length && terms.length > 1) {
    relaxed = scan(book, q, terms, 'any').length > 0;
    return { q, terms, hasText: true, hits: relaxed ? scan(book, q, terms, 'any') : [], relaxed };
  }
  return { q, terms, hasText: terms.length > 0, hits, relaxed };
}

function scan(book, q, terms, mode) {
  const out = [];
  for (const it of book.items) {
    if (q.ev.length && !q.ev.some((e) => e.toUpperCase().startsWith(it.evidence))) continue;
    if (q.ch.length && !q.ch.some((c) => it.ch === +c)) continue;
    if (q.cj.length && !q.cj.some((c) => it.cj.some((x) => x.includes(c)))) continue;
    if (q.cost.length && !q.cost.some((c) => it.flags[c])) continue;
    if (q.mag.length && !q.mag.includes(it.mag)) continue;
    if (q.val.length && !q.val.includes(it.value)) continue;
    if (q.flag.length && !q.flag.some((f) => it[f])) continue;
    let sc = 0;
    if (mode) {
      const parts = scoreParts(it);
      let matched = 0, sum = 0;
      for (const t of terms) {
        const s = scoreOne(parts, t);
        if (s) { matched += 1; sum += s; }
      }
      if (!matched) continue;
      if (mode === 'all' && matched < terms.length) continue;
      sc = sum + matched * 3;
    }
    out.push({ it, sc });
  }
  return out;
}

const FIELD_W = { title: 7, plain: 5, benefit: 2.6, cost: 2.2, notes: 1.5, ch: 3.4 };

/* cost / benefit / notes are deferred into detail.json, so they are legitimately
   undefined until that loads. A deep link like #/explore?q=押金 renders before
   the fetch resolves, so every field has to tolerate being absent. */
function scoreParts(it) {
  const s = (v) => (v || '').toLowerCase();
  return {
    title: s(it.title), plain: s(it.plain), benefit: s(it.benefit),
    cost: s(it.cost), notes: s(it.notes), ch: s(it.chTitle),
  };
}

function scoreOne(parts, t) {
  let best = 0;
  for (const [f, text] of Object.entries(parts)) {
    const idx = text.indexOf(t);
    if (idx >= 0) {
      const atStart = idx === 0;
      const s = FIELD_W[f] * (atStart ? 1.35 : 1) * (1 + t.length / 40);
      if (s > best) best = s;
    }
  }
  return best;
}

/**
 * Facet counts for the current result set. Each group is counted with its *own*
 * filter removed, so picking 证据 A still shows how many 证据 B are reachable.
 */
export function countBy(book, state) {
  const counts = {};
  for (const skip of [null, ...GROUPS]) {
    const probe = skip
      ? { ...state, [skip]: new Set() }
      : state;
    const hits = runQuery(book, probe).hits.map((h) => h.it);
    const src = hits.length ? hits : book.items;
    const tally = (key) => {
      const m = new Map();
      for (const it of src) for (const v of [].concat(key(it) ?? [])) {
        if (v == null || v === '') continue;
        m.set(v, (m.get(v) || 0) + 1);
      }
      return m;
    };
    const costM = new Map();
    for (const it of src) {
      for (const [k, v] of Object.entries(it.flags)) if (v) costM.set(k, (costM.get(k) || 0) + 1);
    }
    const row = {
      ev: tally((i) => i.evidence),
      cj: tally((i) => i.cj),
      cost: costM,
      mag: tally((i) => i.mag),
      val: tally((i) => i.value),
      flag: tally((i) => ['dispute', 'todo'].filter((f) => i[f])),
      ch: tally((i) => i.ch),
    };
    for (const g of GROUPS) if (g === skip) counts[g] = row[g];
  }
  counts.ch = counts.ch ?? new Map();
  return counts;
}

export function snippet(it, terms, len = 132) {
  const fields = [it.plain, it.benefit, it.cost, it.notes];
  for (const f of fields) {
    const low = f.toLowerCase();
    let at = -1;
    for (const t of terms) {
      const i = low.indexOf(t);
      if (i >= 0 && (at < 0 || i < at)) at = i;
    }
    if (at < 0) continue;
    const from = Math.max(0, at - 26);
    return (from ? '…' : '') + f.slice(from, from + len) + (from + len < f.length ? '…' : '');
  }
  return it.plain.slice(0, len);
}

export function cnNum(n) {
  if (n <= 10) return CN_NUM[n];
  if (n < 20) return '十' + CN_NUM[n - 10];
  return CN_NUM[Math.floor(n / 10)] + '十' + (n % 10 ? CN_NUM[n % 10] : '');
}
