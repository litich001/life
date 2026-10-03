"""Shared PDF extraction layer: page lines + geometry-aware table detection."""
import re
import pymupdf

PDF = r'E:\文档\xwechat_files\wxid_a5dytlz0vwuj21_9691\temp\RWTemp\2026-10\9e20f478899dc29eb19741386f9343c8\高性价比人生指南-用最少得钱、时间和精力换回寿命、金钱和自由 github(1).pdf'

PAGE_RE = re.compile(r'^=== PAGE (\d+) ===$')


BO, BC = '\ue000', '\ue001'   # bold on / bold off markers


def load_page_lines(path=PDF, rich=True):
    """Return list (per page) of {'y','x','x1','t'} with header/footer removed.

    With rich=True, bold spans are wrapped in BO/BC private-use markers so the
    renderer can turn lead-ins into <strong>.
    """
    doc = pymupdf.open(path)
    pages = []
    for page in doc:
        h = page.rect.height
        rows = []
        for b in page.get_text('dict')['blocks']:
            if b['type'] != 0:
                continue
            for l in b['lines']:
                x0, y0, x1, _ = l['bbox']
                if y0 < h * 0.055 or y0 > h * 0.945:
                    continue
                parts = []
                for s in l['spans']:
                    txt = s['text']
                    if not txt:
                        continue
                    if rich and (s['flags'] & 16):
                        parts.append(BO + txt + BC)
                    else:
                        parts.append(txt)
                t = ''.join(parts)
                if not t.replace(BO, '').replace(BC, '').strip():
                    continue
                rows.append({'y': round(y0, 1), 'x': round(x0, 1), 'x1': round(x1, 1), 't': t})
        rows.sort(key=lambda r: (r['y'], r['x']))
        pages.append(rows)
    doc.close()
    return pages


def flow_lines(pages, lo=0, hi=None):
    """Reading-order flat line list with page markers, for pages [lo, hi)."""
    out = []
    for i in range(lo, hi if hi is not None else len(pages)):
        out.append('=== PAGE %d ===' % (i + 1))
        out.extend(r['t'] for r in pages[i])
    return out


def cluster_x(rows, tol=8.0):
    """Single-linkage clustering of x starts -> [(lo, hi, [rows])] sorted by x."""
    if not rows:
        return []
    items = sorted(rows, key=lambda r: r['x'])
    groups = [[items[0]]]
    for r in items[1:]:
        if r['x'] - groups[-1][-1]['x'] <= tol:
            groups[-1].append(r)
        else:
            groups.append([r])
    out = []
    for g in groups:
        out.append((g[0]['x'], g[-1]['x'], g))
    return out


def detect_table_regions(rows, min_cols=2, min_count=2, far_x=140.0):
    """Find y-bands that behave like borderless tables.

    Returns list of dicts: {'y0','y1','cols','label_col','data_cols'} where
    cols are (lo,hi) x-ranges and the sub-lists of rows sorted by (y,x).
    """
    if len(rows) < 4:
        return []
    groups = cluster_x(rows)
    # candidate data columns = groups (other than the leftmost) with enough rows
    cand = [g for g in groups[1:] if len(g[2]) >= min_count]
    if len(cand) < min_cols:
        return []
    # a line belongs to a data column if its x falls inside that group range
    def in_data(r):
        for lo, hi, g in cand:
            if lo - 1 <= r['x'] <= hi + 1:
                return True
        return False

    marked = [r for r in rows if in_data(r)]
    if len(marked) < 4:
        return []
    # split into runs where consecutive marked rows are close in y
    runs = [[marked[0]]]
    for r in marked[1:]:
        if r['y'] - runs[-1][-1]['y'] <= 46:
            runs[-1].append(r)
        else:
            runs.append([r])
    regions = []
    for run in runs:
        y0 = run[0]['y']
        y1 = run[-1]['y'] + 8
        cols = [g for g in groups if g[0] <= groups[0][1] + 2 or g[0] > groups[0][1] + 2]
        # keep only columns that have at least one row inside the band
        cols = []
        for lo, hi, g in groups:
            inside = [r for r in g if y0 - 3 <= r['y'] <= y1]
            if inside:
                cols.append({'lo': lo, 'hi': hi, 'rows': inside})
        if len(cols) < min_cols + 1:
            continue
        label = cols[0]
        data = cols[1:]
        if all(len(c['rows']) == 0 for c in data):
            continue
        regions.append({'y0': y0, 'y1': y1, 'cols': cols, 'label': label, 'data': data})
    return regions


def region_to_table(region):
    """Turn a region into {'header': [...], 'rows': [[...]]} using the label column to cut rows."""
    label, data = region['label'], region['data']
    allrows = []
    for c in [label] + data:
        for r in c['rows']:
            allrows.append((r['y'], r['x'], c['lo'], r['t']))
    allrows.sort(key=lambda z: (z[0], z[1]))

    def colof(x):
        best, bd = 0, 1e9
        for i, c in enumerate([label] + data):
            d = 0 if c['lo'] - 1 <= x <= c['hi'] + 1 else min(abs(x - c['lo']), abs(x - c['hi']))
            if d < bd:
                bd, best = d, i
        return best

    cols = [label] + data
    tagged = [(y, colof(x), t) for y, x, lo, t in allrows]

    # Row bands are cut by the label column: a row runs from its label line up to
    # (not including) the next label line, which keeps wrapped cells together.
    lab_y = sorted({round(y, 1) for y, ci, t in tagged if ci == 0})
    if not lab_y:
        return {'header': None, 'rows': []}

    def band_of(y):
        b = 0
        for i, ly in enumerate(lab_y):
            if y >= ly:
                b = i
            else:
                break
        return b

    nb = len(lab_y)
    cells = [[[] for _ in range(nb)] for _ in cols]
    orphan = []
    for y, ci, t in tagged:
        if y < lab_y[0] and ci != 0:
            orphan.append(t)          # header cells sitting above the first label
        else:
            cells[ci][band_of(y)].append(t)

    grid = []
    for b in range(nb):
        row = [''.join(cells[ci][b]) for ci in range(len(cols))]
        while len(row) < len(cols):
            row.append('')
        grid.append(row)

    # Header row: either it sits above the first label (blank stub column), or it
    # occupies exactly one text slot and reads like column names.
    header = None
    if orphan and not cells[0][0]:
        header = [''] + orphan[:len(cols) - 1]
    elif grid:
        first = grid[0]
        joined = ''.join(first)
        ys = [y for y, ci, t in tagged if band_of(y) == 0]
        single_slot = bool(ys) and (max(ys) - min(ys)) <= 8
        if single_slot and len(joined) <= 46 and re.search(
                r'意思|含义|取值|怎么定的|原文说明|物品|序号|主要依据|对应业务类别|如果答案是|等级', joined):
            header = first
            grid = grid[1:]
    return {'header': header, 'rows': grid}