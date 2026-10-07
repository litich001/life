"""Build data/book.json for the 高性价比人生指南 site from the source PDF."""
import json
import os
import re
import sys
from collections import Counter, OrderedDict

import pdfkit
import refdata
import build_meta
from pdfkit import BO, BC

sys.stdout.reconfigure(encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'data')
os.makedirs(OUT, exist_ok=True)

FIELDS = ('成本', '说人话', '收益', '证据等级', '来源', '备注')
BULLET_RE = re.compile(r'^[•·]\s*(\S+?)：\s*(.*)$', re.S)
NUM_RE = re.compile(r'^(\d{1,3})\.\s+(\S.*)$')
CH_NUM_RE = re.compile(r'^(\d{1,2})\.\s+(\S.*)$')
PAGE_RE = re.compile(r'^=== PAGE (\d+) ===$')
URL_RE = re.compile(r'https?://[^\s，,。；;）)】]+')
CJ_MAP = [('人身自由', '人身自由'), ('死亡率', '寿命'), ('死因', '寿命'), ('存活', '寿命'),
          ('健康终点', '寿命'), ('时间', '时间精力'), ('精力', '时间精力'),
          ('金钱', '金钱'), ('保障', '金钱'), ('法律责任', '金钱'), ('个人信息', '金钱')]
CJ_DEFAULT = {6: ['金钱', '时间精力'], 10: ['寿命', '金钱', '时间精力']}

LOG = []


def note(msg):
    LOG.append(str(msg))
    print(msg)


def sb(t):
    return t.replace(BO, '').replace(BC, '')


# ───────────────────────────────────────────────────────── load
PAGES = pdfkit.load_page_lines()
RAW = []
for i, rows in enumerate(PAGES):
    RAW.append('=== PAGE %d ===' % (i + 1))
    RAW.extend(r['t'] for r in rows)
PL = [sb(x) for x in RAW]
N = len(RAW)


def find(text, start=0):
    for i in range(start, N):
        if PL[i].strip() == text:
            return i
    return -1


APPENDIX_TITLES = [
    '结婚划不划算：把一笔糊涂账拆成五笔清楚账',
    '家庭应急装备清单：买什么、放哪里、多久检查一次',
    '路上遇到陌生人出事，走开还是停下',
    '做平台要办哪些证：对照表与选服务器的决策表',
    '身体怎么认时间，夜班又为什么伤人',
]
I_SECTIONS = find('各节简介')
I_BODY = find('1. 不要早死', I_SECTIONS + 1)
APP_IDX = [find(t, I_BODY) for t in APPENDIX_TITLES]
I_VERSION = find('版本说明', APP_IDX[-1])
note('sections=%d body=%d appendix=%s version=%d' % (I_SECTIONS, I_BODY, APP_IDX, I_VERSION))

# ───────────────────────────────────────────────── 各节简介
blurbs, cur = {}, None
for i in range(I_SECTIONS + 1, I_BODY):
    s = PL[i].strip()
    if not s or PAGE_RE.match(s):
        continue
    m = CH_NUM_RE.match(s)
    if m and int(m.group(1)) <= 33 and int(m.group(1)) not in blurbs:
        cur = int(m.group(1))
        rest = m.group(2)
        title, body = rest.split('：', 1) if '：' in rest else (rest, '')
        blurbs[cur] = {'title': title.strip(), 'text': body}
    elif cur:
        blurbs[cur]['text'] += s
note('blurbs=%d' % len(blurbs))


def kou_jing(text):
    m = re.search(r'口径[：:]\s*(.+)$', text)
    seg = m.group(1) if m else text[-24:]
    out = []
    for key, val in CJ_MAP:
        if key in seg and val not in out:
            out.append(val)
    return out


# ───────────────────────────────────────────────── chapters + items
def is_bold(t):
    t = t.strip()
    return t.startswith(BO) and t.endswith(BC)


