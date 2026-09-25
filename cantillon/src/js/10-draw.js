/* ==========================================================================
   Drawing kit: sprites and parametric props. Light comes from the top-left;
   every prop is flat colour + one shade + one highlight, no outlines.
   ========================================================================== */

const SPR = {};

function buildSprites() {
  for (const k of ['gold', 'goldHi', 'mint', 'coral', 'snow', 'lilac', 'paper', 'amber', 'duskHi', 'wine'])
    makeGlow(k, RGB[k]);
  SPR.coin = spriteCoin();
  SPR.loaf = spriteLoaf();
  SPR.note = spriteNote();
  SPR.bill = spriteBill();
  SPR.grain = spriteGrain();
}

/* ---------- coin ---------- */
function spriteCoin() {
  const R0 = 64;
  const [c, g] = canvas2(R0 * 2 + 24, R0 * 2 + 30);
  const cx = R0 + 12;
  const cy = R0 + 10;
  g.fillStyle = PAL.goldDeep;
  g.beginPath();
  g.arc(cx, cy + 9, R0, 0, TAU);
  g.fill();
  g.fillStyle = PAL.goldLo;
  g.beginPath();
  g.arc(cx, cy + 5, R0, 0, TAU);
  g.fill();
  g.fillStyle = PAL.gold;
  g.beginPath();
  g.arc(cx, cy, R0, 0, TAU);
  g.fill();
  g.strokeStyle = PAL.goldLo;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(cx, cy, R0 * 0.74, 0, TAU);
  g.stroke();
  g.fillStyle = PAL.goldLo;
  g.font = fBric(74, 800);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$', cx, cy + 4);
  g.strokeStyle = PAL.goldHi;
  g.lineCap = 'round';
  g.lineWidth = 8;
  g.beginPath();
  g.arc(cx, cy, R0 * 0.88, Math.PI * 1.1, Math.PI * 1.45);
  g.stroke();
  g.fillStyle = PAL.goldHi;
  g.beginPath();
  g.arc(cx - R0 * 0.5, cy - R0 * 0.62, 5, 0, TAU);
  g.fill();
  return { c, cx, cy, R: R0 };
}
/** coin at (x, y) with radius r. spin: radians about vertical axis. */
function coin(x, y, r, spin = 0, sx = 1, sy = 1, a = 1, rot = 0) {
  if (a <= 0.01 || r <= 0.5) return;
  const S = SPR.coin;
  const k = r / S.R;
  const flat = Math.max(0.1, Math.abs(Math.cos(spin)));
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(k * sx * flat, k * sy);
  ctx.globalAlpha = a;
  ctx.drawImage(S.c, -S.cx, -S.cy);
  ctx.restore();
}

