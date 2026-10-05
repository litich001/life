/* WCAG contrast check for the colour tokens introduced this round.
 * Runs in plain Node so it does not need a browser. Composites translucent
 * tokens over their real backdrop before measuring, the same way the in-page
 * audit does, because a badge's background is ev-b-soft at 18% alpha and
 * measuring the flat colour would report a number nobody ever sees.
 */
const hex = (h) => {
  const s = h.replace('#', '');
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};
const rgb = (c) => `rgb(${c.join(', ')})`;
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

const T = {
  light: {
    paper: hex('#F7F6F2'), paper2: hex('#F2F1EC'),
    warm: hex('#F1EEE7'), cool: hex('#EEF1F5'),
    ink: hex('#14140F'), ink2: hex('#4A4A52'), muted: hex('#63636A'),
    evA: hex('#1B3FD8'), evAink: hex('#FFFFFF'),
    evAsoft: [...hex('#1B3FD8'), 0.12],
    evB: hex('#8A4B00'), evBink: hex('#FFFFFF'),
    evBsoft: [196, 122, 12, 0.18],
    evC: hex('#6B5B95'), evCink: hex('#FFFFFF'),
    evCsoft: [107, 91, 149, 0.12],
    wedge: hex('#D6D0C0'),
    g: ['#C2370B', '#8A4B00', '#1F6B4A', '#1B3FD8', '#6B5B95'],
    accentDeep: hex('#BE2A06'),
  },
  dark: {
    paper: hex('#0A0A0B'), paper2: hex('#131316'),
    warm: hex('#131211'), cool: hex('#11131A'),
    ink: hex('#F4F3EE'), ink2: hex('#C9C8C1'), muted: hex('#8E8D87'),
    evA: hex('#7FA4F2'), evAink: hex('#0A0A0B'),
    evAsoft: [127, 164, 242, 0.18],
    evB: hex('#E0A14A'), evBink: hex('#17110A'),
    evBsoft: [224, 161, 74, 0.18],
    evC: hex('#B0A0D6'), evCink: hex('#100E18'),
    evCsoft: [176, 160, 214, 0.16],
    wedge: hex('#2A2A2F'),
    g: ['#FF8A5E', '#E0A14A', '#4FB88A', '#7FA4F2', '#B0A0D6'],
    accentDeep: hex('#FF6A3D'),
  },
};

// group hues now come from the theme's own token set

let fails = 0;
const row = (theme, what, fg, bg, need, fgIsText) => {
  const f = over(fg, bg);
  const r = ratio(f, bg);
  const ok = r >= need;
  if (!ok) fails++;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${theme.padEnd(5)} ${what.padEnd(34)} `
    + `${r.toFixed(2).padStart(6)}:1  (need ${need})`);
};

for (const theme of ['light', 'dark']) {
  const t = T[theme];
  console.log(`\n=== ${theme} ===`);

  // grade badges: solid A, tinted B and C, white/ink text on top
  row(theme, 'badge A  text on solid', t.evAink, t.evA, 4.5, true);
  row(theme, 'badge B  text on tinted', t.evB, over(t.evBsoft, t.paper), 4.5, true);
  row(theme, 'badge C  text on tinted', t.evC, over(t.evCsoft, t.paper), 4.5, true);

  // the same hues used as plain text on the paper and on both washes
  for (const [name, surf] of [['paper', t.paper], ['warm', t.warm], ['cool', t.cool]]) {
    row(theme, `ev-a text on ${name}`, t.evA, surf, 4.5, true);
    row(theme, `ev-b text on ${name}`, t.evB, surf, 4.5, true);
    row(theme, `ev-c text on ${name}`, t.evC, surf, 4.5, true);
  }

  // body text on the washes -- the tints must not cost any contrast
  for (const [name, surf] of [['warm', t.warm], ['cool', t.cool]]) {
    row(theme, `ink on ${name}`, t.ink, surf, 4.5, true);
    row(theme, `ink-2 on ${name}`, t.ink2, surf, 4.5, true);
    row(theme, `muted on ${name}`, t.muted, surf, 4.5, true);
  }

  // rose: blue wedges and B/C remainder are fills, not text, but they still need
  // to be distinguishable from the surface
  row(theme, 'rose A fill vs paper', t.evA, t.paper, 3, false);
  row(theme, 'rose rest fill vs paper', t.wedge, t.paper, 1.35, false);

  // situation group dots: aria-hidden decoration, so 3:1 is a courtesy bar
  for (const g of t.g) row(theme, 'group dot ' + g, hex(g), t.paper, 3, false);
}

console.log(`\n${fails === 0 ? 'all pass' : fails + ' FAILURES'}`);
process.exit(fails === 0 ? 0 : 1);