def after_kind(i):
    """What follows a heading line: a field bullet, a bold title continuation, or prose."""
    for j in range(i + 1, min(i + 6, N)):
        s = PL[j].strip()
        if not s or PAGE_RE.match(s):
            continue
        m = BULLET_RE.match(s)
        if m and m.group(1) in FIELDS:
            return 'field'
        return 'heading' if is_bold(RAW[j]) else 'prose'
    return 'prose'


def is_chapter_heading(i, n):
    """A chapter heading is a bold 'N. …' line followed by intro prose."""
    m = CH_NUM_RE.match(PL[i].strip())
    return bool(m and int(m.group(1)) == n and is_bold(RAW[i]) and after_kind(i) == 'prose')


def starts_field(i):
    return after_kind(i) == 'field'


starts, prev = [], -1
for n in range(1, 34):
    at = next((i for i in range(prev + 1, min(prev + 6000, APP_IDX[0]))
               if is_chapter_heading(i, n)), -1)
    if at < 0:
        note('!! chapter %d heading not found' % n)
        at = prev + 1
    starts.append((n, at))
    prev = at
note('chapter starts=%d' % len(starts))


def parse_items(lo, hi):
    items, cur, last, expect = [], None, None, 1
    for i in range(lo, hi):
        s = PL[i].strip()
        if not s or PAGE_RE.match(s):
            continue
        m = BULLET_RE.match(s)
        if m and m.group(1) in FIELDS:
            if cur is not None:
                raw = RAW[i].strip()
                val = re.sub(r'^[•·]\s*\S+?：\s*', '', raw, flags=re.S)
                cur['fields'][m.group(1)] = val
                last = m.group(1)
            continue
        mn = NUM_RE.match(s)
        if mn and is_bold(RAW[i]) and after_kind(i) in ('field', 'heading'):
            no = int(mn.group(1))
            title = mn.group(2).strip()
            for j in range(i + 1, min(i + 6, hi)):        # absorb wrapped title lines
                ts = PL[j].strip()
                if not ts or PAGE_RE.match(ts) or BULLET_RE.match(ts):
                    break
                if not is_bold(RAW[j]):
                    break
                title += ts
            cur = {'no': no, 'title': title, 'fields': OrderedDict()}
            items.append(cur)
            last, expect = None, no + 1
            continue
        if cur is None or last is None:
            continue
        cur['fields'][last] += RAW[i]
    for it in items:
        it['fields'] = OrderedDict((k, v.strip()) for k, v in it['fields'].items())
    return items


chapters = []
for idx, (num, st) in enumerate(starts):
    en = starts[idx + 1][1] if idx + 1 < len(starts) else APP_IDX[0]
    intro, first_item = [], None
    for i in range(st + 1, en):
        s = PL[i].strip()
        if not s or PAGE_RE.match(s):
            continue
        if first_item is None and not NUM_RE.match(s):
            intro.append(RAW[i])
        else:
            if first_item is None:
                first_item = i
    items = parse_items(first_item, en) if first_item is not None else []
    chapters.append({'no': num, 'intro': ''.join(intro).strip(), 'items': items,
                     'start': first_item or st, 'end': en})
note('chapters=%d items=%d' % (len(chapters), sum(len(c['items']) for c in chapters)))

# ───────────────────────────────────────────────────────── front matter
I_HOW = find('怎么读', 0)
I_GLOSS = find('读懂数字（术语表）', I_HOW)
I_Q = find('去哪看', 0)

# 问题 → 章节 map: in the front-matter table each chapter line is followed by
# its question, so a question is the text between two chapter markers.
marks = []
i = I_Q + 1
while i < I_HOW:
    s = PL[i].strip()
    m = CH_NUM_RE.match(s) if s and not PAGE_RE.match(s) else None
    if m and 1 <= int(m.group(1)) <= 33:
        marks.append((int(m.group(1)), i, sb(m.group(2))))
    i += 1
