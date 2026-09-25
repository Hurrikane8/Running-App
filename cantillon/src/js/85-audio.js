/* ==========================================================================
   Sound: the embedded narration, a quiet procedural score that ducks under
   the voice, and small synthesized effects on the same cues as the picture.
   Everything is scheduled on the AudioContext clock, which also drives the
   animation, so picture and sound cannot drift apart.
   ========================================================================== */

const AUD = { ctx: null, buf: null, noise: null, ir: null, sess: null, t0: 0, muted: false, decoding: null, timer: 0 };
const EV = []; // timeline events: { t, fn(when, sess) } for score + effects
const DUCK = []; // [t, level] for the music bus

/** shared noise, a synthetic hall and the master bus for context c */
function audioGraph(c) {
  const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = R(i, 555) * 2 - 1;
  AUD.noise = nb;
  const len = Math.floor(c.sampleRate * 2.6);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const n = R(i, 700 + ch) * 2 - 1;
      lp += (n - lp) * lerp(0.9, 0.18, i / len);
      d[i] = lp * Math.pow(1 - i / len, 2.4) * 0.5;
    }
  }
  AUD.ir = ir;
  AUD.master = c.createGain();
  AUD.master.gain.value = 0.85;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 10;
  comp.ratio.value = 3;
  comp.attack.value = 0.004;
  comp.release.value = 0.25;
  AUD.master.connect(comp).connect(c.destination);
}
function audioCtx() {
  if (!AUD.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    AUD.ctx = new AC();
    audioGraph(AUD.ctx);
  }
  return AUD.ctx;
}
function narrationBytes() {
  const bin = atob(document.getElementById('narration').textContent.trim());
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}
function decodeOn(c) {
  return new Promise((res, rej) => {
    const p = c.decodeAudioData(narrationBytes(), res, rej);
    if (p && p.then) p.then(res, rej);
  });
}
/** a fresh set of buses for one playback */
function makeSession(c) {
  const sess = {
    voice: c.createGain(),
    music: c.createGain(),
    sfx: c.createGain(),
    verb: c.createConvolver(),
    verbIn: c.createGain(),
  };
  sess.verb.buffer = AUD.ir;
  sess.verbIn.connect(sess.verb).connect(AUD.master);
  sess.voice.connect(AUD.master);
  sess.music.connect(AUD.master);
  sess.sfx.connect(AUD.master);
  sess.verbIn.gain.value = 0.5;
  sess.music.gain.value = OPT.music ? 0.8 : 0;
  sess.sfx.gain.value = OPT.sfx ? 0.85 : 0;
  sess.voice.gain.value = OPT.voice ? 1 : 0;
  return sess;
}
function scheduleDucking(sess, t0, from) {
  const g = sess.music.gain;
  const base = OPT.music ? 0.8 : 0;
  g.setValueAtTime(base, t0 + from);
  for (const [t, lv] of DUCK) if (t > from) g.setTargetAtTime(base * lv, t0 + t, 0.08);
}
/** render the whole soundtrack offline (tooling: window.__audio) */
async function audioRenderOffline(rate = 48000) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const c = new OAC(2, Math.ceil(rate * DUR), rate);
  const saved = { ctx: AUD.ctx, noise: AUD.noise, ir: AUD.ir, master: AUD.master };
  AUD.ctx = c;
  audioGraph(c);
  const buf = await decodeOn(c);
  const sess = makeSession(c);
  const v = c.createBufferSource();
  v.buffer = buf;
  v.connect(sess.voice);
  v.start(0);
  scheduleDucking(sess, 0, 0);
  for (const e of EV) e.fn(Math.max(0, e.t), sess);
  const out = await c.startRendering();
  Object.assign(AUD, saved);
  return out;
}
/** decode the narration while the viewer is still looking at the poster */
function audioPrepare() {
  const c = audioCtx();
  if (!c || AUD.decoding) return AUD.decoding;
  AUD.decoding = decodeOn(c).then((b) => (AUD.buf = b));
  return AUD.decoding;
}
/** a tiny silent WAV, looped by an <audio> element (see audioUnlock) */
function silentWav() {
  const n = 4000;
  const b = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, s) => [...s].forEach((ch, i) => b.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF');
  b.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVEfmt ');
  b.setUint32(16, 16, true);
  b.setUint16(20, 1, true);
  b.setUint16(22, 1, true);
  b.setUint32(24, 8000, true);
  b.setUint32(28, 16000, true);
  b.setUint16(32, 2, true);
  b.setUint16(34, 16, true);
  w(36, 'data');
  b.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' }));
}
/** call synchronously inside a user gesture (iOS needs this) */
function audioUnlock() {
  const c = audioCtx();
  if (!c) return;
  // iPhones mute Web Audio when the ring/silent switch is on. Ask for a
  // playback session (Safari 16.4+); older iOS gets the same effect from a
  // looping silent <audio> element.
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    else if (!AUD.keep && (/iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1))) {
      AUD.keep = new Audio(silentWav());
      AUD.keep.loop = true;
      AUD.keep.setAttribute('playsinline', '');
      AUD.keep.play().catch(() => {});
    }
  } catch (e) {
    /* best effort */
  }
  if (c.state !== 'running') c.resume();
  const s = c.createBufferSource();
  s.buffer = c.createBuffer(1, 1, c.sampleRate);
  s.connect(c.destination);
  s.start(0);
}
function audioClock() {
  const c = AUD.ctx;
  if (c.getOutputTimestamp) {
    const ts = c.getOutputTimestamp();
    if (ts.contextTime > 0 && ts.performanceTime > 0) {
      return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
  }
  return c.currentTime - (c.outputLatency || 0);
}
async function audioStart(from) {
  const c = audioCtx();
  if (!c) return false;
  if (c.state !== 'running') await Promise.race([c.resume(), new Promise((r) => setTimeout(r, 400))]);
  if (c.state !== 'running') return false;
  await audioPrepare();
  if (!AUD.buf) return false;
  audioStop();
  const sess = makeSession(c);
  AUD.master.gain.value = AUD.muted ? 0 : 0.85;
  const when = c.currentTime + 0.1;
  AUD.t0 = when - from;
  const v = c.createBufferSource();
  v.buffer = AUD.buf;
  v.connect(sess.voice);
  v.start(when, Math.min(from, AUD.buf.duration - 0.01));
  sess.src = v;
  // music ducks under the narrator
  scheduleDucking(sess, AUD.t0, from);
  AUD.sess = sess;
  // lookahead scheduler for the score and effects
  let i = 0;
  while (i < EV.length && EV[i].t < from - 0.02) i++;
  const tick = () => {
    if (AUD.sess !== sess) return;
    const horizon = c.currentTime - AUD.t0 + 1.2;
    while (i < EV.length && EV[i].t < horizon) {
      const e = EV[i++];
      const at = AUD.t0 + e.t;
      if (at >= c.currentTime - 0.02) e.fn(Math.max(at, c.currentTime), sess);
    }
  };
  tick();
  AUD.timer = setInterval(tick, 120);
  return true;
}
function audioStop(fade) {
  const s = AUD.sess;
  if (!s) return;
  clearInterval(AUD.timer);
  AUD.sess = null;
  const c = AUD.ctx;
  const bye = () => {
    for (const k of ['voice', 'music', 'sfx', 'verbIn']) s[k].disconnect();
    try {
      s.src.stop();
    } catch (e) {
      /* already stopped */
    }
  };
  if (fade) {
    for (const k of ['music', 'sfx', 'verbIn']) s[k].gain.setTargetAtTime(0, c.currentTime, 0.4);
    setTimeout(bye, 2500);
  } else bye();
}
function audioToggleMute() {
  AUD.muted = !AUD.muted;
  if (AUD.master) AUD.master.gain.setTargetAtTime(AUD.muted ? 0 : 0.85, AUD.ctx.currentTime, 0.03);
}

/* ---------- synth kit ---------- */
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function vca(c, at, a, peak, d, dest) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + a);
  g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
  g.connect(dest);
  return g;
}
function tone(c, type, f, at, dur, dest) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  o.connect(dest);
  o.start(at);
  o.stop(at + dur + 0.05);
  return o;
}
function noise(c, at, dur, dest) {
  const n = c.createBufferSource();
  n.buffer = AUD.noise;
  n.connect(dest);
  n.start(at, R(Math.floor(at * 1000), 3) * 1.4, dur + 0.05);
  return n;
}
function filt(c, type, f, q, dest) {
  const b = c.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.connect(dest);
  return b;
}
/* effects: each takes (when, session, opts) */
const FX = {
  pop(at, S, o = {}) {
    const c = AUD.ctx;
    const p = o.pitch || 1;
    const g = vca(c, at, 0.004, 0.32 * (o.vol || 1), 0.13, S.sfx);
    const osc = tone(c, 'sine', 560 * p, at, 0.16, g);
    osc.frequency.exponentialRampToValueAtTime(190 * p, at + 0.1);
  },
  clink(at, S, o = {}) {
    const c = AUD.ctx;
    const p = o.pitch || 1;
    const v = 0.1 * (o.vol || 1);
    [2400, 3710, 5230].forEach((f, k) => {
      const g = vca(c, at, 0.002, v / (k + 1), [0.28, 0.2, 0.12][k], S.sfx);
      tone(c, 'sine', f * p * (1 + (R(Math.floor(at * 997), k) - 0.5) * 0.04), at, 0.35, g);
    });
    const g2 = vca(c, at, 0.001, v * 0.8, 0.02, S.sfx);
    noise(c, at, 0.03, filt(c, 'highpass', 5000, 0.7, g2));
    if (o.verb) vca(c, at, 0.002, v * 0.5, 0.2, S.verbIn);
  },
  whoosh(at, S, o = {}) {
    const c = AUD.ctx;
    const d = o.dur || 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.16 * (o.vol || 1), at + d * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, at + d);
    g.connect(S.sfx);
    const bp = filt(c, 'bandpass', 400, 1.1, g);
    const [f0, f1] = o.down ? [2600, 260] : [260, 2600];
    bp.frequency.setValueAtTime(f0, at);
    bp.frequency.exponentialRampToValueAtTime(f1, at + d);
    noise(c, at, d, bp);
  },
  riser(at, S, o = {}) {
    const c = AUD.ctx;
    const d = o.dur || 2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.1 * (o.vol || 1), at + d);
    g.gain.exponentialRampToValueAtTime(0.0001, at + d + 0.08);
    g.connect(S.sfx);
    const bp = filt(c, 'bandpass', 300, 2.5, g);
    bp.frequency.setValueAtTime(300, at);
    bp.frequency.exponentialRampToValueAtTime(o.top || 5000, at + d);
    noise(c, at, d + 0.1, bp);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, at);
    g2.gain.exponentialRampToValueAtTime(0.035 * (o.vol || 1), at + d);
    g2.gain.exponentialRampToValueAtTime(0.0001, at + d + 0.1);
    g2.connect(S.verbIn);
    const s = tone(c, 'sine', mtof(o.m || 57), at, d + 0.1, g2);
    s.frequency.exponentialRampToValueAtTime(mtof((o.m || 57) + 12), at + d);
  },
  boom(at, S, o = {}) {
    const c = AUD.ctx;
    const g = vca(c, at, 0.01, 0.5 * (o.vol || 1), 1.3, S.sfx);
    const s = tone(c, 'sine', 70, at, 1.4, g);
    s.frequency.exponentialRampToValueAtTime(36, at + 0.9);
    const g2 = vca(c, at, 0.005, 0.12 * (o.vol || 1), 0.6, S.verbIn);
    noise(c, at, 0.6, filt(c, 'lowpass', 900, 0.7, g2));
  },
  shimmer(at, S, o = {}) {
    const c = AUD.ctx;
    const notes = o.notes || [81, 84, 88, 91, 93];
    notes.forEach((m, k) => {
      const t = at + k * (o.gap || 0.05);
      const g = vca(c, t, 0.004, 0.05 * (o.vol || 1), 0.9, S.verbIn);
      tone(c, 'sine', mtof(m), t, 1, g);
      const g2 = vca(c, t, 0.004, 0.022 * (o.vol || 1), 0.5, S.sfx);
      tone(c, 'sine', mtof(m), t, 0.6, g2);
    });
  },
  thud(at, S, o = {}) {
    const c = AUD.ctx;
    const g = vca(c, at, 0.003, 0.4 * (o.vol || 1), 0.22, S.sfx);
    const s = tone(c, 'sine', 120, at, 0.25, g);
    s.frequency.exponentialRampToValueAtTime(48, at + 0.16);
    const g2 = vca(c, at, 0.001, 0.12 * (o.vol || 1), 0.06, S.sfx);
    noise(c, at, 0.08, filt(c, 'bandpass', o.wood ? 1400 : 700, 1.2, g2));
  },
  tick(at, S, o = {}) {
    const c = AUD.ctx;
    const g = vca(c, at, 0.001, 0.08 * (o.vol || 1), 0.035, S.sfx);
    tone(c, 'square', 1700 * (o.pitch || 1), at, 0.05, filt(c, 'highpass', 900, 0.7, g));
  },
  squeeze(at, S, o = {}) {
    const c = AUD.ctx;
    const p = o.pitch || 1;
    const g = vca(c, at, 0.01, 0.1 * (o.vol || 1), 0.16, S.sfx);
    const s = tone(c, 'triangle', 760 * p, at, 0.2, filt(c, 'lowpass', 2200, 1, g));
    s.frequency.exponentialRampToValueAtTime(330 * p, at + 0.15);
    const lfo = tone(c, 'sine', 32, at, 0.2, c.createGain());
    const depth = c.createGain();
    depth.gain.value = 26;
    lfo.disconnect();
    lfo.connect(depth).connect(s.frequency);
  },
  ding(at, S, o = {}) {
    const c = AUD.ctx;
    [1, 2.76, 5.4].forEach((h, k) => {
      const g = vca(c, at, 0.002, (0.09 / (k + 1)) * (o.vol || 1), 1.1 / (k + 1), S.sfx);
      tone(c, 'sine', mtof(o.m || 88) * h, at, 1.2, g);
    });
    const g3 = vca(c, at, 0.002, 0.04 * (o.vol || 1), 1.2, S.verbIn);
    tone(c, 'sine', mtof(o.m || 88), at, 1.2, g3);
  },
  kaching(at, S) {
    FX.clink(at, S, { pitch: 1.1, vol: 1.2 });
    FX.clink(at + 0.07, S, { pitch: 1.35, vol: 1.1 });
    FX.ding(at + 0.1, S, { m: 91, vol: 0.8 });
  },
  paper(at, S, o = {}) {
    const c = AUD.ctx;
    const g = vca(c, at, 0.01, 0.035 * (o.vol || 1), 0.16, S.sfx);
    const am = c.createGain();
    am.connect(g);
    const lfo = tone(c, 'square', 28, at, 0.2, c.createGain());
    lfo.disconnect();
    const dg = c.createGain();
    dg.gain.value = 0.5;
    lfo.connect(dg).connect(am.gain);
    noise(c, at, 0.2, filt(c, 'bandpass', 4200, 0.9, am));
  },
  bloop(at, S, o = {}) {
    const c = AUD.ctx;
    const g = vca(c, at, 0.005, 0.2 * (o.vol || 1), 0.18, S.sfx);
    const s = tone(c, 'sine', o.down ? 900 : 380, at, 0.22, g);
    s.frequency.exponentialRampToValueAtTime(o.down ? 260 : 1300, at + 0.12);
    if (o.verb) {
      const g2 = vca(c, at, 0.005, 0.06, 0.5, S.verbIn);
      tone(c, 'sine', o.down ? 600 : 900, at, 0.5, g2);
    }
  },
  splash(at, S, o = {}) {
    const c = AUD.ctx;
    const g = vca(c, at, 0.02, 0.16 * (o.vol || 1), 1.1, S.sfx);
    const lp = filt(c, 'lowpass', 5000, 0.5, g);
    lp.frequency.setValueAtTime(5000, at);
    lp.frequency.exponentialRampToValueAtTime(500, at + 1);
    noise(c, at, 1.2, lp);
  },
  hit(at, S, o = {}) {
    const c = AUD.ctx;
    const g = vca(c, at, 0.002, 0.3 * (o.vol || 1), 0.25, S.sfx);
    const s = tone(c, 'sine', 150, at, 0.3, g);
    s.frequency.exponentialRampToValueAtTime(55, at + 0.2);
    const g2 = vca(c, at, 0.001, 0.07 * (o.vol || 1), 0.09, S.sfx);
    noise(c, at, 0.1, filt(c, 'bandpass', 2400, 0.8, g2));
  },
};

