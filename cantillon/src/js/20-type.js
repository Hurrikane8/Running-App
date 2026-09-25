/* ==========================================================================
   Kinetic type. Words land on the syllable the narrator says them.
   A block is laid out once; each word springs in at its cue and leaves
   with a wind-up. Blocks live in frame space or ride with the world.
   ========================================================================== */

/*
  spec = {
    x, y,                       anchor (frame space unless world: true)
    world: false,
    align: 'center'|'left',
    lead: 1.0,                  line height multiplier
    lines: [ { size, font?: 'bric'|'fell'|'fellI', weight?, track?, color?, words: [
                 { t: 'WORD', at: seconds, color?, fx?: 'pop'|'drop'|'slam'|'type' } ] } ],
    out: seconds,               when the block starts leaving
    outFx: 'shrink'|'rise'|'fall',
  }
*/
function makeBlock(spec) {
  const b = { ...spec, lines: [] };
  let y = 0;
  for (const ln of spec.lines) {
    const size = ln.size;
    const font =
      ln.font === 'fell' ? fFell(size) : ln.font === 'fellI' ? fFell(size, true) : fBric(size, ln.weight || 800);
    const track = ln.track || 0;
    const space = measure(' ', font) * (ln.spaceK || 1.2) + track * 2;
    const words = ln.words.map((w) => ({ ...w, w: track ? spacedWidth(w.t, font, track) : measure(w.t, font) }));
    const width = words.reduce((s, w) => s + w.w, 0) + space * (words.length - 1);
    let x = spec.align === 'left' ? 0 : -width / 2;
    for (const w of words) {
      w.x = x + w.w / 2;
      x += w.w + space;
    }
    // baseline to baseline: descent of the line above + cap height of this one
    if (b.lines.length) y += (b.lines[b.lines.length - 1].size * 0.3 + size * 0.8) * (spec.lead || 1);
    b.lines.push({ ...ln, font, track, words, y, size, width });
  }
  b.height = y;
  return b;
}

function drawBlock(b, t) {
  const tin = Math.min(...b.lines.flatMap((l) => l.words.map((w) => w.at)));
  if (t < tin - 0.05) return;
  if (b.out !== undefined && t > b.out + 0.9) return;
  ctx.save();
  let ox = b.x;
  let oy = b.y;
  if (b.world) [ox, oy] = w2f(b.x, b.y);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let wi = 0;
  for (const ln of b.lines) {
    for (const w of ln.words) {
      const i = wi++;
      const fx = w.fx || ln.fx || 'pop';
      let k = 0;
      let sx = 1;
      let sy = 1;
      let dy = 0;
      let rot = 0;
      let a = 1;
      const d = t - w.at;
      if (d < 0) continue;
      if (fx === 'pop') {
        k = pop(t, w.at, 0.42, 2.2);
        a = clamp(d / 0.1);
        dy = (1 - E.out3(clamp(d / 0.35))) * 28;
        rot = (1 - k) * -0.08;
        sx = sy = 0.35 + 0.65 * k;
      } else if (fx === 'slam') {
        // arrives big, squashes on impact, settles
        const k1 = E.out4(clamp(d / 0.16));
        const s0 = lerp(2.3, 1, k1);
        const q = wob(t, w.at + 0.16, 3.6, 8) * 0.22;
        sx = s0 * (1 + q);
        sy = s0 * (1 - q);
        a = clamp(d / 0.08);
      } else if (fx === 'drop') {
        const k1 = clamp(d / 0.38);
        dy = -(1 - E.out3(k1)) * 90 * (1 - k1);
        const q = wob(t, w.at + 0.2, 3.4, 8) * 0.18;
        sx = 1 + q;
        sy = 1 - q;
        a = clamp(d / 0.08);
      } else if (fx === 'roll') {
        // rolls up into place as the previous line rolls away
        a = clamp(d / 0.16);
        dy = (1 - E.out3(clamp(d / 0.3))) * 74;
      } else if (fx === 'type') {
        a = clamp(d / 0.25);
        dy = (1 - E.out3(clamp(d / 0.4))) * 16;
      }
      if (b.out !== undefined && t > b.out) {
        const stagger = i * (b.outStagger === undefined ? 0.035 : b.outStagger);
        const o = prog(t, b.out + stagger, b.out + stagger + (b.outDur || 0.34));
        if (b.outFx === 'rise') {
          dy -= E.in3(o) * 80;
          a *= 1 - E.in2(o);
        } else if (b.outFx === 'fall') {
          dy += E.inBack(o, 2) * 120;
          a *= 1 - E.in2(o);
        } else {
          const s = 1 - E.inBack(o, 2.4);
          sx *= Math.max(0, s);
          sy *= Math.max(0, s);
          a *= o < 1 ? 1 : 0;
        }
      }
      if (w.squash) {
        const q = w.squash(t);
        sx *= q[0];
        sy *= q[1];
      }
      if (a <= 0.01 || sx <= 0.01) continue;
      const color = w.color || ln.color || PAL.snow;
      ctx.save();
      ctx.translate(ox + w.x * (b.scale || 1), oy + (ln.y + dy) * (b.scale || 1));
      ctx.rotate(rot);
      ctx.scale(sx * (b.scale || 1), sy * (b.scale || 1));
      ctx.globalAlpha = a * (b.alpha === undefined ? 1 : b.alpha);
      ctx.font = ln.font;
      // soft drop shadow for legibility over busy art
      ctx.fillStyle = 'rgba(5,6,26,0.55)';
      if (ln.track) spaced(w.t, 0, 6, ln.font, ln.track);
      else ctx.fillText(w.t, 0, 6);
      ctx.fillStyle = color;
      if (ln.track) spaced(w.t, 0, 0, ln.font, ln.track);
      else ctx.fillText(w.t, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

/* particle type: glyph outlines sampled into points (world space) */
function textPoints(rows, step = 7) {
  // rows: [{ text, font, y, x=0 }], coordinates relative to (0,0) centre
  const pad = 40;
  let wmax = 0;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const r of rows) {
    wmax = Math.max(wmax, measure(r.text, r.font) + (r.track || 0) * r.text.length);
    ymin = Math.min(ymin, r.y - r.size);
    ymax = Math.max(ymax, r.y + r.size * 0.3);
  }
  const W0 = Math.ceil(wmax + pad * 2);
  const H0 = Math.ceil(ymax - ymin + pad * 2);
  const [c, g] = canvas2(W0, H0);
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  for (const r of rows) {
    g.font = r.font;
    g.textAlign = 'center';
    if (r.track) {
      let w = 0;
      for (const ch of r.text) w += g.measureText(ch).width + r.track;
      w -= r.track;
      let x = W0 / 2 + (r.x || 0) - w / 2;
      g.textAlign = 'left';
      for (const ch of r.text) {
        g.fillText(ch, x, r.y - ymin + pad);
        x += g.measureText(ch).width + r.track;
      }
    } else g.fillText(r.text, W0 / 2 + (r.x || 0), r.y - ymin + pad);
  }
  const data = g.getImageData(0, 0, W0, H0).data;
  const pts = [];
  for (let y = 0; y < H0; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 0; x < W0; x += step) {
      if (data[(y * W0 + (x | 0)) * 4 + 3] > 140) pts.push([x - W0 / 2, y + ymin - pad]);
    }
  }
  // shuffle deterministically so particle order doesn't reveal the scan
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(R(i, 991) * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  return pts;
}