questions = []
for k, (n, at, title) in enumerate(marks):
    end = marks[k + 1][1] if k + 1 < len(marks) else I_HOW
    q = ''.join(sb(PL[j].strip()) for j in range(at + 1, end)
                if PL[j].strip() and not PAGE_RE.match(PL[j].strip()))
    questions.append({'q': q or title, 'ch': n, 'title': title})
note('questions=%d' % len(questions))

# 怎么读 bullets
how_to_read, i = [], I_HOW + 1
while i < min(I_GLOSS + 40, I_BODY):
    s = PL[i].strip()
    if not s or PAGE_RE.match(s):
        i += 1
        continue
    if s.startswith('每条建议长这样') or s.startswith('自己跑一份'):
        break
    if s.startswith('•'):
        how_to_read.append(sb(s.lstrip('•· ').strip()))
    i += 1
note('how_to_read=%d' % len(how_to_read))

# 术语表 - terms are fixed by the book; definitions run to the next term.
# Stop at “各节简介”, not the first body chapter. Otherwise the final glossary
# row absorbs every chapter summary between those two anchors.
glossary, spans, i = [], [], I_GLOSS + 1
while i < I_SECTIONS:
    s = PL[i].strip()
    if s and s not in ('术语', '意思', '各节简介'):
        spans.append((i, s))
    i += 1
for term in refdata.GLOSSARY_TERMS:
    at = next((k for k, (i2, s) in enumerate(spans) if s == term), None)
    if at is None:
        continue
    defn = []
    for k in range(at + 1, len(spans)):
        if spans[k][1] in refdata.GLOSSARY_TERMS:
            break
        defn.append(spans[k][1])
    definition = ''.join(defn)
    definition = re.sub(r'=== PAGE \d+ ===', '', definition).strip()
    definition = refdata.GLOSSARY_DEFINITION_FIXES.get(term, definition)
    glossary.append({'t': term, 'd': definition})
note('glossary=%d/%d' % (len(glossary), len(refdata.GLOSSARY_TERMS)))

glossary_group_of = {
    term: group
    for group, terms in refdata.GLOSSARY_GROUPS
    for term in terms
}
for entry in glossary:
    entry['g'] = glossary_group_of[entry['t']]

bad_glossary = [
    entry['t'] for entry in glossary
    if not entry['d']
    or len(entry['d']) > 300
    or re.search(r'=== PAGE|各节简介|1\. 不要早死', entry['d'])
]
if bad_glossary:
    raise ValueError('invalid glossary definitions: ' + ', '.join(bad_glossary))

# ───────────────────────────────────────────────────────── appendices
def page_of(idx):
    for j in range(idx, -1, -1):
        m = PAGE_RE.match(PL[j].strip())
        if m:
            return int(m.group(1))
    return 1


def seg_page(pno):
    """Split one page into ordered segments: ('text', [lines]) / ('table', table)."""
    rows = PAGES[pno - 1]
    regs = pdfkit.detect_table_regions(rows)
    segs, used = [], set()
    if regs:
        for reg in sorted(regs, key=lambda r: r['y0']):
            pre = [r for r in rows if r['y'] < reg['y0'] - 3]
            post_start = reg['y1'] + 1
            if pre:
                segs.append(('text', [r['t'] for r in pre]))
                used.update(id(r) for r in pre)
            segs.append(('table', refdata.TABLES.get(pno)))
            for r in rows:
                if reg['y0'] - 3 <= r['y'] <= post_start:
                    used.add(id(r))
    rest = [r for r in rows if id(r) not in used]
    if rest:
        segs.append(('text', [r['t'] for r in rest]))
    return segs


H3 = re.compile(r'^[一二三四五六七八九十]+、\s*\S')
H4 = re.compile(r'^（[一二三四五六七八九十]+）')
LI = re.compile(r'^[•·]\s*(\S.*)$')
OLI = re.compile(r'^(\d{1,2})\.\s+(\S.*)$')
END_PUNCT = '。！？：；」』）】'
# The heading predicate lives in heading_rules.py so this extractor and
# tools/fix_headings.py cannot disagree about what counts as a heading. The rule,
# and the citation debris it exists to reject, are documented over there.
from heading_rules import looks_like_heading  # noqa: E402


