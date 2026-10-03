/* Contrast audit — paste into browser.evaluate on any rendered route.
 *
 * Why it works the way it does: getImageData() returns a pixel that has already
 * been composited onto whatever was on the canvas, so a translucent colour comes
 * back looking opaque (alpha reads as 1). Reading the alpha out of the CSS string
 * is fragile across rgb() / rgba() / color(srgb …) syntaxes, so instead we paint
 * the colour over black *and* over white and solve for alpha algebraically:
 *
 *   over black  ->  B = c·a
 *   over white  ->  W = c·a + (1-a)·255   =>   a = (W - B) / 255
 *
 * Every translucent ancestor is then composited in layer order, so text sitting
 * on the blurred, 86%-opaque topbar is measured against what it actually looks
 * like rather than against white.
 *
 * Fails anything below WCAG AA (4.5:1, or 3:1 for large text).
 */
(() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });

  const rgba = (c) => {
    if (!c || c === 'transparent') return [0, 0, 0, 0];
    const paint = (bg) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const W = paint('#fff');
    const B = paint('#000');
    const a = W.map((w, i) => (w - B[i]) / 255);
    if (Math.max(...a) < 0.004) return [0, 0, 0, 0];
    const A = Math.max(...a);
    const rgb = B.map((b) => Math.min(255, Math.max(0, b / A)));
    return [...rgb, A];
  };

  const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));

  const lum = ([r, g, b]) => {
    const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const ratio = (a, b) => {
    const l1 = lum(a); const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const bgOf = (n) => {
    const stack = [];
    let base = [255, 255, 255];
    for (let p = n; p; p = p.parentElement) {
      const c = rgba(getComputedStyle(p).backgroundColor);
      if (c[3] >= 0.985) { base = c.slice(0, 3); break; }
      if (c[3] > 0.004) stack.push(c);
      if (p === document.documentElement) {
        const d = rgba(getComputedStyle(p).backgroundColor);
        base = d[3] >= 0.985 ? d.slice(0, 3) : [255, 255, 255];
      }
    }
    let c = base;
    for (let i = stack.length - 1; i >= 0; i--) c = over(stack[i], c);
    return c;
  };

  const out = [];
  for (const n of document.querySelectorAll('body *')) {
    if (n.children.length) continue;
    const txt = (n.textContent || '').trim();
    if (!txt) continue;
    const r = n.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(n);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const cls = typeof n.className === 'string' ? n.className : '';
    if (/sr-only/.test(cls)) continue;           // visually hidden, not read
    if (n.closest('.poster__grid')) continue;    // decorative grid, no text

    const size = parseFloat(cs.fontSize);
    const wt = +cs.fontWeight || 400;
    const need = size >= 24 || (size >= 18.66 && wt >= 700) ? 3 : 4.5;

    const f = rgba(cs.color);
    if (f[3] < 0.004) continue;
    const bg = bgOf(n);
    const r0 = ratio(over(f, bg), bg);
    if (r0 < need) out.push([cls || n.tagName, +r0.toFixed(2), need, size, txt.slice(0, 14)]);
  }
  return out.slice(0, 10).concat([['TOTAL', out.length]]);
})();