/* ---------- instruments for the score ---------- */
const INS = {
  pad(at, S, o) {
    const c = AUD.ctx;
    const d = o.dur;
    const g = c.createGain();
    const v = o.vol || 0.05;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(v, at + Math.min(o.att || 0.9, d * 0.5));
    g.gain.setValueAtTime(v, at + d - Math.min(o.rel || 1.2, d * 0.5));
    g.gain.linearRampToValueAtTime(0.0001, at + d);
    const lp = filt(c, 'lowpass', o.cut || 900, 0.6, g);
    g.connect(S.music);
    const send = c.createGain();
    send.gain.value = 0.6;
    g.connect(send).connect(S.verbIn);
    for (const m of o.notes) {
      for (const det of [-6, 6]) {
        const osc = tone(c, o.wave || 'sawtooth', mtof(m), at, d, lp);
        osc.detune.value = det;
      }
    }
  },
  pluck(at, S, o) {
    const c = AUD.ctx;
    const f = mtof(o.m);
    const v = o.vol || 0.04;
    const g = vca(c, at, 0.003, v, o.dec || 0.45, S.music);
    tone(c, 'sine', f, at, 0.6, g);
    const g2 = vca(c, at, 0.002, v * 0.35, 0.07, S.music);
    tone(c, 'sine', f * 4, at, 0.1, g2);
    if (o.verb !== false) {
      const g3 = vca(c, at, 0.003, v * 0.5, 0.5, S.verbIn);
      tone(c, 'sine', f, at, 0.6, g3);
    }
  },
  harpsi(at, S, o) {
    const c = AUD.ctx;
    const f = mtof(o.m);
    const v = o.vol || 0.025;
    const g = vca(c, at, 0.002, v, o.dec || 0.4, S.music);
    const lp = filt(c, 'lowpass', 3200, 0.8, g);
    const hp = filt(c, 'highpass', 260, 0.7, lp);
    tone(c, 'sawtooth', f, at, 0.5, hp);
    tone(c, 'square', f * 2, at, 0.5, filt(c, 'lowpass', 2400, 0.5, vca(c, at, 0.002, 0.25, 0.2, hp)));
    const g3 = vca(c, at, 0.002, v * 0.4, 0.4, S.verbIn);
    tone(c, 'triangle', f, at, 0.5, g3);
  },
  bass(at, S, o) {
    const c = AUD.ctx;
    const f = mtof(o.m);
    const g = c.createGain();
    const v = o.vol || 0.07;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(v, at + 0.02);
    g.gain.exponentialRampToValueAtTime(v * 0.5, at + o.dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
    g.connect(S.music);
    tone(c, 'sine', f, at, o.dur, g);
    tone(c, 'triangle', f * 2, at, o.dur, filt(c, 'lowpass', 500, 0.7, vca(c, at, 0.01, 0.3, o.dur, g)));
  },
  kick(at, S, o) {
    const c = AUD.ctx;
    const g = vca(c, at, 0.002, o.vol || 0.12, 0.22, S.music);
    const s = tone(c, 'sine', 130, at, 0.25, g);
    s.frequency.exponentialRampToValueAtTime(44, at + 0.12);
  },
  hat(at, S, o) {
    const c = AUD.ctx;
    const g = vca(c, at, 0.001, o.vol || 0.018, 0.035, S.music);
    noise(c, at, 0.05, filt(c, 'highpass', 7500, 0.7, g));
  },
  clap(at, S, o) {
    const c = AUD.ctx;
    for (let k = 0; k < 3; k++) {
      const g = vca(c, at + k * 0.012, 0.001, (o.vol || 0.05) * (k === 2 ? 1 : 0.6), k === 2 ? 0.12 : 0.01, S.music);
      noise(c, at + k * 0.012, 0.14, filt(c, 'bandpass', 1500, 1.2, g));
    }
  },
};

/* ---------- the event list ---------- */
function ev(t, fn) {
  EV.push({ t, fn });
}
function buildSfx() {
  EV.length = 0;
  DUCK.length = 0;
  const S = (type, t, o) => ev(t, (at, sess) => FX[type](at, sess, o));
  const I = (type, t, o) => ev(t, (at, sess) => INS[type](at, sess, o));
  /* hook */
  S('tick', T.touched + 0.05, { pitch: 1.4, vol: 0.8 });
  S('tick', T.touched + 0.11, { pitch: 1.2, vol: 0.6 });
  S('shimmer', T.money, { notes: [88, 93], vol: 0.6 });
  T.sq.forEach((s, k) => {
    S('squeeze', s, { pitch: 1 - k * 0.12 });
    S('pop', s + 0.02, { pitch: 2.2 - k * 0.2, vol: 0.4 });
  });
  for (let k = 0; k < 7; k++) S('shimmer', lerp(T.sq[2] + 0.3, T.find, k / 6), { notes: [93 + (k % 3) * 2], vol: 0.35 });
  S('whoosh', T.leak + 0.1, { dur: 2.2, vol: 0.9 });
  S('riser', T.find, { dur: T.cant - T.find, m: 57, vol: 0.6 });
  S('whoosh', T.cant - 0.05, { dur: 0.5, vol: 0.8, down: true });
  S('boom', T.formed - 0.12, { vol: 0.7 });
  S('shimmer', T.formed - 0.1, { notes: [69, 76, 81, 84, 88], gap: 0.04, vol: 0.7 });
  /* paris */
  S('whoosh', T.paris + 0.05, { dur: 0.9, vol: 0.7 });
  S('shimmer', T.paris + 0.6, { notes: [76, 81], vol: 0.5 });
  CITY.forEach((b, i) => S('pop', T.parisW - 0.05 + i * 0.07, { pitch: 0.5 + i * 0.05, vol: 0.5 }));
  S('thud', T.pressLand, { vol: 1.2, wood: true });
  T.stamps.forEach((s, j) => {
    S('thud', s, { vol: 0.35, wood: true });
    S('paper', s + 0.08, { vol: 0.8 });
  });
  S('pop', T.banker - 0.05, { pitch: 0.8, vol: 0.9 });
  S('kaching', T.rich);
  for (let k = 0; k < 6; k++) S('clink', T.got + 0.25 + k * 0.16, { pitch: 0.9 + (k % 3) * 0.1, vol: 0.6 });
  S('ding', T.whyW - 0.03, { m: 88, vol: 1 });
  /* the line */
  S('whoosh', T.never, { dur: 1.5, vol: 0.8 });
  CITY.forEach((b) => S('thud', T.never + 1.05 + b.d, { vol: 0.45 }));
  for (let i = 1; i < 4; i++) S('pop', APPEAR()[i], { pitch: 0.9 + i * 0.12, vol: 0.7 });
  for (let i = 0; i < 4; i++) S('tick', T.once - 0.05 + i * 0.12, { pitch: 0.8 + i * 0.15, vol: 0.8 });
  S('tick', T.pours - 0.3, { pitch: 0.6, vol: 0.7 });
  for (const legs of LEGS) S('clink', legs[0].t1, { pitch: RS(legs[0].t1 * 100, 1, 0.9, 1.15), vol: 0.55 });
  S('shimmer', T.flows - 0.1, { notes: [76, 79, 81, 84, 86, 88], gap: 0.16, vol: 0.6 });
  S('pop', T.todays - 0.15, { pitch: 1.1, vol: 0.8 });
  T.buy.forEach(([b0, gap, n]) => {
    for (let j = 0; j < Math.ceil(n); j++) S('pop', b0 + j * gap + 0.42, { pitch: 0.55, vol: 0.55 });
  });
  T.priceSteps.slice(1).forEach(([ts]) => {
    for (let k = 0; k < 5; k++) S('tick', ts + k * 0.07, { pitch: 1 + k * 0.05, vol: 0.7 });
  });
  S('bloop', T.up - 0.05, { vol: 0.8, verb: true });
  for (const legs of LEGS)
    for (const l of legs) if (l.type === 'fall' && l.t0 > T.next) S('clink', l.t1, { pitch: RS(l.t1 * 100, 2, 0.85, 1.2), vol: 0.32 });
  S('whoosh', T.next - 0.05, { dur: 1.2, vol: 0.5, down: true });
  S('whoosh', T.end + 0.1, { dur: 1.8, vol: 0.6, down: true });
  S('kaching', T.checkAt + 0.12);
  S('bloop', T.climbed + 0.1, { down: true, vol: 0.7 });
  S('whoosh', T.overview, { dur: 1.1, vol: 0.6 });
  for (let i = 0; i < 4; i++) S('clink', T.same - 0.1 + i * 0.06, { pitch: 1, vol: 0.4 });
  for (let i = 0; i < 4; i++) S('pop', T.less + i * 0.12, { pitch: 1.3 - i * 0.15, vol: 0.7 });
  /* today */
  S('thud', T.today + 0.25, { vol: 0.8 });
  S('shimmer', T.today + 0.1, { notes: [81, 86], vol: 0.5 });
  for (let i = 1; i < 4; i++) S('pop', T.today + 0.1 + i * 0.12, { pitch: 1.2 + i * 0.1, vol: 0.5 });
  S('tick', T.pourModern[0] - 0.3, { pitch: 0.6, vol: 0.7 });
  for (const legs of LEGS_M) for (const l of legs) if (l.type === 'fall') S('clink', l.t1, { pitch: RS(l.t1 * 100, 3, 0.9, 1.2), vol: 0.3 });
  S('pop', T.banks - 0.05, { pitch: 1.4, vol: 0.6 });
  S('pop', T.financial - 0.05, { pitch: 1.5, vol: 0.6 });
  S('whoosh', T.chart, { dur: 1.1, vol: 0.7 });
  S('riser', T.rise - 0.3, { dur: T.first2 + 0.5 - T.rise, m: 64, vol: 0.5, top: 3000 });
  S('bloop', T.wages - 0.05, { vol: 0.4 });
  S('whoosh', T.own - 0.1, { dur: 0.9, vol: 0.6 });
  S('splash', T.ride - 0.1, { vol: 1 });
  for (let k = 0; k < 10; k++) S('tick', T.chase + k * 0.075, { pitch: 0.5 + (k % 2) * 0.1, vol: 0.5 });
  /* finale */
  S('whoosh', T.panUpStart, { dur: 1.3, vol: 0.9 });
  S('pop', T.stole + 0.4, { pitch: 0.8, vol: 0.7 });
  S('pop', T.stole + 0.55, { pitch: 0.95, vol: 0.7 });
  S('thud', T.stole + 0.65, { vol: 0.5 });
  for (const legs of LEGS_F) S('clink', legs[0].t1, { pitch: 1.2, vol: 0.3 });
  for (let i = 1; i < 4; i++) S('tick', T.closer - 0.1 + i * 0.12, { pitch: 0.9 + i * 0.1, vol: 0.4 });
  S('bloop', T.appears - 0.7, { vol: 0.6, verb: true });
  S('shimmer', T.appears - 0.3, { notes: [81, 88, 93], gap: 0.1, vol: 0.6 });
  S('shimmer', T.askW, { notes: [88, 91, 93, 96], gap: 0.08, vol: 0.5 });
  [T.who, T.gets, T.it2, T.first3].forEach((w, k) => S('hit', w, { vol: k === 3 ? 0.7 : 0.45 }));
  S('shimmer', T.first3 + 0.12, { notes: [69, 76, 81, 84], gap: 0.03, vol: 0.45 });
  S('whoosh', T.drop, { dur: T.land - T.drop, vol: 0.8, down: true });
  S('bloop', T.land - 0.02, { vol: 0.9, verb: true });
  S('shimmer', T.land + 0.02, { notes: [88, 93], vol: 0.5 });

  buildScore(I);

  // duck the music while the narrator speaks
  for (const l of TIMING.lines) {
    DUCK.push([l.start - 0.15, 0.5]);
    DUCK.push([l.end + 0.1, 1]);
  }
  DUCK.sort((a, b) => a[0] - b[0]);
  EV.sort((a, b) => a.t - b.t);
}

function buildScore(I) {
  const chord = {
    Am: [57, 60, 64, 69],
    F: [53, 57, 60, 65],
    C: [48, 55, 60, 64],
    G: [55, 59, 62, 67],
    Dm: [50, 57, 62, 65],
    E: [52, 56, 59, 64],
    Fmaj7: [53, 57, 60, 64],
    G6: [55, 59, 62, 64],
    Em7: [52, 55, 59, 62],
    Am9: [45, 57, 60, 64, 71],
  };
  /* hook: a low drone, glassy and uncertain */
  I('pad', 0.02, { dur: T.formed + 0.2, notes: [45, 52], vol: 0.05, cut: 520, att: 1.4, rel: 1.2 });
  I('pad', T.leak, { dur: T.formed - T.leak + 0.3, notes: [57, 64, 71], vol: 0.03, cut: 1400, att: 2.5, rel: 0.4 });
  /* the title blooms */
  I('pad', T.formed - 0.1, { dur: T.paris - T.formed + 1.4, notes: [41, 53, 57, 60, 67], vol: 0.045, cut: 1600, att: 0.15, rel: 1.2 });
  /* Paris, 1720: a harpsichord in A minor, circle of fifths */
  const prog1 = ['Am', 'Dm', 'G', 'C', 'F', 'Dm', 'E', 'Am'];
  const span1 = (T.never - T.paris) / prog1.length;
  prog1.forEach((name, ci) => {
    const t0 = T.paris + ci * span1;
    const ch = chord[name];
    I('harpsi', t0, { m: ch[0] - 12, vol: 0.03, dec: 0.9 });
    const pat = [0, 1, 2, 3, 2, 1, 2, 3];
    pat.forEach((k, j) => I('harpsi', t0 + (j * span1) / 8, { m: ch[k] + 12, vol: j === 0 ? 0.022 : 0.016, dec: 0.3 }));
  });
  /* the line: steady marimba, a pulse that grows as prices rise */
  const beat = 0.6;
  const prog2 = ['Am', 'F', 'C', 'G'];
  let t = T.never + 0.1;
  let ci = 0;
  const lineEnd = T.same - 0.35;
  while (t < lineEnd - 0.2) {
    const ch = chord[prog2[ci % 4]];
    I('bass', t, { m: ch[0] - 12, dur: beat * 2 - 0.05, vol: 0.06 });
    for (let j = 0; j < 4; j++) {
      const tt = t + j * (beat / 2);
      if (tt > lineEnd) break;
      const heatK = clamp((tt - T.first) / (T.same - T.first));
      I('pluck', tt, { m: ch[[0, 2, 1, 3][j]] + 12, vol: 0.022 + 0.012 * heatK, dec: 0.35 });
    }
    if (t > T.first - 0.1) {
      I('kick', t, { vol: 0.09 });
      I('kick', t + beat, { vol: 0.07 });
    }
    if (t > T.next - 0.1) {
      I('hat', t + beat / 2, {});
      I('hat', t + beat * 1.5, {});
    }
    t += beat * 2;
    ci++;
  }
  /* same money, less stuff: the floor drops out */
  I('pad', T.same - 0.35, { dur: T.today - T.same + 0.6, notes: chord.Am9, vol: 0.04, cut: 1100, att: 0.3, rel: 0.5 });
  /* today: a brighter, electronic pulse */
  const beat3 = 0.57;
  const prog3 = ['F', 'G', 'Am', 'Am'];
  t = T.today + 0.05;
  ci = 0;
  while (t < T.panUpStart - 0.1) {
    const ch = chord[prog3[ci % 4]];
    for (let j = 0; j < 4; j++) {
      const tt = t + j * (beat3 / 2);
      if (tt > T.panUpStart) break;
      I('bass', tt, { m: ch[0] - 12, dur: beat3 / 2 - 0.02, vol: 0.05 });
      I('pluck', tt, { m: ch[(j * 2) % 4] + 12, vol: 0.02, dec: 0.25, verb: j === 0 });
      if (t > T.chart - 0.2 && j % 2 === 0) I('kick', tt, { vol: 0.08 });
      if (t > T.own - 0.3) I('hat', tt + beat3 / 4, { vol: 0.014 });
    }
    if (t > T.chart - 0.2) I('clap', t + beat3, { vol: 0.03 });
    t += beat3 * 2;
    ci++;
  }
  /* finale: warm and thoughtful */
  const prog4 = ['Fmaj7', 'G6', 'Em7', 'Am9'];
  const span4 = (T.who - T.stole + 0.2) / 4;
  prog4.forEach((name, k) => {
    const t0 = T.stole - 0.2 + k * span4;
    I('pad', t0, { dur: span4 + 0.5, notes: chord[name], vol: 0.026, cut: 1200, att: 0.5, rel: 0.6, wave: 'triangle' });
    I('bass', t0, { m: chord[name][0] - 12, dur: span4, vol: 0.05 });
    I('pluck', t0 + 0.02, { m: chord[name][3] + 12, vol: 0.02, dec: 0.8 });
  });
  /* the question: open chord, then back to the opening drone for the loop */
  I('pad', T.who - 0.05, { dur: T.drop - T.who + 1.2, notes: [41, 53, 60, 64, 67], vol: 0.032, cut: 1500, att: 0.08, rel: 1 });
  I('pad', T.drop, { dur: DUR - T.drop - 0.05, notes: [45, 52], vol: 0.04, cut: 520, att: 1, rel: 0.8 });
}
