// Inline-SVG charts. Follows the dataviz method: thin marks, 4px rounded
// data-ends anchored to the baseline, 2px lines, hairline grid, muted axis
// ink, round ("nice") tick values, tabular-nums ticks, hover/tap tooltips
// with hit targets larger than the mark. Single-series charts carry no
// legend (the title names the series); two-series charts render one.
// Colors come from validated CSS custom properties (--series-*, --phase-*).

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

// Round axis: a 1/2/2.5/5 × 10^n step giving ~4 divisions.
export function niceScale(maxVal, divisions = 4) {
  const v = Math.max(maxVal, 1e-9);
  const raw = v / divisions;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  return { step, max: Math.ceil(v / step) * step };
}

function makeTooltip(wrap) {
  let tip = wrap.querySelector('.viz-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'viz-tooltip';
    wrap.appendChild(tip);
  }
  return tip;
}

function showTip(wrap, tip, text, x, y, W, H) {
  tip.textContent = text;
  const rect = wrap.getBoundingClientRect();
  tip.style.left = `${Math.min(Math.max((x / W) * rect.width, 60), rect.width - 60)}px`;
  tip.style.top = `${Math.max((y / H) * rect.height, 24)}px`;
  tip.classList.add('show');
}

// Rounded-top bar path (4px data-end, square baseline anchor)
function barPath(x, y0, w, top) {
  const h = y0 - top;
  if (h <= 0) return null;
  const r = Math.min(4, h, w / 2);
  return `M ${x} ${y0} V ${top + r} Q ${x} ${top} ${x + r} ${top} H ${x + w - r} Q ${x + w} ${top} ${x + w} ${top + r} V ${y0} Z`;
}

function legend(wrap, items) {
  const el = document.createElement('div');
  el.className = 'viz-legend';
  el.innerHTML = items.map(([cls, label]) => `<span><i class="${cls}"></i>${label}</span>`).join('');
  wrap.appendChild(el);
}