def lines_to_blocks(lines):
    """Group PDF text lines into paragraphs / headings / list items.

    A line like "一、回电话和被问话。你打 120 或者 110，号码都会留下。…"
    is a bold lead-in inside a paragraph, not a heading, so headings are
    only recognised when the line is short AND reads like a title. The bare
    length test this replaced promoted an NCT registration number, a journal
    reference and a URL tail to headings.
    """
    blocks = []
    for raw in lines:
        s = sb(raw).strip()
        if not s:
            continue
        m = LI.match(s)
        if m:
            blocks.append({'t': 'li', 'x': m.group(1)})
            continue
        if OLI.match(s) and len(s) < 60 and not s.endswith(END_PUNCT):
            blocks.append({'t': 'li', 'x': s})
            continue
        if H4.match(s) and len(s) <= 40:
            blocks.append({'t': 'h4', 'x': s})
            continue
        if looks_like_heading(s):
            blocks.append({'t': 'h3', 'x': s})
            continue
        if blocks and blocks[-1]['t'] == 'p' and blocks[-1]['x'][-1] not in END_PUNCT:
            blocks[-1]['x'] += s
        else:
            blocks.append({'t': 'p', 'x': s})
    return blocks


appendices = []
bounds = [(APP_IDX[k], APP_IDX[k + 1] if k + 1 < len(APP_IDX) else I_VERSION)
          for k in range(len(APP_IDX))]
for k, (a, b) in enumerate(bounds):
    p0, p1 = page_of(a), page_of(b) - 1
    segs = []
    for pno in range(p0, p1 + 1):
        segs.extend(seg_page(pno))
    blocks, pending = [], []
    for kind, payload in segs:
        if kind == 'text':
            pending.extend(payload)
        else:
            blocks.extend(lines_to_blocks(pending))
            pending = []
            if payload:
                blocks.append({'t': 'table', 'x': payload})
    blocks.extend(lines_to_blocks(pending))
    # drop the appendix's own title line; the first paragraph becomes the lead
    if blocks and blocks[0]['t'] in ('p', 'h3', 'h4') and \
            blocks[0]['x'].startswith(APPENDIX_TITLES[k][:8]):
        blocks.pop(0)
    aid, atitle = refdata.APPENDIX_META[k]
    lead = ''
    if blocks and blocks[0]['t'] == 'p':
        lead = blocks[0]['x']
        blocks = blocks[1:]
    appendices.append({'id': aid, 'title': atitle, 'lead': lead, 'blocks': blocks})
note('appendices: ' + ' '.join('%s=%d' % (a['id'], len(a['blocks'])) for a in appendices))

# 版本说明
changelog = []
for i in range(I_VERSION + 1, N):
    s = PL[i].strip()
    if not s or PAGE_RE.match(s):
        continue
    if s.startswith('•'):
        changelog.append(sb(s.lstrip('•· ').strip()))
    elif changelog:
        changelog[-1] += sb(s)
note('changelog=%d' % len(changelog))

# ───────────────────────────────────────────────────────── assemble
out_ch, ev_c, val_c, n_dis, n_tod = build_meta.build(
    chapters, blurbs, questions, glossary, how_to_read, appendices, changelog)

