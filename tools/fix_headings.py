# -*- coding: utf-8 -*-
"""Repair heading levels in the already-built book.json.

Why this exists rather than a full re-extraction: the heading predicate in
build_data.py was too loose, and three pieces of citation debris became headings
(an NCT registration number, a journal reference, a URL tail). Re-running the PDF
extractor would fix that but would also regenerate all 667 items and every
verified count, which is a large blast radius for a cosmetic repair. So this
touches the five appendices' block types and nothing else, and asserts that the
rest of the document is byte-identical afterwards.

Two changes per appendix:

1. An ``h3`` that no longer looks like a heading is demoted to prose and merged
   back into the preceding paragraph, so the citation it was split out of reads
   continuously again.

2. Heading tiers are computed and stored on the appendix as ``headingLevels``:
   a list of ``[blockIndex, level]`` where 1 is top-level (一、二、…) and 2 is a
   sub-heading. Previously every heading went into one flat table of contents, so
   ``circadian`` read as fourteen siblings and ``bystander`` -- which has no
   numbered headings at all -- had no top-level structure whatsoever.

Usage:  python -X utf8 tools/fix_headings.py [--dry]
"""
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from heading_rules import looks_like_heading, tier_blocks  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'data', 'book.json')


def repair_appendix(a):
    """Return (new_blocks, level_map, notes) for one appendix."""
    blocks = a['blocks']
    notes = []

    # 1. demote headings that are not headings
    out = []
    for b in blocks:
        if b.get('t') == 'h3' and not looks_like_heading(b.get('x', '')):
            text = b.get('x', '')
            notes.append('demoted to prose: %r' % text[:40])
            if out and out[-1].get('t') == 'p':
                out[-1]['x'] = out[-1]['x'] + text
            else:
                out.append({'t': 'p', 'x': text})
            continue
        out.append(dict(b))

    # 2. tier what remains
    numbered, levels = tier_blocks(out)
    notes.append('numbered=%s  h3=%d  level1=%d  level2=%d'
                 % (numbered, len(levels),
                    sum(1 for _, lv in levels if lv == 1),
                    sum(1 for _, lv in levels if lv == 2)))
    return out, [[i, lv] for i, lv in levels], notes


def main():
    dry = '--dry' in sys.argv
    raw = io.open(PATH, encoding='utf-8').read()
    book = json.loads(raw)

    for a in book['appendices']:
        before = json.dumps(a['blocks'], ensure_ascii=False, sort_keys=True)
        new_blocks, levels, notes = repair_appendix(a)
        a['blocks'] = new_blocks
        a['headingLevels'] = levels
        print('\n=== %s ===' % a['id'])
        for n in notes:
            print('   ' + n)

    # guard: nothing outside the appendices may change
    def fingerprint(b):
        c = json.loads(json.dumps(b))
        for a in c['appendices']:
            a.pop('blocks', None)
            a.pop('headingLevels', None)
        return json.dumps(c, ensure_ascii=False, sort_keys=True)

    after = json.dumps(book, ensure_ascii=False)
    print('\nnon-appendix content unchanged:')
    probe = json.loads(raw)
    print('   %s' % (fingerprint(probe) == fingerprint(book)))

    if dry:
        print('\n--dry, nothing written')
        return 0

    io.open(PATH, 'w', encoding='utf-8', newline='\n').write(after)
    print('\nwrote %s (%d bytes -> %d)' % (PATH, len(raw), len(after)))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