// Weekly volume: logged bars, optionally over ghost "planned" bars.
// bars: [{ label, sub, value, planned?, current }]
export function barChart(wrap, bars, { unitLabel = 'km' } = {}) {
  wrap.innerHTML = '';
  const W = 600, H = 230, padL = 34, padR = 8, padT = 12, padB = 26;
  const hasPlan = bars.some((b) => b.planned != null);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Weekly ${unitLabel}${hasPlan ? ', logged vs planned' : ''}` }, wrap);
  const tip = makeTooltip(wrap);
  const { max, step } = niceScale(Math.max(...bars.map((b) => Math.max(b.value, b.planned || 0)), 1));
  const iw = W - padL - padR, ih = H - padT - padB;
  const y = (v) => padT + ih * (1 - v / max);
  for (let v = 0; v <= max + 1e-9; v += step) {
    svgEl('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), stroke: v ? 'var(--chart-grid)' : 'var(--chart-axis)', 'stroke-width': 1 }, svg);
    svgEl('text', { x: padL - 6, y: y(v) + 4, 'text-anchor': 'end', fill: 'var(--ink-3)', 'font-size': 11, style: 'font-variant-numeric: tabular-nums' }, svg)
      .textContent = Math.round(v * 10) / 10;
  }
  const n = bars.length;
  const slot = iw / n;
  const barW = Math.min(26, Math.max(6, slot - 4));
  const labelEvery = Math.ceil(n / 7);
  bars.forEach((b, i) => {
    const cx = padL + slot * i + slot / 2;
    const bx = cx - barW / 2;
    if (b.planned) {
      const d = barPath(bx, y(0), barW, y(b.planned));
      if (d) svgEl('path', { d, fill: 'var(--chart-ghost)' }, svg);
    }
    const inner = hasPlan ? barW - 6 : barW;
    const d = barPath(cx - inner / 2, y(0), inner, y(b.value));
    if (d) svgEl('path', { d, fill: 'var(--series-vol)', opacity: b.current ? 1 : 0.88 }, svg);
    if (i % labelEvery === 0 || b.current) {
      svgEl('text', { x: cx, y: H - 8, 'text-anchor': 'middle', fill: b.current ? 'var(--ink-2)' : 'var(--ink-3)', 'font-size': 11, 'font-weight': b.current ? 700 : 400 }, svg)
        .textContent = b.label;
    }
    const hit = svgEl('rect', { x: padL + slot * i, y: padT, width: slot, height: ih, fill: 'transparent' }, svg);
    const r1 = (v) => Math.round(v * 10) / 10;
    const text = `${b.sub || b.label}: ${r1(b.value)} ${unitLabel}${b.planned ? ` of ${r1(b.planned)} planned` : ''}`;
    const show = () => showTip(wrap, tip, text, cx, Math.min(y(b.value), y(b.planned || 0)), W, H);
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => tip.classList.remove('show'));
  });
  if (hasPlan) legend(wrap, [['lg-vol', 'Logged'], ['lg-ghost', 'Planned']]);
}

// Periodization: one bar per plan week, shaded by phase (an ordinal
// single-hue ramp: base → build → peak darkens; taper neutral), deload
// weeks lighter, the current week outlined, logged km as a tick.
// weeks: [{ label, value, logged?, phase, deload, current, past, onTap }]
export function phaseChart(wrap, weeks, { unitLabel = 'km' } = {}) {
  wrap.innerHTML = '';
  const W = 600, H = 200, padL = 30, padR = 6, padT = 12, padB = 24;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Weekly planned volume by training phase' }, wrap);
  const tip = makeTooltip(wrap);
  const { max, step } = niceScale(Math.max(...weeks.map((w) => Math.max(w.value, w.logged || 0)), 1));
  const iw = W - padL - padR, ih = H - padT - padB;
  const y = (v) => padT + ih * (1 - v / max);
  for (let v = 0; v <= max + 1e-9; v += step) {
    svgEl('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), stroke: v ? 'var(--chart-grid)' : 'var(--chart-axis)', 'stroke-width': 1 }, svg);
    svgEl('text', { x: padL - 5, y: y(v) + 4, 'text-anchor': 'end', fill: 'var(--ink-3)', 'font-size': 10.5, style: 'font-variant-numeric: tabular-nums' }, svg)
      .textContent = Math.round(v);
  }
  const n = weeks.length;
  const slot = iw / n;
  const barW = Math.max(4, Math.min(28, slot - 3));
  const labelEvery = Math.ceil(n / 12);
  weeks.forEach((w, i) => {
    const cx = padL + slot * i + slot / 2;
    const bx = cx - barW / 2;
    const d = barPath(bx, y(0), barW, y(w.value));
    if (d) {
      svgEl('path', { d, fill: `var(--phase-${w.phase})`, opacity: w.deload ? 0.5 : 1 }, svg);
      if (w.current) svgEl('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5 }, svg);
    }
    if (w.logged) {
      svgEl('line', { x1: bx - 1, x2: bx + barW + 1, y1: y(w.logged), y2: y(w.logged), stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
    }
    if (i % labelEvery === 0 || w.current) {
      svgEl('text', { x: cx, y: H - 7, 'text-anchor': 'middle', fill: w.current ? 'var(--accent-text)' : 'var(--ink-3)', 'font-size': 10.5, 'font-weight': w.current ? 700 : 500 }, svg)
        .textContent = w.label;
    }
    const hit = svgEl('rect', { x: padL + slot * i, y: padT, width: slot, height: ih + padB, fill: 'transparent', style: 'cursor:pointer' }, svg);
    const text = `W${i + 1} · ${w.deload ? 'recovery' : w.phase} · ${Math.round(w.value)} ${unitLabel}${w.logged ? ` (logged ${Math.round(w.logged)})` : ''}`;
    const show = () => showTip(wrap, tip, text, cx, y(w.value), W, H);
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerleave', () => tip.classList.remove('show'));
    hit.addEventListener('click', () => { tip.classList.remove('show'); w.onTap?.(); });
  });
  const phases = [...new Set(weeks.map((w) => w.phase))];
  const items = phases.map((p) => [`lg-phase-${p}`, p[0].toUpperCase() + p.slice(1)]);
  if (weeks.some((w) => w.logged)) items.push(['lg-tick', 'Logged']);
  legend(wrap, items);
}

// Line over time with an optional dashed projection continuing the same
// series, and marker dots for evidence points.
// points/projection: [{ x (ms), y, label }]; markers: [{ x, y, label }]
export function lineChart(wrap, points, { projection = [], markers = [], fmtY = (v) => v.toFixed(1), fmtLabel = fmtY, ariaLabel = 'Trend' } = {}) {
  wrap.innerHTML = '';
  const W = 600, H = 210, padL = 36, padR = 14, padT = 16, padB = 26;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': ariaLabel }, wrap);
  const tip = makeTooltip(wrap);
  const all = [...points, ...projection, ...markers];
  if (all.length < 2) return;
  const ys = all.map((p) => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const span = Math.max(hi - lo, 2);
  const stepY = niceScale(span * 1.3, 4).step;
  lo = Math.floor((lo - span * 0.15) / stepY) * stepY;
  hi = Math.ceil((hi + span * 0.15) / stepY) * stepY;
  const xs = all.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const iw = W - padL - padR, ih = H - padT - padB;
  const X = (x) => padL + (x1 === x0 ? iw / 2 : ((x - x0) / (x1 - x0)) * iw);
  const Y = (v) => padT + ih * (1 - (v - lo) / (hi - lo));
  for (let v = lo; v <= hi + 1e-9; v += stepY) {
    svgEl('line', { x1: padL, x2: W - padR, y1: Y(v), y2: Y(v), stroke: 'var(--chart-grid)', 'stroke-width': 1 }, svg);
    svgEl('text', { x: padL - 6, y: Y(v) + 4, 'text-anchor': 'end', fill: 'var(--ink-3)', 'font-size': 11, style: 'font-variant-numeric: tabular-nums' }, svg)
      .textContent = fmtY(v);
  }
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'} ${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  if (points.length > 1) svgEl('path', { d: path(points), fill: 'none', stroke: 'var(--series-pace)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  if (projection.length > 1) svgEl('path', { d: path(projection), fill: 'none', stroke: 'var(--series-pace)', 'stroke-width': 2, 'stroke-dasharray': '5 5', opacity: 0.8 }, svg);
  // x labels: first, last point, end of projection
  const xl = [points[0], points[points.length - 1], projection[projection.length - 1]].filter(Boolean);
  xl.forEach((p, i) => {
    svgEl('text', { x: X(p.x), y: H - 8, 'text-anchor': i === 0 ? 'start' : 'end', fill: 'var(--ink-3)', 'font-size': 11 }, svg)
      .textContent = p.tick || '';
  });
  const hover = [...points, ...projection.slice(1), ...markers.map((m) => ({ ...m, marker: true }))];
  for (const m of markers) {
    svgEl('circle', { cx: X(m.x), cy: Y(m.y), r: 4.5, fill: 'var(--series-pace)', stroke: 'var(--chart-surface)', 'stroke-width': 2 }, svg);
  }
  const last = points[points.length - 1];
  if (last) {
    svgEl('circle', { cx: X(last.x), cy: Y(last.y), r: 5, fill: 'var(--chart-surface)', stroke: 'var(--series-pace)', 'stroke-width': 2.5 }, svg);
    svgEl('text', { x: X(last.x), y: Y(last.y) - 11, 'text-anchor': 'middle', fill: 'var(--ink-2)', 'font-size': 11.5, 'font-weight': 700, style: 'font-variant-numeric: tabular-nums' }, svg)
      .textContent = fmtLabel(last.y);
  }
  const endP = projection[projection.length - 1];
  if (endP) {
    svgEl('text', { x: Math.min(X(endP.x), W - padR), y: Y(endP.y) - 11, 'text-anchor': 'end', fill: 'var(--ink-3)', 'font-size': 11, 'font-weight': 700, style: 'font-variant-numeric: tabular-nums' }, svg)
      .textContent = fmtLabel(endP.y);
  }
  for (const p of hover) {
    const hit = svgEl('circle', { cx: X(p.x), cy: Y(p.y), r: 13, fill: 'transparent' }, svg);
    const show = () => showTip(wrap, tip, p.label, X(p.x), Y(p.y), W, H);
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => tip.classList.remove('show'));
  }
}

// Workout intensity profile: segment width ∝ duration, height ∝ intensity,
// color = run-type identity of the zone. Returns an SVG string (static).
const ZONE_H = { recovery: 0.2, jog: 0.2, easy: 0.32, marathon: 0.55, threshold: 0.7, goalpace: 0.75, interval: 0.86, hill: 0.88, race: 0.9, rep: 1, stride: 0.95 };
const ZONE_C = {
  recovery: 'recovery', jog: 'recovery', easy: 'easy', marathon: 'mpace', goalpace: 'mpace', threshold: 'tempo',
  interval: 'intervals', rep: 'reps', hill: 'hills', stride: 'strides', race: 'race',
};
export function profileSvg(segs, minutesOf, { goalH = 0.75 } = {}) {
  const items = segs.map((s) => ({ ...s, m: Math.max(minutesOf(s), 0.05) }));
  const total = items.reduce((a, s) => a + s.m, 0);
  if (!total) return '';
  const W = 300, H = 46, gap = 1;
  const usable = W - gap * (items.length - 1);
  let x = 0;
  const rects = items.map((s) => {
    const w = Math.max(1.2, (s.m / total) * usable);
    const hh = (s.z === 'goalpace' ? goalH : ZONE_H[s.z] ?? 0.32) * (H - 2);
    const d = barPath(x, H, w, H - hh);
    x += w + gap;
    return `<path d="${d}" fill="var(--wt-${ZONE_C[s.z] || 'easy'})" opacity="${s.z === 'jog' ? 0.55 : 0.92}"/>`;
  }).join('');
  return `<svg class="wk-profile" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;
}
