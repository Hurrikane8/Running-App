// Inline-SVG charts. Follows the dataviz method: thin marks, 4px rounded
// data-ends, 2px lines, hairline grid, muted axis ink, tabular-nums ticks,
// hover tooltips with hit targets larger than the mark. Single series per
// chart → no legend (the title names the series). Colors come from the
// validated palette via CSS custom properties (--series-vol, --series-pace).

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

function niceMax(v) {
  if (v <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * pow >= v) return m * pow;
  }
  return 10 * pow;
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

// bars: [{ label, value, sub, current }] — weekly volume
export function barChart(wrap, bars, { unitLabel = 'km' } = {}) {
  wrap.innerHTML = '';
  const W = 600, H = 240, padL = 34, padR = 8, padT = 14, padB = 26;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Weekly ${unitLabel} bar chart` }, wrap);
  const tip = makeTooltip(wrap);

  const max = niceMax(Math.max(...bars.map((b) => b.value), 1) * 1.08);
  const iw = W - padL - padR, ih = H - padT - padB;
  const y = (v) => padT + ih * (1 - v / max);

  // gridlines + ticks (4 divisions)
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    svgEl('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), stroke: 'var(--chart-grid)', 'stroke-width': 1 }, svg);
    svgEl('text', {
      x: padL - 6, y: y(v) + 4, 'text-anchor': 'end', fill: 'var(--ink-3)',
      'font-size': 11, style: 'font-variant-numeric: tabular-nums',
    }, svg).textContent = Math.round(v);
  }
  // baseline
  svgEl('line', { x1: padL, x2: W - padR, y1: y(0), y2: y(0), stroke: 'var(--chart-axis)', 'stroke-width': 1 }, svg);

  const n = bars.length;
  const slot = iw / n;
  const barW = Math.min(26, Math.max(6, slot - 2)); // ≥2px surface gap between bars
  const labelEvery = Math.ceil(n / 8);

  bars.forEach((b, i) => {
    const cx = padL + slot * i + slot / 2;
    const h = Math.max(0, y(0) - y(b.value));
    const bx = cx - barW / 2, by = y(b.value);
    if (h > 0) {
      // rounded top data-end (4px), square baseline anchor
      const r = Math.min(4, h, barW / 2);
      svgEl('path', {
        d: `M ${bx} ${y(0)} V ${by + r} Q ${bx} ${by} ${bx + r} ${by} H ${bx + barW - r} Q ${bx + barW} ${by} ${bx + barW} ${by + r} V ${y(0)} Z`,
        fill: 'var(--series-vol)', opacity: b.current ? 1 : 0.85,
      }, svg);
    }
    if (i % labelEvery === 0) {
      svgEl('text', {
        x: cx, y: H - 8, 'text-anchor': 'middle', fill: 'var(--ink-3)', 'font-size': 11,
      }, svg).textContent = b.label;
    }
    // hover hit target: full slot height
    const hit = svgEl('rect', { x: padL + slot * i, y: padT, width: slot, height: ih, fill: 'transparent' }, svg);
    const show = () => {
      tip.textContent = `${b.sub || b.label}: ${Math.round(b.value * 10) / 10} ${unitLabel}`;
      const rect = wrap.getBoundingClientRect();
      const sx = (cx / W) * rect.width;
      const sy = (by / H) * rect.height;
      tip.style.left = `${sx}px`;
      tip.style.top = `${Math.max(sy, 24)}px`;
      tip.classList.add('show');
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => tip.classList.remove('show'));
  });
}

// points: [{ x: Date-ordinal (ms), label, secPerKm }] — pace trend.
// Y axis inverted so up = faster, labeled in min per unit.
export function paceLineChart(wrap, points, { units = 'km', fmtPaceFn } = {}) {
  wrap.innerHTML = '';
  const W = 600, H = 240, padL = 44, padR = 12, padT = 14, padB = 26;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Pace trend line chart' }, wrap);
  const tip = makeTooltip(wrap);
  if (points.length < 2) return;

  const kmFactor = units === 'mi' ? 1.609344 : 1;
  const vals = points.map((p) => p.secPerKm * kmFactor); // sec per display-unit
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.15, 10);
  lo -= pad; hi += pad;
  const xs = points.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const iw = W - padL - padR, ih = H - padT - padB;
  const X = (x) => padL + (x1 === x0 ? iw / 2 : ((x - x0) / (x1 - x0)) * iw);
  const Y = (spu) => padT + ((spu - lo) / (hi - lo)) * ih; // inverted: faster (smaller) = up

  const fmtTick = (spu) => {
    const m = Math.floor(spu / 60), s = Math.round(spu % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  for (let i = 0; i <= 3; i++) {
    const spu = lo + ((hi - lo) / 3) * i;
    svgEl('line', { x1: padL, x2: W - padR, y1: Y(spu), y2: Y(spu), stroke: 'var(--chart-grid)', 'stroke-width': 1 }, svg);
    svgEl('text', {
      x: padL - 6, y: Y(spu) + 4, 'text-anchor': 'end', fill: 'var(--ink-3)',
      'font-size': 11, style: 'font-variant-numeric: tabular-nums',
    }, svg).textContent = fmtTick(spu);
  }
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${X(p.x).toFixed(1)} ${Y(p.secPerKm * kmFactor).toFixed(1)}`).join(' ');
  svgEl('path', { d, fill: 'none', stroke: 'var(--series-pace)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);

  // markers with 2px surface ring, direct label on the latest point only
  points.forEach((p, i) => {
    const cx = X(p.x), cy = Y(p.secPerKm * kmFactor);
    svgEl('circle', { cx, cy, r: 4, fill: 'var(--series-pace)', stroke: 'var(--chart-surface)', 'stroke-width': 2 }, svg);
    if (i === points.length - 1) {
      svgEl('text', {
        x: Math.min(cx, W - padR - 4), y: Math.max(cy - 10, 12), 'text-anchor': 'end',
        fill: 'var(--ink-2)', 'font-size': 11.5, 'font-weight': 700,
        style: 'font-variant-numeric: tabular-nums',
      }, svg).textContent = fmtTick(p.secPerKm * kmFactor);
    }
    const hit = svgEl('circle', { cx, cy, r: 14, fill: 'transparent' }, svg);
    const show = () => {
      tip.textContent = `${p.label}: ${fmtPaceFn ? fmtPaceFn(p.secPerKm) : fmtTick(p.secPerKm * kmFactor) + ' /' + units}`;
      const rect = wrap.getBoundingClientRect();
      tip.style.left = `${(cx / W) * rect.width}px`;
      tip.style.top = `${Math.max((cy / H) * rect.height, 24)}px`;
      tip.classList.add('show');
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => tip.classList.remove('show'));
  });
}