book = {
    'meta': {
        'title': '高性价比人生指南',
        'subtitle': '用最少的钱、时间和精力，换回寿命、金钱和自由',
        'tagline': '608 条建议，每条写明花掉什么、换回什么、证据有多硬。',
        'bookGenerated': '2026-09-25 20:52（北京时间）',
        'sourceRepo': 'https://github.com/eternity4719/HowToLiveBetter',
        'sourcePages': 342,
        'chapters': 33,
        'items': sum(len(c['items']) for c in out_ch),
        'evidence': dict(ev_c),
        'value': dict(val_c),
        'dispute': n_dis,
        'todo': n_tod,
    },
    'method': {
        'resources': [{'k': k, 'd': d} for k, d in refdata.RESOURCES],
        'tiers': [{'k': k, 'd': d} for k, d in refdata.BENEFIT_TIERS],
        'evidence': [{'k': k, 'd': d} for k, d in refdata.EVIDENCE],
        'evidenceStats': refdata.EVIDENCE_STATS,
        'value': [{'dim': a, 'values': b, 'how': c} for a, b, c in refdata.VALUE_DIMS],
        'valueStats': refdata.VALUE_STATS,
    },
    'howToRead': how_to_read,
    'situationGroups': list(refdata.SITUATION_GROUPS),
    'situations': [
        {
            'g': grp, 'icon': icon, 'title': t, 'hint': hint,
            'href': '#/explore?' + q if q else '#/explore',
        }
        for grp, icon, t, hint, q in refdata.SITUATIONS
    ],
    'questions': questions,
    'glossary': glossary,
    'chapters': out_ch,
    'appendices': appendices,
    'changelog': changelog,
}

# Heavy per-item text goes into a second file that the page only fetches the
# first time a reader opens a card's detail. Anything not needed to draw the
# grid belongs here, not in the first-paint payload:
#   benefit / sources / notes  -- detail body
#   cost                       -- detail body only (the card shows derived cost
#                                 flags, not the cost prose)
#   refs                       -- cross-reference chips, detail only
#   evidenceNote               -- methodology page only
DEFERRED = ('benefit', 'sources', 'sourceRaw', 'urls', 'notes', 'cost', 'refs', 'evidenceNote')

detail = {}
core_chapters = []
for c in out_ch:
    core_items = []
    for it in c['items']:
        detail[it['id']] = {
            'benefit': it.get('benefit', ''),
            'sources': it.get('sources', []),
            'notes': it.get('notes', ''),
            'cost': it.get('cost', ''),
            'refs': it.get('refs', []),
            'evidenceNote': it.get('evidenceNote', ''),
        }
        core_items.append({k: v for k, v in it.items() if k not in DEFERRED})
    cc = dict(c)
    cc['items'] = core_items
    core_chapters.append(cc)
book['chapters'] = core_chapters

path = os.path.join(OUT, 'book.json')
with open(path, 'w', encoding='utf-8') as f:
    json.dump(book, f, ensure_ascii=False, separators=(',', ':'))

dpath = os.path.join(OUT, 'detail.json')
with open(dpath, 'w', encoding='utf-8') as f:
    json.dump(detail, f, ensure_ascii=False, separators=(',', ':'))

note('wrote %s (%.1f KB) + %s (%.1f KB)' % (
    path, os.path.getsize(path) / 1024, dpath, os.path.getsize(dpath) / 1024))
note('first-paint payload: %.1f KB uncompressed; brotli puts it near %.1f KB' % (
    os.path.getsize(path) / 1024, os.path.getsize(path) / 1024 * 0.28))
note('stats: %s | %s | dispute=%d todo=%d' % (dict(ev_c), dict(val_c), n_dis, n_tod))
mag_c = Counter(i['mag'] for c in out_ch for i in c['items'])
flag_c = Counter(tuple(sorted(k for k, v in i['flags'].items() if v)) for c in out_ch for i in c['items'])
note('magnitude: %s' % mag_c.most_common())
note('zero-cost combos: %s' % flag_c.most_common(10))
sample = [i for c in out_ch for i in c['items'] if i['mag'] == '大'][:6]
for s in sample:
    note('  大 | %s | plain=%s' % (s['id'], s['plain'][:70]))
sample = [i for c in out_ch for i in c['items'] if i['mag'] == '小'][:6]
for s in sample:
    note('  小 | %s | plain=%s' % (s['id'], s['plain'][:70]))
note('glossary terms: ' + ' / '.join(g['t'] for g in glossary))
note('questions sample: ' + json.dumps(questions[:3], ensure_ascii=False))
open(os.path.join(OUT, '_build.log'), 'w', encoding='utf-8').write('\n'.join(LOG))
