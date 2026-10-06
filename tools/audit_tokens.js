/* WCAG contrast check for the colour tokens.
 * Runs in plain Node so it does not need a browser. Composites translucent
 * tokens over their real backdrop before measuring, because a badge's background
 * is ev-*-soft at low alpha and measuring the flat colour would report a number
 * nobody ever sees.
 *
 * Rewritten for the two-hue palette. The evidence scale is no longer three hues:
 * A is the only chromatic grade, B is a dark neutral and C a mid one, so the
 * checks that matter are (a) each badge's text on its own fill, and (b) each
 * neutral step staying distinguishable from the paper it sits on. There are no
 * section washes any more -- every band is --paper -- so the "text on warm/cool"
 * rows are gone rather than repointed at a surface that no longer exists.
 */
const hex = (h) => {
  const s = h.replace('#', '');
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};
const over = (fg, bg) => {
  const a = fg.length > 3 ? fg[3] : 1;
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
};
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/* --mark is color-mix(in srgb, var(--accent) 20%, var(--paper)); resolved here by
 * hand because Node has no color-mix. Kept next to the tokens it mirrors so the
 * two cannot drift apart silently. */
const mix = (a, b, pctA) => [0, 1, 2].map((i) => a[i] * pctA + b[i] * (1 - pctA));

const T = {
  light: {
    paper: hex('#F7F6F2'), paper2: hex('#EFEEE8'), paper3: hex('#E6E4DC'),
    ink: hex('#0B0B0C'), ink2: hex('#3A3A3D'), muted: hex('#63636A'),
    accent: hex('#E4320B'), accentDeep: hex('#BE2A06'), accentInk: hex('#FFFFFF'),
    evA: hex('#1B3FD8'), evAink: hex('#FFFFFF'), evAsoft: [...hex('#1B3FD8'), 0.12],
    evB: hex('#3A3A3D'), evBink: hex('#FFFFFF'), evBsoft: [...hex('#3A3A3D'), 0.12],
    evC: hex('#8E8D87'), evCink: hex('#0B0B0C'), evCsoft: [...hex('#8E8D87'), 0.20],
    wedge: hex('#CBCBCB'),
    link: hex('#1B3FD8'),
    markMix: 0.20,
  },
  dark: {
    paper: hex('#0A0A0B'), paper2: hex('#131316'), paper3: hex('#1C1C20'),
    ink: hex('#F4F3EE'), ink2: hex('#C9C8C1'), muted: hex('#8E8D87'),
    accent: hex('#FF5A2B'), accentDeep: hex('#FF6A3D'), accentInk: hex('#0A0A0B'),
    evA: hex('#7FA4F2'), evAink: hex('#0A0A0B'), evAsoft: [127, 164, 242, 0.18],
    evB: hex('#C9C8C1'), evBink: hex('#0A0A0B'), evBsoft: [201, 200, 193, 0.16],
    evC: hex('#8E8D87'), evCink: hex('#0A0A0B'), evCsoft: [142, 141, 135, 0.18],
    wedge: hex('#2A2A2F'),
    link: hex('#7C9BFF'),
    markMix: 0.26,
  },
};

let fails = 0;
const row = (theme, what, fg, bg, need) => {
  const f = over(fg, bg);
  const r = ratio(f, bg);
  const ok = r >= need;
  if (!ok) fails++;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${theme.padEnd(5)} ${what.padEnd(32)} `
    + `${r.toFixed(2).padStart(6)}:1  (need ${need})`);
};

for (const theme of ['light', 'dark']) {
  const t = T[theme];
  const mark = mix(t.accent, t.paper, t.markMix);
  console.log(`\n=== ${theme} ===`);

  /* grade badges: the letter sits on the solid grade colour */
  row(theme, 'badge A  text on solid', t.evAink, t.evA, 4.5);
  row(theme, 'badge B  text on solid', t.evBink, t.evB, 4.5);
  row(theme, 'badge C  text on solid', t.evCink, t.evC, 4.5);

  /* and on the soft tint used behind inline chips -- ink, because these tints are
     pale enough that white text on them is meaningless (it measured 1.3:1) */
  row(theme, 'badge A  text on soft', t.ink, over(t.evAsoft, t.paper), 4.5);
  row(theme, 'badge B  text on soft', t.ink, over(t.evBsoft, t.paper), 4.5);
  row(theme, 'badge C  text on soft', t.ink, over(t.evCsoft, t.paper), 4.5);

  /* How the three grades stay tellable apart.
     A is a hue and B/C are neutrals, so luminance alone is the wrong test --
     #1B3FD8 and #3A3A3D sit at 1.48:1 on luminance while being obviously
     different colours, and #7FA4F2 against #8E8D87 is 1.35:1 on luminance and
     unmistakably blue against warm grey.
     What matters instead:
       - grade A must be unmistakable against the paper, since it is the one
         carrying the claim. 3:1, non-text contrast.
       - every grade fill must be visible against the paper at all.
       - the segments are separated by a 1px gap in .idx33__bar, so the boundary
         between two low-luminance-difference fills is drawn rather than implied.
     Requiring 3:1 between all three is not satisfiable here at all: on a light
     paper you cannot have three fills that are each 3:1 from the background and
     from each other, which is the real reason the third hue existed. */
  row(theme, 'grade A vs paper (unmistakable)', t.evA, t.paper, 3);
  row(theme, 'grade B vs paper (visible fill)', t.evB, t.paper, 1.35);
  row(theme, 'grade C vs paper (visible fill)', t.evC, t.paper, 1.35);

  /* each grade legible as text on the paper (used for counts and bar labels) */
  for (const [name, surf] of [['paper', t.paper], ['paper-2', t.paper2]]) {
    row(theme, `ink on ${name}`, t.ink, surf, 4.5);
    row(theme, `ink-2 on ${name}`, t.ink2, surf, 4.5);
    row(theme, `muted on ${name}`, t.muted, surf, 4.5);
    row(theme, `ev-a text on ${name}`, t.evA, surf, 4.5);
  }

  /* the drifting band wash peaks at 4% accent over the paper; body text has to
     survive the strongest point of the drift, not just the flat surface */
  row(theme, 'muted on accent-washed paper', t.muted, over([...t.accent, 0.04], t.paper), 4.5);
  row(theme, 'ink on accent-washed paper', t.ink, over([...t.accent, 0.04], t.paper), 4.5);

  /* search-term highlight: ink has to hold on the accent-tinted mark */
  row(theme, 'ink on mark', t.ink, mark, 4.5);
  row(theme, 'ink-2 on mark', t.ink2, mark, 4.5);

  /* rose: fills, not text, but still need to read against the surface */
  row(theme, 'rose A fill vs paper', t.evA, t.paper, 3);
  row(theme, 'rose rest fill vs paper', t.wedge, t.paper, 1.35);

  /* accent and link, used as text */
  row(theme, 'accent-deep text on paper', t.accentDeep, t.paper, 4.5);
  row(theme, 'link text on paper', t.link, t.paper, 4.5);
}

console.log(`\n${fails === 0 ? 'all pass' : fails + ' FAILURES'}`);
process.exit(fails === 0 ? 0 : 1);