"""Part 2: derive metadata, build front matter + appendices, emit data/book.json."""
import json
import os
import re
import sys
from collections import Counter, OrderedDict

import pdfkit
import refdata
from pdfkit import BO, BC

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))


def sb(t):
    return t.replace(BO, '').replace(BC, '')


# ─────────────────────────────────────────── cost / magnitude / value rules
# Costs are stated explicitly in the 成本 column, so a dimension counts as *paid*
# when the text shows an amount / a duration / a difficulty, and as free otherwise.
MONEY_COST = re.compile(r'\d[\d.]*\s*(?:到|~|-|–)?\s*\d*\s*(?:元|块钱|块)|几百|几千|上万|几万元|'
                        r'一两百|收费|付费|费用|价钱|价格|贵几|要花钱|自费|押金')
TIME_COST = re.compile(r'\d[\d.]*\s*(?:到|~|-|–)?\s*\d*\s*(?:秒|分钟|小时|天|周|个月|年|次)|'
                       r'每天|每周|每月|长期|一次\s*\d')
WILL_COST = re.compile(r'难[的在于地方是]|毅力|意志力|坚持|自律|靠忍|戒[掉酒]|习惯|熬')


def cost_flags(cost):
    """True = this resource is *not* consumed."""
    return {
        'money': not MONEY_COST.search(cost),
        'time': not TIME_COST.search(cost),
        'will': not WILL_COST.search(cost),
    }


PCT_RE = re.compile(r'(\d+(?:\.\d+)?)\s*%')
INC = re.compile(r'(升高|增加|上升|增长|更高|高出|多了|多出|涨到|升到)')
MONEY_BIG = re.compile(r'\d+\s*万|万元|上百万')
MONEY_MID = re.compile(r'\d{3,4}\s*元|几千|数百|几千元')
TIME_BIG = re.compile(r'每天|每小时|日均')
TIME_MID = re.compile(r'每周|一个月|每月')


def _pct_candidates(txt):
    """(value, context) for every percentage that reads as a reduction."""
    out = []
    for m in PCT_RE.finditer(txt):
        val = float(m.group(1))
        if val <= 0 or val >= 100:
            continue
        after = txt[m.end():m.end() + 6]
        if 'CI' in after or '可信范围' in after:
            continue
        ctx = txt[max(0, m.start() - 28):m.end() + 10]
        if INC.search(ctx):
            continue
        out.append((val, ctx))
    return out


def magnitude(benefit, plain, cj):
    """Apply the book's own published thresholds (≥20% 大 / 10–20% 中 / else 小)."""
    for txt in (plain, benefit):
        cands = _pct_candidates(txt)
        if not cands:
            continue
        death = [v for v, c in cands if '死亡' in c or '致死' in c or '病死' in c]
        best = max(death) if death else max(v for v, _ in cands)
        if best >= 20:
            return '大'
        if best >= 10:
            return '中'
        return '小'
    blob = benefit + plain
    if MONEY_BIG.search(blob):
        return '大'
    if MONEY_MID.search(blob):
        return '中'
    if TIME_BIG.search(blob):
        return '大'
    if TIME_MID.search(blob):
        return '中'
    return '小'


def value_tier(mag, flags):
    zeros = sum(1 for v in flags.values() if v)
    if mag == '大' and zeros == 3:
        return '极高'
    if (mag == '大' and zeros >= 2) or (mag == '中' and zeros == 3):
        return '高'
    return '一般'


REF_ITEM = re.compile(r'第\s*(\d{1,2})\s*节\s*第\s*(\d{1,3})\s*条')
REF_CH = re.compile(r'第\s*(\d{1,2})\s*节(?!\s*第)')


def evidence_of(raw):
    s = sb(raw).strip()
    m = re.match(r'^([ABC])', s)
    base = m.group(1) if m else 'C'
    note = s[m.end():].strip('（）() ') if m else s
    return base, note


def build(chapters, blurbs, questions, glossary, how_to_read, appendices, changelog):
    out_ch = []
    stats_ev = Counter()
    stats_val = Counter()
    n_dispute = n_todo = 0
    for c in chapters:
        no = c['no']
        bl = blurbs[no]['text']
        kj = refdata_cj(bl)
        blurb = re.split(r'口径[：:]', bl)[0].strip().rstrip('。')
        items = []
        cev = Counter()
        for it in c['items']:
            f = it['fields']
            ev, evnote = evidence_of(f.get('证据等级', 'C'))
            blob = ' '.join(sb(v) for v in f.values())
            dispute = '争议' in blob
            todo = bool(re.search(r'TODO|待核实', blob))
            refs = []
            for m in REF_ITEM.finditer(blob):
                refs.append({'ch': int(m.group(1)), 'no': int(m.group(2)),
                             'label': m.group(0)})
            for m in REF_CH.finditer(blob):
                refs.append({'ch': int(m.group(1)), 'no': None, 'label': m.group(0)})
            seen, urefs = set(), []
            for r in refs:
                k = (r['ch'], r['no'])
                if k not in seen:
                    seen.add(k)
                    urefs.append(r)
            fl = cost_flags(sb(f.get('成本', '')))
            mag = magnitude(sb(f.get('收益', '')), sb(f.get('说人话', '')), kj)
            val = value_tier(mag, fl)
            src = sb(f.get('来源', ''))
            items.append({
                'id': '%d-%d' % (no, it['no']),
                'no': it['no'],
                'title': sb(it['title']),
                'cost': sb(f.get('成本', '')),
                'plain': sb(f.get('说人话', '')),
                'benefit': sb(f.get('收益', '')),
                'evidence': ev,
                'evidenceNote': evnote,
                'sources': [x.strip() for x in re.split(r'[；;]\s*(?=[A-Za-z\u4e00-\u9fff（(])', src) if x.strip()],
                'sourceRaw': src,
                'urls': re.findall(r'https?://[^\s，,。；;）)】]+', src),
                'notes': sb(f.get('备注', '')),
                'dispute': dispute,
                'todo': todo,
                'refs': urefs,
                'cj': kj,
                'flags': fl,
                'mag': mag,
                'value': val,
            })
            cev[ev] += 1
            stats_ev[ev] += 1
            stats_val[val] += 1
            n_dispute += dispute
            n_todo += todo
        out_ch.append({
            'no': no,
            'title': sb(blurbs[no]['title']),
            'blurb': blurb,
            'cj': kj,
            'intro': sb(c['intro']),
            'stats': {'n': len(items), 'A': cev['A'], 'B': cev['B'], 'C': cev['C']},
            'items': items,
        })
    return out_ch, stats_ev, stats_val, n_dispute, n_todo


CJ_MAP = [('人身自由', '人身自由'), ('死亡率', '寿命'), ('死因', '寿命'), ('存活', '寿命'),
          ('健康终点', '寿命'), ('时间', '时间精力'), ('精力', '时间精力'),
          ('金钱', '金钱'), ('保障', '金钱'), ('法律责任', '金钱'), ('个人信息', '金钱')]
CJ_DEFAULT = {6: ['金钱', '时间精力'], 10: ['寿命', '金钱', '时间精力']}


def refdata_cj(text):
    m = re.search(r'口径[：:]\s*(.+)$', text)
    seg = m.group(1) if m else text[-24:]
    out = []
    for key, val in CJ_MAP:
        if key in seg and val not in out:
            out.append(val)
    return out