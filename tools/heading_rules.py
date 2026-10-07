# -*- coding: utf-8 -*-
"""What counts as a heading in the long-form appendices.

Single source of truth, imported by both ``build_data.py`` (which extracts from
the PDF) and ``fix_headings.py`` (which repairs an already-built book.json). It
lives in its own module precisely so those two cannot drift apart -- an earlier
round had the rule inline in the generator and a regex hack in the view, and the
hack was the only thing hiding three pieces of citation debris.

The rule
--------
The original test was "short and not sentence-final". That is far too loose: it
promoted an NCT registration number split across a line break
(``02601060261464874``), a journal reference (``2019.05.012``) and a URL tail
(``1900224.html``) to headings, so three of the five articles had a table of
contents containing garbage. All three are digits and punctuation with no Chinese
in them, so requiring at least one CJK character kills the entire class.

Tier
----
Numbered headings (``一、``..``九、``) are the top level of a piece. An unnumbered
short line inside one is a *sub*-heading and belongs a level below it -- but only
if the piece actually uses numbering. ``bystander`` has no numbered headings at
all, so there every heading is top level. :func:`tier_blocks` applies that.
"""
import re

CJK = re.compile(r'[一-鿿]')
END_PUNCT = '。！？：；」』）】'
NOISE_ONLY = re.compile(r'^[0-9A-Za-z\s\-–—_.:/\\()（）\[\]#%&+*=~^|]+$')
NUMBERED = re.compile(r'^[一二三四五六七八九十]+、')


# Two headings in the current book.json that pass every character test but are
# sentence continuations the PDF's line breaks split off mid-sentence. Recorded by
# hand rather than by rule, because the rule that would catch them reliably is
# boldness -- a real heading in this book is bold and a continuation is not -- and
# build_data.py discards the font information before it tests a line. Each entry
# says what it was cut from, so this list can be deleted the moment the extractor
# starts requiring bold.
#
#   片递给他们   -> "...上面写清家里人的过敏史、慢性病卡" + "片递给他们"
#   毒物，和火场的烟不是一回事 -> "消防产品，...按照国家标准" + "的毒物，和..."
#
# Note the tempting heuristic that does NOT work: requiring the previous block to
# end in sentence punctuation. Block 42 of `kit`,
# "分开买更省钱，也更容易一件件核对认证", is a genuine heading whose predecessor
# is a list item ending in "包" -- no punctuation -- so that rule demotes a real
# heading while keeping both fragments.
CONTINUATION_FRAGMENTS = {
    '片递给他们',
    '毒物，和火场的烟不是一回事',
}


def looks_like_heading(s: str) -> bool:
    """True when a short PDF line is a title rather than debris or prose."""
    s = (s or '').strip()
    if not s or len(s) > 26:
        return False
    if s.endswith(tuple(END_PUNCT)):
        return False
    if s in CONTINUATION_FRAGMENTS:
        return False
    if not CJK.search(s):
        return False
    if NOISE_ONLY.match(s):
        return False
    # more than half non-CJK alphanumerics is a table row or a reference
    solid = sum(1 for c in s if c.isalnum() and not CJK.match(c))
    if solid * 2 > len(s):
        return False
    return True


def is_numbered(s: str) -> bool:
    return bool(NUMBERED.match((s or '').strip()))


def tier_blocks(blocks):
    """Return (cleaned_blocks, layout) for one appendix.

    ``layout`` is a dict: ``'numbered'`` whether the piece uses 一、-style
    numbering at all, and ``'levels'`` a list of ``(block_index, level)`` where
    level 1 is top-level and 2 is a sub-heading. A sub-heading is only level 2
    when it follows a level-1 heading; a run of them at the very top of a piece
    stays level 1, which is what keeps ``bystander`` flat rather than indented
    under nothing.
    """
    numbered = any(b.get('t') == 'h3' and is_numbered(b.get('x', '')) for b in blocks)
    levels = []
    seen_top = False
    for i, b in enumerate(blocks):
        if b.get('t') != 'h3':
            continue
        if not numbered or is_numbered(b.get('x', '')):
            levels.append((i, 1))
            seen_top = True
        elif seen_top:
            levels.append((i, 2))
        else:
            # unnumbered heading before any numbered one: treat as top level
            levels.append((i, 1))
            seen_top = True
    return numbered, levels