/* ---------- bread ---------- */
function spriteLoaf() {
  const [c, g] = canvas2(260, 140);
  g.translate(130, 76);
  const body = () => {
    g.beginPath();
    g.moveTo(-104, 22);
    g.bezierCurveTo(-122, -6, -96, -52, -40, -56);
    g.bezierCurveTo(10, -60, 70, -58, 102, -30);
    g.bezierCurveTo(126, -8, 116, 24, 96, 30);
    g.bezierCurveTo(40, 40, -60, 42, -104, 22);
    g.closePath();
  };
  g.fillStyle = '#9a4f18';
  g.save();
  g.translate(0, 7);
  body();
  g.fill();
  g.restore();
  g.fillStyle = '#e2963e';
  body();
  g.fill();
  g.save();
  body();
  g.clip();
  g.fillStyle = '#c2702a';
  g.beginPath();
  g.ellipse(10, 44, 150, 38, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#f5bd6b';
  g.beginPath();
  g.ellipse(-20, -48, 90, 22, -0.08, 0, TAU);
  g.fill();
  g.restore();
  g.strokeStyle = '#ffe0a3';
  g.lineCap = 'round';
  g.lineWidth = 9;
  for (let i = 0; i < 3; i++) {
    const x = -52 + i * 48;
    g.beginPath();
    g.moveTo(x - 16, -12);
    g.quadraticCurveTo(x, -34, x + 20, -38);
    g.stroke();
  }
  return { c, cx: 130, cy: 76, w: 260 };
}
/** loaf centred at (x, y), width w. half: draw only the left half (a cut loaf) */
function loaf(x, y, w, rot = 0, a = 1, half = false) {
  if (a <= 0.01 || w <= 1) return;
  const S = SPR.loaf;
  const k = w / 230;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(k, k);
  ctx.globalAlpha = a;
  if (half) {
    ctx.beginPath();
    ctx.rect(-S.cx, -S.cy, S.cx + 4, S.c.height);
    ctx.clip();
  }
  ctx.drawImage(S.c, -S.cx, -S.cy);
  if (half) {
    // the cut face
    ctx.fillStyle = '#fbe3b5';
    ctx.beginPath();
    ctx.ellipse(2, -8, 12, 46, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- 1720 banknote (billet de banque) ---------- */
function spriteNote() {
  const w = 190;
  const h = 104;
  const [c, g] = canvas2(w + 8, h + 12);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(6, 9, w, h);
  g.fillStyle = PAL.paper;
  g.fillRect(2, 2, w, h);
  g.strokeStyle = '#a88a55';
  g.lineWidth = 2.5;
  g.strokeRect(10, 10, w - 16, h - 16);
  g.lineWidth = 1;
  g.strokeRect(15, 15, w - 26, h - 26);
  g.fillStyle = '#6e5431';
  g.textAlign = 'center';
  g.font = fFell(19);
  g.fillText('BILLET DE BANQUE', w / 2 + 2, 38);
  g.font = fFell(26, true);
  g.fillText('Dix livres', w / 2 + 2, 70);
  g.fillStyle = 'rgba(110,84,49,0.5)';
  g.fillRect(40, 82, w - 76, 2);
  g.strokeStyle = '#a4442f';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(w - 26, h - 22, 9, 0, TAU);
  g.stroke();
  return { c, cx: w / 2 + 2, cy: h / 2 + 2, w };
}
/** fluttering note; flip in [0, TAU) fakes a 3D tumble */
function note(x, y, w, rot, flip, a = 1) {
  if (a <= 0.01) return;
  const S = SPR.note;
  const k = w / S.w;
  const fx = Math.cos(flip);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(k * (Math.abs(fx) < 0.08 ? 0.08 : fx), k * (0.82 + 0.18 * Math.cos(flip * 0.7)));
  ctx.globalAlpha = a;
  ctx.drawImage(S.c, -S.cx, -S.cy);
  if (fx < 0) {
    // the back of the note is plainer and shaded
    ctx.fillStyle = 'rgba(160,120,70,0.35)';
    ctx.fillRect(-S.cx + 2, -S.cy + 2, S.w, S.c.height - 12);
  }
  ctx.restore();
}

/* ---------- the hero banknote ---------- */
const BILL_W = 600;
const BILL_H = 284;
function spriteBill() {
  const k = 2;
  const [c, g] = canvas2((BILL_W + 20) * k, (BILL_H + 28) * k);
  g.scale(k, k);
  g.translate(10, 8);
  const rr = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  // body + thickness
  g.fillStyle = '#1d7a5c';
  rr(0, 8, BILL_W, BILL_H, 22);
  g.fill();
  g.fillStyle = '#5fd4a4';
  rr(0, 0, BILL_W, BILL_H, 22);
  g.fill();
  // guilloche waves
  g.save();
  rr(0, 0, BILL_W, BILL_H, 22);
  g.clip();
  g.strokeStyle = 'rgba(255,255,255,0.20)';
  g.lineWidth = 1.6;
  for (let j = 0; j < 9; j++) {
    g.beginPath();
    for (let x = 0; x <= BILL_W; x += 6) {
      const y = 40 + j * 26 + Math.sin(x / 38 + j * 0.9) * 10 + Math.sin(x / 13 + j) * 2.5;
      if (x) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  }
  g.fillStyle = 'rgba(8,70,50,0.18)';
  g.beginPath();
  g.ellipse(BILL_W * 0.78, BILL_H * 1.05, 260, 120, 0, 0, TAU);
  g.fill();
  g.restore();
  // frame
  g.strokeStyle = '#1f8a66';
  g.lineWidth = 4;
  rr(16, 16, BILL_W - 32, BILL_H - 32, 14);
  g.stroke();
  g.lineWidth = 1.5;
  rr(24, 24, BILL_W - 48, BILL_H - 48, 10);
  g.stroke();
  // medallion
  g.fillStyle = '#8fe5c2';
  g.beginPath();
  g.ellipse(BILL_W / 2, BILL_H / 2, 74, 92, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#1f8a66';
  g.lineWidth = 4;
  g.stroke();
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(BILL_W / 2, BILL_H / 2, 62, 80, 0, 0, TAU);
  g.stroke();
  g.fillStyle = '#1f8a66';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = fBric(104, 800);
  g.fillText('$', BILL_W / 2, BILL_H / 2 + 6);
  // denominations
  g.font = fBric(46, 800);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillText('100', 42, 84);
  g.textAlign = 'right';
  g.fillText('100', BILL_W - 42, BILL_H - 42);
  g.font = fBric(18, 700);
  g.textAlign = 'right';
  g.fillText('ONE HUNDRED', BILL_W - 44, 70);
  g.textAlign = 'left';
  g.fillText('YOUR SAVINGS', 44, BILL_H - 46);
  // serial
  g.font = fBric(15, 600);
  g.fillStyle = 'rgba(31,138,102,0.8)';
  g.fillText('N° 000001', 44, BILL_H - 76);
  // top-left sheen
  g.fillStyle = 'rgba(255,255,255,0.22)';
  rr(10, 8, BILL_W * 0.46, 10, 5);
  g.fill();
  return { c, k, ox: 10, oy: 8 };
}
/** the savings banknote centred at (x, y) */
function bill(x, y, s, sx = 1, sy = 1, rot = 0, a = 1) {
  if (a <= 0.01 || s <= 0.01) return;
  const S = SPR.bill;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s * sx, s * sy);
  ctx.globalAlpha = a;
  ctx.drawImage(S.c, -BILL_W / 2 - S.ox, -BILL_H / 2 - S.oy, S.c.width / S.k, S.c.height / S.k);
  ctx.restore();
}

/* ---------- film grain ---------- */
function spriteGrain() {
  const [c, g] = canvas2(256, 256);
  const img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const v = R(i, 77) * 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* ---------- sparkle ---------- */
function sparkle(x, y, r, rot, color = 'goldHi', a = 1, glowName = 'gold') {
  if (a <= 0.01 || r <= 0.2) return;
  glow(glowName, x, y, r * 3.2, a * 0.55);
  ctx.globalAlpha = a;
  ctx.fillStyle = PAL[color];
  starPath(x, y, r, rot);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ---------- characters ---------- */
/*
  Blob people: a gumdrop body, big eyes, tiny limbs.
  p = { x, y (feet), s, sx, sy, rot, c: [main, shade, hi], look: [dx, dy], blink,
        mood: 'smile'|'grin'|'flat'|'sad'|'o'|'joy', armL, armR (radians, 0 = down),
        walk (phase), acc: {wig, tricorn, jabot, tie, apron, hardhat, crown}, a }
*/
const BODY_W = 136;
const BODY_H = 200;
function bodyPath(w = BODY_W, h = BODY_H) {
  const r = w / 2;
  const br = 26;
  ctx.beginPath();
  ctx.moveTo(-r, -h + r);
  ctx.arc(0, -h + r, r, Math.PI, 0);
  ctx.lineTo(r, -br);
  ctx.quadraticCurveTo(r, 0, r - br, 0);
  ctx.lineTo(-r + br, 0);
  ctx.quadraticCurveTo(-r, 0, -r, -br);
  ctx.closePath();
}
function person(p) {
  const a = p.a === undefined ? 1 : p.a;
  if (a <= 0.01 || p.s <= 0.01) return;
  const [cMain, cShade, cHi] = p.c;
  const acc = p.acc || {};
  const look = p.look || [0, 0];
  const walk = p.walk || 0;
  ctx.save();
  ctx.globalAlpha = a;
  // ground shadow (not squashed)
  ctx.fillStyle = 'rgba(4,5,20,0.35)';
  ellipse(p.x, p.y + 2, 70 * p.s * (p.sx || 1), 12 * p.s, 0);
  ctx.fill();
  ctx.translate(p.x, p.y);
  if (p.rot) ctx.rotate(p.rot);
  ctx.scale(p.s * (p.sx || 1), p.s * (p.sy || 1));

  // feet
  ctx.fillStyle = cShade;
  const fb = walk ? Math.sin(walk) * 10 : 0;
  ellipse(-30, -4 - Math.max(0, fb), 26, 13);
  ctx.fill();
  ellipse(30, -4 - Math.max(0, -fb), 26, 13);
  ctx.fill();

  // arms behind body when hanging
  const arm = (side, ang, len = 58) => {
    const sx0 = side * 60;
    const sy0 = -92;
    const ex = sx0 + Math.sin(ang) * len * side;
    const ey = sy0 + Math.cos(ang) * len;
    ctx.strokeStyle = cShade;
    ctx.lineCap = 'round';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = cMain;
    circle(ex, ey, 12);
    ctx.fill();
    return [ex, ey];
  };
  const hands = {};
  hands.l = arm(-1, p.armL || 0.25);
  hands.r = arm(1, p.armR || 0.25);

  // body
  ctx.fillStyle = cMain;
  bodyPath();
  ctx.fill();
  ctx.save();
  bodyPath();
  ctx.clip();
  ctx.fillStyle = cShade;
  ellipse(92, -60, 80, 190, 0.1);
  ctx.fill();
  ctx.fillStyle = cHi;
  ctx.globalAlpha = a * 0.55;
  ellipse(-36, -168, 22, 12, -0.5);
  ctx.fill();
  ctx.globalAlpha = a;
  if (acc.apron) {
    ctx.fillStyle = PAL.snow;
    rrect(-42, -78, 84, 80, 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(-42, -40, 84, 3);
  }
  if (acc.coat) {
    ctx.fillStyle = acc.coat;
    ctx.beginPath();
    ctx.moveTo(-70, -96);
    ctx.lineTo(-14, -96);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-70, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(70, -96);
    ctx.lineTo(14, -96);
    ctx.lineTo(6, 0);
    ctx.lineTo(70, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  if (acc.jabot) {
    ctx.fillStyle = PAL.snow;
    for (let i = 0; i < 3; i++) {
      ellipse(0, -86 + i * 13, 17 - i * 3, 9, 0);
      ctx.fill();
    }
    ctx.fillStyle = PAL.gold;
    circle(0, -34, 5);
    ctx.fill();
    circle(0, -16, 5);
    ctx.fill();
  }
  if (acc.tie) {
    ctx.fillStyle = PAL.snow;
    poly([-20, -96, 20, -96, 0, -76]);
    ctx.fill();
    ctx.fillStyle = acc.tie;
    poly([-7, -90, 7, -90, 11, -40, 0, -28, -11, -40]);
    ctx.fill();
  }

  // eyes
  const blink = p.blink || 0;
  const ey = -132;
  for (const s of [-1, 1]) {
    const ex = s * 27;
    if (p.mood === 'joy') {
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, ey + 6, 12, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = PAL.snow;
    ellipse(ex, ey, 16, 19 * (1 - blink * 0.92));
    ctx.fill();
    if (blink < 0.7) {
      ctx.fillStyle = PAL.ink;
      circle(ex + look[0] * 6, ey + 2 + look[1] * 6, 8.5 * (1 - blink));
      ctx.fill();
      ctx.fillStyle = PAL.snow;
      circle(ex + look[0] * 6 - 3, ey - 2 + look[1] * 6, 2.6);
      ctx.fill();
    }
  }
  if (p.brow) {
    // worried / determined brows
    ctx.strokeStyle = cShade;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 14, -160 - p.brow * s * 0);
      ctx.lineTo(s * 38, -160 + p.brow * 7);
      ctx.stroke();
    }
  }
  // mouth
  ctx.strokeStyle = PAL.ink;
  ctx.fillStyle = PAL.ink;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const my = -100;
  switch (p.mood) {
    case 'grin':
    case 'joy':
      ctx.beginPath();
      ctx.moveTo(-16, my - 4);
      ctx.quadraticCurveTo(0, my + 18, 16, my - 4);
      ctx.closePath();
      ctx.fill();
      break;
    case 'sad':
      ctx.beginPath();
      ctx.arc(0, my + 14, 12, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      break;
    case 'o':
      ellipse(0, my + 2, 8, 10);
      ctx.fill();
      break;
    case 'flat':
      ctx.beginPath();
      ctx.moveTo(-10, my);
      ctx.lineTo(10, my);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.arc(0, my - 8, 12, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
  }
  if (p.mood === 'joy' || p.mood === 'grin') {
    ctx.fillStyle = 'rgba(255,120,150,0.35)';
    ellipse(-44, -106, 12, 7);
    ctx.fill();
    ellipse(44, -106, 12, 7);
    ctx.fill();
  }
  if (p.sweat) {
    ctx.fillStyle = 'rgba(190,235,255,0.9)';
    const sy = -170 + p.sweat * 30;
    ctx.beginPath();
    ctx.moveTo(62, sy - 14);
    ctx.quadraticCurveTo(72, sy, 62, sy + 6);
    ctx.quadraticCurveTo(52, sy, 62, sy - 14);
    ctx.fill();
  }

  // headwear
  if (acc.wig) {
    ctx.fillStyle = '#f3efe6';
    for (const s of [-1, 1]) {
      circle(s * 64, -150, 19);
      ctx.fill();
      circle(s * 66, -118, 17);
      ctx.fill();
    }
    ctx.fillStyle = '#d8d2c4';
    for (const s of [-1, 1]) {
      circle(s * 70, -120, 8);
      ctx.fill();
    }
    ctx.fillStyle = '#f3efe6';
    ctx.beginPath();
    ctx.arc(0, -BODY_H + BODY_W / 2, BODY_W / 2 + 4, Math.PI * 1.06, Math.PI * 1.94);
    ctx.lineTo(56, -168);
    ctx.quadraticCurveTo(0, -186, -56, -168);
    ctx.closePath();
    ctx.fill();
  }
  if (acc.tricorn) {
    ctx.save();
    ctx.translate(0, -196);
    ctx.fillStyle = '#1b1936';
    ctx.beginPath();
    ctx.moveTo(-96, 6);
    ctx.quadraticCurveTo(-60, -60, 0, -58);
    ctx.quadraticCurveTo(60, -60, 96, 6);
    ctx.quadraticCurveTo(0, -18, -96, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-92, 2);
    ctx.quadraticCurveTo(0, -20, 92, 2);
    ctx.stroke();
    ctx.restore();
  }
  if (acc.hardhat) {
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.arc(0, -178, 56, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    rrect(-72, -184, 144, 14, 7);
    ctx.fill();
    ctx.fillStyle = PAL.goldHi;
    rrect(-8, -232, 16, 50, 6);
    ctx.fill();
  }
  if (acc.crown) {
    const k = acc.crown;
    ctx.save();
    ctx.translate(0, -206);
    ctx.scale(k, k);
    ctx.fillStyle = PAL.gold;
    poly([-40, 12, -44, -26, -20, -6, 0, -34, 20, -6, 44, -26, 40, 12]);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // hands in world space so callers can attach props
  const k = p.s;
  const tx = (h) => [p.x + h[0] * k * (p.sx || 1), p.y + h[1] * k * (p.sy || 1)];
  return { l: tx(hands.l), r: tx(hands.r), head: [p.x, p.y - 150 * k * (p.sy || 1)] };
}

/* ---------- platform (a floating ledge) ---------- */
function ledge(x0, x1, y, depth = 44, a = 1, tint = 0, taper = 64) {
  if (a <= 0.01 || x1 - x0 < 2) return;
  ctx.save();
  ctx.globalAlpha = a;
  const w = x1 - x0;
  const r = Math.min(18, w / 2);
  if (taper > 1) {
    // a tapered chunk of rock underneath, so each ledge floats like an island
    ctx.fillStyle = mix('night2', 'coralLo', tint * 0.2);
    ctx.beginPath();
    ctx.moveTo(x0 + 14, y + depth - 8);
    ctx.lineTo(x1 - 14, y + depth - 8);
    ctx.lineTo(x1 - w * 0.2, y + depth + taper * 0.55);
    ctx.lineTo(x0 + w * 0.58, y + depth + taper);
    ctx.lineTo(x0 + w * 0.34, y + depth + taper * 0.62);
    ctx.lineTo(x0 + w * 0.12, y + depth + taper * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(RGB.dusk, 0.5);
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.58, y + depth + taper);
    ctx.lineTo(x1 - w * 0.2, y + depth + taper * 0.55);
    ctx.lineTo(x1 - 14, y + depth - 8);
    ctx.lineTo(x0 + w * 0.62, y + depth - 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = mix('dusk', 'coralLo', tint * 0.35);
  rrect(x0, y, x1 - x0, depth, r);
  ctx.fill();
  ctx.fillStyle = mix('duskHi', 'coral', tint * 0.3);
  rrect(x0, y, x1 - x0, 14, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(4,5,22,0.35)';
  rrect(x0 + 10, y + depth - 10, x1 - x0 - 20, 10, 5);
  ctx.fill();
  ctx.restore();
}

/* ---------- basket ---------- */
function basket(x, y, s, a = 1) {
  if (a <= 0.01 || s <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#8a5a34';
  ctx.beginPath();
  ctx.moveTo(-86, -66);
  ctx.lineTo(86, -66);
  ctx.lineTo(68, 0);
  ctx.lineTo(-68, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#b07a48';
  ctx.lineWidth = 5;
  for (let i = 0; i < 3; i++) {
    const yy = -52 + i * 18;
    ctx.beginPath();
    ctx.moveTo(-82 + i * 5, yy);
    ctx.lineTo(82 - i * 5, yy);
    ctx.stroke();
  }
  ctx.fillStyle = '#c28d56';
  rrect(-94, -76, 188, 16, 8);
  ctx.fill();
  ctx.restore();
}
