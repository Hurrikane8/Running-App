// Plan generation rules engine. See DESIGN_NOTES.md for the sourcing of every
// constant here (periodization splits, 80/20, 10% rule, deloads, taper lengths,
// ultra adaptations).

import { addDays, mondayOf, todayStr, diffDays, roundHalf, clamp, uid, dayIndex } from './util.js';
import { trainingPaces, predictRace, vdotFromRace, INTENSITY_FRACTIONS, impliedVdotFromEffort } from './paces.js';

export const GOALS = {
  '5k':      { label: '5K',           distKm: 5,      minWeeks: 6,  taper: 1, ultra: false },
  '10k':     { label: '10K',          distKm: 10,     minWeeks: 6,  taper: 1, ultra: false },
  'half':    { label: 'Half marathon', distKm: 21.0975, minWeeks: 8, taper: 2, ultra: false },
  'marathon':{ label: 'Marathon',     distKm: 42.195, minWeeks: 12, taper: 2, ultra: false },
  '50k':     { label: '50K ultra',    distKm: 50,     minWeeks: 12, taper: 3, ultra: true },
  '50mi':    { label: '50-mile ultra', distKm: 80.5,  minWeeks: 16, taper: 3, ultra: true },
  '100k':    { label: '100K ultra',   distKm: 100,    minWeeks: 16, taper: 3, ultra: true },
  '100mi':   { label: '100-mile ultra', distKm: 161,  minWeeks: 20, taper: 3, ultra: true },
  'fitness': { label: 'General fitness', distKm: null, minWeeks: 12, taper: 0, ultra: false },
};

// Peak weekly volume caps (km) by [beginner, intermediate, advanced, elite]
const PEAK_KM = {
  '5k': [30, 45, 65, 90], '10k': [35, 50, 75, 100], 'half': [40, 60, 85, 110],
  'marathon': [50, 70, 95, 130], '50k': [55, 75, 100, 135], '50mi': [60, 85, 110, 145],
  '100k': [65, 90, 120, 150], '100mi': [70, 95, 125, 160], 'fitness': [30, 50, 70, 90],
};

const EXP_IDX = { beginner: 0, intermediate: 1, advanced: 2, elite: 3 };

// Long-run distance cap (km) per goal, by experience tier
const LONG_CAP_KM = {
  '5k': [10, 13, 16, 18], '10k': [12, 15, 18, 21], 'half': [16, 19, 22, 24],
  'marathon': [26, 30, 32, 35], 'fitness': [12, 16, 20, 24],
};
// Ultra long runs are time-based (minutes): peak duration per goal/experience
const ULTRA_LONG_MIN = {
  '50k': [180, 210, 240, 260], '50mi': [210, 250, 290, 320],
  '100k': [240, 280, 320, 350], '100mi': [270, 320, 360, 390],
};

// ---- weekly scheduling ----
//
// Run days are placed around the long-run day L (Saturday by default,
// Sunday optional). Defaults, as offsets from L:
//   2: Wed Sat · 3: Tue Thu Sat · 4: Tue Thu Sat Sun · 5: Tue Wed Thu Sat Sun
//   6: Tue–Sun (Monday off) · 7: every day
// The day after the long run is a recovery run; the key sessions go on the
// days that keep them furthest from each other and from the long run
// (pickKeyDays) — Tue/Thu for a Saturday long run, never Friday-into-Saturday.
const DEFAULT_OFFSETS = {
  1: [0], 2: [-3, 0], 3: [-4, -2, 0], 4: [-4, -2, 0, 1], 5: [-4, -3, -2, 0, 1],
  6: [-4, -3, -2, -1, 0, 1], 7: [-5, -4, -3, -2, -1, 0, 1],
};

export function defaultRunDays(daysPerWeek, longRunDay = 5) {
  const offs = DEFAULT_OFFSETS[clamp(daysPerWeek || 4, 1, 7)];
  return [...new Set(offs.map((o) => (((longRunDay + o) % 7) + 7) % 7))].sort((a, b) => a - b);
}

export function longDayOf(profile) {
  return profile.longRunDay === 6 ? 6 : 5;
}

// The profile's run days (Mon=0..Sun=6), always consistent with daysPerWeek.
export function runDaysOf(profile) {
  const d = Array.isArray(profile.runDays) && profile.runDays.length === profile.daysPerWeek
    ? profile.runDays
    : defaultRunDays(profile.daysPerWeek, longDayOf(profile));
  return [...d].sort((a, b) => a - b);
}

// days forward from a to b around the week (0..6)
const cyc = (a, b) => (((b - a) % 7) + 7) % 7;

const lexGreater = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

function combos(arr, n) {
  if (n === 0) return [[]];
  const out = [];
  arr.forEach((x, i) => combos(arr.slice(i + 1), n - 1).forEach((c) => out.push([x, ...c])));
  return out;
}

// Choose n key-session days from runDays. Hard days should be separated by
// easy days: maximize the smallest gap (around the week) between any two
// hard days including the long run, then the next-smallest, then prefer the
// days furthest into the week after the long run (Tue/Thu before a Saturday
// long run rather than Mon/Wed). The days directly before and after the long
// run are avoided whenever enough other days exist.
export function pickKeyDays(runDays, longDay, n) {
  const cands = runDays.filter((d) => d !== longDay);
  if (n <= 0 || !cands.length) return [];
  const soft = cands.filter((d) => cyc(d, longDay) !== 1 && cyc(longDay, d) !== 1);
  const pool = soft.length >= n ? soft : cands;
  const k = Math.min(n, pool.length);
  let best = null, bestScore = null;
  for (const set of combos(pool, k)) {
    const all = [...set, longDay].sort((a, b) => a - b);
    const gaps = all.map((d, i) => (i === all.length - 1 ? all[0] + 7 - d : all[i + 1] - d)).sort((a, b) => a - b);
    const score = [...gaps, set.reduce((s, d) => s + cyc(longDay, d), 0)];
    if (!bestScore || lexGreater(score, bestScore)) {
      best = set; bestScore = score;
    }
  }
  return best.sort((a, b) => cyc(longDay, a) - cyc(longDay, b));
}

export function planWeeksFor(goal, raceDate) {
  const g = GOALS[goal];
  if (!g || goal === 'fitness' || !raceDate) return 12;
  const start = mondayOf(todayStr());
  const days = diffDays(start, raceDate);
  const actual = Math.floor(days / 7) + 1;
  return clamp(actual, 2, 32);
}

function phaseFor(weekIdx, totalWeeks, taperWeeks, ultra) {
  const pre = totalWeeks - taperWeeks;
  if (weekIdx >= pre) return 'taper';
  const baseFrac = ultra ? 0.5 : 0.45;
  const buildFrac = ultra ? 0.3 : 0.35;
  const baseEnd = Math.max(1, Math.round(pre * baseFrac));
  const buildEnd = baseEnd + Math.max(1, Math.round(pre * buildFrac));
  if (weekIdx < baseEnd) return 'base';
  if (weekIdx < buildEnd) return 'build';
  return 'peak';
}

// PEAK_KM is tuned for a 5-day/week schedule. More run days safely absorb
// more total volume (shorter, more frequent runs vs. fewer big ones) and
// fewer days absorb less, so scale it +/-7%/day around that baseline
// instead of giving every day-count for a goal the exact same ceiling —
// clamped so very low/high day counts stay in a sane range.
const PEAK_DAYS_BASELINE = 5;
const PEAK_DAY_FACTOR = 0.07;

// Share of the week the long run may take. Marathon and half plans need a
// bigger long run relative to weekly volume (standard marathon plans peak at
// 30-32 km long runs on ~65-90 km weeks); shorter goals stay at ~35%.
const LONG_SHARE = { marathon: 0.45, half: 0.40 };

// 3:1 step-loading: every 4th week is a deload — except the week right
// before the taper. The taper IS the recovery; a deload in front of it gave
// two light weeks in a row and cut the peak block short.
function deloadAt(w, totalWeeks, taperWeeks) {
  const pre = totalWeeks - taperWeeks;
  if (w >= pre) return false;
  if (w % 4 !== 3) return false;
  return !(taperWeeks > 0 && w === pre - 1);
}

// Weekly volume series: classic 3:1 step-loading. Full-load weeks grow ≤10%
// (6–8% with injuries); deloads sit at ~72% of the current full load. The
// growth chain advances only on full-load weeks, so the week after a deload
// resumes one growth step (≤10%) above the previous full-load week — the
// deload itself is unloading, not the progression baseline. Taper
// multipliers at the end. `fromWeek`/`startKm` re-anchor the chain at a
// given week (mid-plan replans continue from the current training load
// instead of restarting from the onboarding number).
function volumeSeries(profile, totalWeeks, taperWeeks, fromWeek = 0, startKm = null) {
  const idx = EXP_IDX[profile.experience];
  const dayFactor = clamp(1 + (profile.daysPerWeek - PEAK_DAYS_BASELINE) * PEAK_DAY_FACTOR, 0.8, 1.35);
  // Weekly volume is capped two ways, whichever is lower: PEAK_KM (scaled
  // for day count, above) is the goal-appropriate ceiling; the schedule-
  // absorption cap below is the long run at its cap plus each remaining day
  // at an easy run that stays shorter than the long run — without it,
  // short-race plans with high entered mileage or few run days dump
  // leftover volume into oversized "easy" runs.
  let peakCap = Math.round(PEAK_KM[profile.goal][idx] * dayFactor);
  if (!GOALS[profile.goal].ultra) {
    const longCap = LONG_CAP_KM[profile.goal][idx];
    const easyCap = Math.min(16, longCap * 0.85);
    peakCap = Math.min(peakCap, Math.round(longCap + (profile.daysPerWeek - 1) * easyCap));
  }
  const growth = profile.injuries.length ? 1.06 : 1.08;
  const start = clamp(profile.weeklyKm || 15, 8, peakCap);
  const taperMult = { 1: [0.55], 2: [0.7, 0.45], 3: [0.72, 0.55, 0.38] }[taperWeeks] || [];
  const vols = [];
  let chain = start;
  let lastFull = start;
  for (let w = 0; w < totalWeeks; w++) {
    const tIdx = w - (totalWeeks - taperWeeks);
    if (w === fromWeek && startKm != null) {
      chain = clamp(startKm, 8, peakCap);
      lastFull = chain;
      if (tIdx < 0) { vols.push(deloadAt(w, totalWeeks, taperWeeks) ? chain * 0.72 : chain); continue; }
    }
    if (tIdx >= 0) {
      vols.push(lastFull * taperMult[tIdx]);
      continue;
    }
    const isDeload = deloadAt(w, totalWeeks, taperWeeks);
    if (w > 0 && w !== fromWeek && !isDeload) chain = Math.min(chain * growth, peakCap);
    lastFull = chain;
    vols.push(isDeload ? chain * 0.72 : chain);
  }
  return vols.map((v) => Math.round(v));
}

// ---- workout builders ----

function fmtMin(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
const fmtKm = (km) => `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
const fmtRep = (m) => (m >= 1000 && m % 1000 === 0 ? `${m / 1000} km` : m === 1600 ? '1.6 km' : `${m} m`);
function fmtRec(min) {
  const s = Math.round(min * 60);
  return s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s / 60} min`;
}

const TIPS = {
  easy: [
    'Easy means genuinely easy. You should be able to hold a conversation the whole way.',
    'If your watch pace looks slow today, good. Easy runs build the engine; save the effort for quality days.',
    'Relax your shoulders and shorten your stride slightly. Smooth beats fast on easy days.',
  ],
  recovery: [
    'This run is about blood flow, not fitness. Slower than feels necessary is exactly right.',
    'Keep it short and gentle. If your legs feel heavy, walking breaks are fine.',
  ],
  long: [
    'Start slower than feels natural. The goal is finishing steady, not starting fast.',
    'Practice fueling: take on carbs every 30-40 minutes on runs over 90 minutes.',
    'Break the distance into thirds mentally: settle, cruise, then hold form when tired.',
  ],
  longq: [
    'Run the easy part truly easy so the fast finish is controlled, not a scramble.',
    'The goal-pace segment is a dress rehearsal: pace, fueling, shoes, even breakfast.',
  ],
  ultralong: [
    'Time on feet is the goal, not pace. Hike the hills. It is free speed later.',
    'Treat this as a fueling rehearsal: eat early, eat often, and note what sits well.',
    'Run the flats and downhills relaxed; power-hike anything steep. That is race craft.',
  ],
  tempo: [
    'Threshold effort is "comfortably hard": you could speak a sentence, not a paragraph.',
    'Do not race the tempo. The last rep should feel like you could do one more.',
    'Short jog breaks keep the quality high. Resist the urge to speed up late.',
  ],
  intervals: [
    'Run the first rep as if it were the fifth. Even pacing wins interval sessions.',
    'Full recovery is part of the workout. Jog it out and let your breathing settle.',
  ],
  reps: [
    'These are about speed and form, not suffering. Fast, relaxed, full recovery.',
    'Quick feet, tall posture, loose hands. If form breaks, the rep is over.',
  ],
  mpace: [
    'Goal-pace running teaches rhythm. Lock into the pace and let it feel automatic.',
    'Resist running these faster than goal pace. Precision is the skill you are building.',
  ],
  sharpener: [
    'A short reminder for your legs, not a fitness builder. Finish feeling you could do double.',
  ],
  strides: [
    'Strides are 20-30 s of fast, relaxed running: build up, float, ease off. Not sprints.',
  ],
  hillsprints: [
    'Hill sprints are short and explosive with full recovery. Power, not fatigue.',
  ],
  shakeout: [
    'Just loosening the legs. Lay out your kit tonight and get to bed early.',
  ],
  xtrain: [
    'Bike, swim, elliptical or brisk uphill walk: aerobic effort without the impact.',
  ],
  race: [
    'Trust the training. Start conservatively, execute your fueling plan, and finish strong.',
  ],
  tt: [
    'Run it like a race: controlled first third, hold the middle, empty the tank at the end.',
  ],
  hills: [
    'Run hills by effort, not pace. Strong up, relaxed down, tall posture throughout.',
  ],
};

function tip(type, weekIdx) {
  const arr = TIPS[type] || TIPS.easy;
  return arr[weekIdx % arr.length];
}

// One workout object. Distances km, durations minutes. `extra` carries the
// structured fields: `work` (the main set: { paceKey, km, reps, repM|repMin })
// used for logging/evidence/feedback, and `segments` ([{ z, km|min }]) used to
// draw the session's intensity profile.
function wk(date, type, title, distKm, durMin, structure, paceKey, theTip, extra = {}) {
  return {
    id: uid(), date, type, title,
    distKm: distKm != null ? roundHalf(distKm) : null,
    durMin: durMin != null ? Math.round(durMin) : null,
    structure, paceKey, tip: theTip,
    status: 'planned', log: null,
    ...extra,
  };
}

function easyRun(date, km, weekIdx, type = 'easy') {
  const title = type === 'recovery' ? 'Recovery run' : 'Easy run';
  return wk(date, type, title, km, null, {
    warmup: null,
    main: type === 'recovery' ? 'Very relaxed running at recovery pace' : 'Relaxed, conversational running at easy pace',
    cooldown: null,
  }, type === 'recovery' ? 'recovery' : 'easy', tip(type, weekIdx),
  { segments: [{ z: type === 'recovery' ? 'recovery' : 'easy', km: roundHalf(km) }] });
}

// Easy run with a neuromuscular add-on: strides (default) or hill sprints.
function stridesRun(date, km, weekIdx, variant = 'strides', count = 6) {
  const hill = variant === 'hills';
  const shake = variant === 'shakeout';
  const title = hill ? 'Easy run + hill sprints' : shake ? 'Shakeout + strides' : 'Easy run + strides';
  const add = hill
    ? `${count} × 10 s steep hill sprints, walk back down to recover`
    : `${count} × 20 s strides with full recovery, after the run`;
  const segs = [{ z: 'easy', km: roundHalf(km) }];
  for (let i = 0; i < count; i++) {
    segs.push({ z: hill ? 'hill' : 'stride', min: hill ? 10 / 60 : 20 / 60 });
    if (i < count - 1) segs.push({ z: 'jog', min: hill ? 1.2 : 1 });
  }
  return wk(date, 'strides', title, km, null, {
    warmup: null,
    main: shake ? '15-20 min very relaxed at easy pace' : 'Easy pace throughout',
    cooldown: add,
  }, 'easy', tip(hill ? 'hillsprints' : shake ? 'shakeout' : 'strides', weekIdx), { segments: segs });
}

// Structured quality session: warm-up, a main set of reps (distance- or
// time-based) or one continuous block, cool-down. Total distance counts the
// recovery jogs at easy pace so weekly volume stays honest.
function qualitySession(date, ctx, s) {
  const { p, beginner } = ctx;
  const light = beginner || ctx.vol < 25;
  const wu = s.wu ?? (light ? 1.5 : 2);
  const cd = s.cd ?? (light ? 1 : 1.5);
  const workPace = s.pace; // sec/km of the main set (for sizing only)
  const segs = [{ z: 'easy', km: wu }];
  let workKm = 0;
  const reps = s.reps || 1;
  for (let i = 0; i < reps; i++) {
    if (s.repMin) { segs.push({ z: s.zone, min: s.repMin }); workKm += (s.repMin * 60) / workPace; }
    else { segs.push({ z: s.zone, km: s.repKm }); workKm += s.repKm; }
    if (i < reps - 1 && s.recMin) segs.push({ z: 'jog', min: s.recMin });
  }
  segs.push({ z: 'easy', km: cd });
  const jogKm = reps > 1 && s.recMin ? ((reps - 1) * s.recMin * 60) / (p.easy[0] + 20) : 0;
  const total = wu + workKm + jogKm + cd;
  const work = { paceKey: s.paceKey, km: Math.round(workKm * 10) / 10, reps };
  if (s.repMin) work.repMin = s.repMin; else if (reps > 1 || s.repKm < 5) work.repM = Math.round(s.repKm * 1000);
  return wk(date, s.type, s.title, total, null, {
    warmup: s.noStrides ? `${fmtKm(wu)} easy` : `${fmtKm(wu)} easy + 4 strides`,
    main: s.main,
    cooldown: `${fmtKm(cd)} easy jog`,
  }, s.paceKey, tip(s.tipKey || s.type, ctx.weekIdx), { work, segments: segs });
}

// Occurrence-based progression: the n-th time a session type appears it is
// a little bigger/different — 80% of the zone's volume cap on first
// exposure, full cap from the 4th.
const prog = (n) => Math.min(1, 0.8 + 0.07 * n);

// Threshold (Daniels T): cruise intervals and continuous tempo alternate.
// T volume per session ≤ ~10% of the week (Daniels), 2.5–10 km.
function thresholdSession(date, ctx, n) {
  const T = ctx.p.threshold;
  const W = clamp(0.10 * ctx.vol, 2.5, 10) * prog(n);
  const base = { type: 'tempo', paceKey: 'threshold', zone: 'threshold', pace: T, tipKey: 'tempo' };
  const fmt = n % 4;
  if (fmt === 1 || fmt === 3) {
    const min = clamp(Math.round((W * T) / 60 / 5) * 5, 15, 40);
    if (fmt === 3 && min >= 25) {
      const half = Math.round(min / 2);
      return qualitySession(date, ctx, { ...base, title: 'Threshold run', reps: 2, repMin: half, recMin: 2,
        main: `2 × ${half} min at threshold pace, 2 min easy jog between` });
    }
    return qualitySession(date, ctx, { ...base, title: 'Tempo run', reps: 1, repMin: min,
      main: `${min} min continuous at threshold pace` });
  }
  const repKm = W < 3.2 ? 1 : fmt === 2 ? 2 : 1.6;
  const reps = clamp(Math.round(W / repKm), 2, 6);
  const rec = repKm >= 2 ? 1.5 : 1;
  return qualitySession(date, ctx, { ...base, title: 'Cruise intervals', reps, repKm, recMin: rec,
    main: `${reps} × ${fmtRep(repKm * 1000)} at threshold pace, ${fmtRec(rec)} jog recovery` });
}

// VO2max (Daniels I): 3–5 min reps, I volume ≤ ~8% of the week.
function vo2Session(date, ctx, n) {
  const W = clamp(0.08 * ctx.vol, 2, 8) * prog(n);
  const opts = W < 3 ? [400, 600, 400, 800, 600, 800] : [800, 1000, 800, 1200, 1000, 1200];
  const repM = opts[n % opts.length];
  const reps = clamp(Math.round((W * 1000) / repM), 3, 8);
  const rec = { 400: 1.5, 600: 2, 800: 2, 1000: 2.5, 1200: 3 }[repM];
  return qualitySession(date, ctx, { type: 'intervals', title: 'VO2max intervals', paceKey: 'interval', zone: 'interval',
    pace: ctx.p.interval, reps, repKm: repM / 1000, recMin: rec, tipKey: 'intervals',
    main: `${reps} × ${fmtRep(repM)} at interval pace, ${fmtRec(rec)} jog recovery` });
}

// Speed (Daniels R): short fast reps with full recovery, ≤ ~5% of the week.
function speedSession(date, ctx, n) {
  const W = clamp(0.05 * ctx.vol, 1.2, 5) * prog(n);
  const repM = [200, 200, 300, 400, 300, 400][n % 6];
  const reps = clamp(Math.round((W * 1000) / repM), 6, 12);
  return qualitySession(date, ctx, { type: 'reps', title: 'Speed reps', paceKey: 'rep', zone: 'rep',
    pace: ctx.p.rep, reps, repKm: repM / 1000, recMin: repM / 130, tipKey: 'reps',
    main: `${reps} × ${repM} m at repetition pace, ${repM} m walk/jog recovery` });
}

// Goal pace = the projected race-day pace for the goal distance. Race-
// specific work, progressing toward the classic benchmark sessions
// (5 × 1 km at 5K pace, 3 × 2 km at 10K pace, 2 × 5 km at HM pace, long MP).
const GOAL_TITLE = { '5k': '5K-pace intervals', '10k': '10K-pace intervals', half: 'Half-marathon pace', marathon: 'Marathon-pace run' };
function goalSession(date, ctx, n, sharpener = false) {
  const goal = ctx.goal;
  const d = GOALS[goal].distKm;
  const pace = predictRace(ctx.profile.vdot, d) / d;
  const base = { type: 'mpace', paceKey: 'goalpace', zone: 'goalpace', pace, tipKey: sharpener ? 'sharpener' : 'mpace' };
  const title = sharpener ? 'Race-week sharpener' : GOAL_TITLE[goal];
  const reps = (repKm, recMin, r) => qualitySession(date, ctx, { ...base, title, reps: r, repKm, recMin,
    main: `${r} × ${fmtRep(repKm * 1000)} at goal pace, ${fmtRec(recMin)} jog recovery` });
  if (sharpener) {
    const r = ctx.vol < 30 ? 2 : 3;
    if (goal === '5k') return reps(1, 2, r);
    if (goal === '10k') return reps(1.6, 2, r);
    if (goal === 'half') return reps(2, 2, r);
    return qualitySession(date, ctx, { ...base, title, reps: 1, repKm: 5, cd: 1, noStrides: true,
      main: '5 km at goal pace, relaxed and controlled' });
  }
  if (goal === '5k') {
    const W = clamp(0.10 * ctx.vol, 2, 6) * prog(n);
    const rep = W < 3 ? [0.6, 0.8, 0.6, 1][n % 4] : [1, 1.2, 1, 1.6][n % 4];
    return reps(rep, rep >= 1.6 ? 3 : 2, clamp(Math.round(W / rep), 3, 6));
  }
  if (goal === '10k') {
    const W = clamp(0.12 * ctx.vol, 2.5, 9) * prog(n);
    const rep = W < 4 ? [1, 1.2, 1, 1.6][n % 4] : [1.6, 2, 1.6, 3][n % 4];
    return reps(rep, rep >= 3 ? 3 : rep >= 2 ? 2 : 1.5, clamp(Math.round(W / rep), 2, 5));
  }
  if (goal === 'half') {
    const W = clamp(0.2 * ctx.vol, 3, 13) * prog(n);
    const fmt = n % 4;
    if (fmt === 3) {
      const km = Math.max(3, Math.round(W));
      return qualitySession(date, ctx, { ...base, title, reps: 1, repKm: km, cd: 1,
        main: `${km} km continuous at goal pace` });
    }
    const rep = Math.min(fmt === 2 ? 5 : 3, Math.max(1, roundHalf(W / 2)));
    return reps(rep, fmt === 1 ? 2 : 3, clamp(Math.round(W / rep), 2, 4));
  }
  // marathon: continuous MP block growing 2 km per exposure (6 → 16 km),
  // capped at ~22% of the week
  const km = Math.max(4, Math.min(6 + 2 * n, Math.round(clamp(0.22 * ctx.vol, 5, 16))));
  return qualitySession(date, ctx, { ...base, title, reps: 1, repKm: km, cd: 1, noStrides: true,
    main: `${km} km at goal pace` });
}

// Hill repeats: strength and power with less impact. Effort-based — no pace
// or HR target (gradients make both meaningless).
function hillSession(date, ctx, n) {
  const fm = ctx.beginner ? [[5, 30], [6, 30], [6, 45], [8, 45]] : [[6, 45], [8, 45], [6, 60], [8, 60], [10, 60]];
  const [reps, sec] = fm[Math.min(n, fm.length - 1)];
  const light = ctx.beginner || ctx.vol < 25;
  const wu = light ? 1.5 : 2, cd = light ? 1 : 1.5;
  const segs = [{ z: 'easy', km: wu }];
  for (let i = 0; i < reps; i++) {
    segs.push({ z: 'hill', min: sec / 60 });
    if (i < reps - 1) segs.push({ z: 'jog', min: (sec * 1.6) / 60 });
  }
  segs.push({ z: 'easy', km: cd });
  return wk(date, 'hills', 'Hill repeats', wu + cd + reps * 0.4, null, {
    warmup: `${fmtKm(wu)} easy`,
    main: `${reps} × ${sec} s strong uphill effort, jog back down to recover`,
    cooldown: `${fmtKm(cd)} easy jog`,
  }, null, tip('hills', ctx.weekIdx), { work: { paceKey: null, reps, repMin: sec / 60 }, segments: segs });
}

// Time trial: calibrates fitness (logged result → VDOT at full confidence).
function timeTrial(date, ctx) {
  const d = ctx.beginner ? 3 : 5;
  return wk(date, 'tt', `${d === 5 ? '5K' : '3 km'} time trial`, 2 + d + 1.5, null, {
    warmup: '2 km easy + 4 strides',
    main: `${d} km time trial: a hard, even effort (RPE 9). Start controlled, finish strong`,
    cooldown: '1.5 km easy jog',
  }, null, tip('tt', ctx.weekIdx), {
    work: { paceKey: null, km: d },
    segments: [{ z: 'easy', km: 2 }, { z: 'race', km: d }, { z: 'easy', km: 1.5 }],
  });
}

// variant: 'easy' | 'mp' (final block at goal pace) | 'ff' (fast finish)
function longRun(date, km, weekIdx, goal, variant = 'easy', mpN = 0) {
  let main = 'Steady, relaxed effort at easy pace throughout';
  let segs = [{ z: 'easy', km: roundHalf(km) }];
  let t = tip('long', weekIdx);
  let title = 'Long run';
  if (variant !== 'easy') {
    const q = variant === 'mp'
      ? clamp(Math.min(Math.round(km * 0.35), 5 + 2 * mpN), 4, 16)
      : clamp(Math.round(km * 0.2), 2, 5);
    main = `Easy pace, with the final ${q} km at goal pace`;
    segs = [{ z: 'easy', km: roundHalf(km - q) }, { z: 'goalpace', km: q }];
    title = variant === 'mp' ? 'Long run with goal pace' : 'Long run, fast finish';
    t = tip('longq', weekIdx);
  }
  return wk(date, 'long', title, km, null, { warmup: null, main, cooldown: null }, 'easy', t, { segments: segs });
}

function ultraLongRun(date, min, weekIdx, back2back) {
  const title = back2back ? 'Back-to-back long run' : 'Long run (time on feet)';
  return wk(date, 'long', title, null, min, {
    warmup: null,
    main: `${fmtMin(min)} on feet at easy effort (RPE 3-4). Power-hike climbs, run the rest. Practice race fueling.`,
    cooldown: null,
  }, null, tip('ultralong', weekIdx), { segments: [{ z: 'easy', min }] });
}

function xtrainDay(date, min, weekIdx) {
  return wk(date, 'xtrain', 'Cross-training (optional)', null, min, {
    warmup: null,
    main: `${fmtMin(min)} of low-impact aerobic work: bike, swim, elliptical or brisk incline walk`,
    cooldown: null,
  }, null, tip('xtrain', weekIdx));
}

function raceDayWorkout(date, goal) {
  const g = GOALS[goal];
  return wk(date, 'race', `Race day: ${g.label}`, g.distKm, null, {
    warmup: g.ultra ? 'Easy 5-10 min walk/jog, well before the start' : '10-15 min easy jog + 4 strides',
    main: g.ultra
      ? 'Start easier than feels right, hike climbs early, fuel from the first hour.'
      : 'Even or slightly negative splits at race pace.',
    cooldown: 'Walk, eat, celebrate.',
  // 'racepace' (not the fixed marathon-effort zone) so this always matches
  // the "Projected finish" figure — see racePaceForDate.
  }, g.ultra ? null : 'racepace', tip('race', 0), { segments: [{ z: 'race', km: g.distKm }] });
}

// ---- weekly assembly ----

// Key sessions for a week, in priority order (the first goes on the earlier
// key day). Base: none early (strides/hill sprints add-ons only), then hill
// repeats. Build: threshold + VO2max (marathon: threshold + goal pace).
// Peak: race-specific. Taper: a smaller goal-pace session keeps intensity.
// Beginners, ≤3-day schedules and deload weeks get one key session.
function keyKinds(profile, phase, phaseFrac, isDeload, vol) {
  const goal = profile.goal;
  let list;
  if (GOALS[goal].ultra) {
    list = { base: ['hills'], build: ['threshold', 'hills'], peak: ['threshold', 'hills'], taper: ['threshold'] }[phase];
  } else if (phase === 'base') {
    list = phaseFrac < 0.5 ? [] : ['hills'];
  } else if (phase === 'build') {
    list = ['threshold', goal === 'marathon' ? 'goal' : 'vo2'];
  } else if (phase === 'peak') {
    list = {
      '5k': ['goal', 'speed'], '10k': ['goal', 'vo2'], half: ['goal', 'threshold'],
      marathon: ['goal', 'threshold'], fitness: ['threshold', 'vo2'],
    }[goal];
  } else {
    list = goal === 'fitness' ? ['threshold'] : ['goal'];
  }
  // One key session for beginners, ≤3-day schedules, deloads and small
  // weeks (under ~25 km two hard days would dominate the week).
  if (profile.experience === 'beginner' || profile.daysPerWeek <= 3 || isDeload || vol < 25) list = list.slice(0, 1);
  return list;
}

// Neuromuscular add-ons on easy days: strides / hill sprints.
function addOnKinds(profile, phase, phaseFrac, nKeys) {
  if (GOALS[profile.goal].ultra) return nKeys ? [] : ['strides'];
  const many = profile.daysPerWeek >= 5;
  if (phase === 'base' && phaseFrac < 0.5) {
    const hill = profile.experience !== 'beginner' && profile.daysPerWeek >= 4;
    return hill ? (many ? ['strides', 'hills'] : ['hills']) : (many ? ['strides', 'strides'] : ['strides']);
  }
  return many || nKeys < 2 ? ['strides'] : [];
}

function buildKey(kind, date, ctx, occ, advance) {
  const n = occ[kind] || 0;
  // deload/taper weeks repeat the last structure (smaller volume) instead of
  // advancing the progression
  const use = advance ? n : Math.max(0, n - 1);
  if (advance) occ[kind] = n + 1;
  switch (kind) {
    case 'threshold': return thresholdSession(date, ctx, use);
    case 'vo2': return vo2Session(date, ctx, use);
    case 'speed': return speedSession(date, ctx, use);
    case 'goal': return goalSession(date, ctx, use);
    case 'hills': return hillSession(date, ctx, use);
    case 'tt': return timeTrial(date, ctx);
    default: return null;
  }
}

// progFrac: 0→1 across the pre-taper weeks — long runs build smoothly week
// by week rather than stepping at phase boundaries.
function buildWeek(profile, weekIdx, weekStart, volKm, phase, raceDate, progFrac, o) {
  const g = GOALS[profile.goal];
  const idx = EXP_IDX[profile.experience];
  const ultra = g.ultra;
  const ctx = {
    profile, p: trainingPaces(profile.vdot || 40), beginner: profile.experience === 'beginner',
    vol: volKm, weekIdx, phase, goal: profile.goal,
  };
  const days = runDaysOf(profile);
  const L = longDayOf(profile);
  const longDay = days.includes(L) ? L : days.includes(5) ? 5 : days.includes(6) ? 6 : days[days.length - 1];
  const isDeload = o.isDeload;

  if (raceDate && mondayOf(raceDate) === weekStart) {
    return buildRaceWeek(profile, ctx, weekIdx, weekStart, volKm, phase, raceDate, days);
  }

  // Long run sizing — continuous progression toward the cap, dip in taper
  let longKm = null, longMin = null, b2bMin = null;
  const phaseProg = phase === 'taper' ? 0.55 : 0.65 + 0.35 * clamp(progFrac ?? 1, 0, 1);
  if (ultra) {
    const peakMin = ULTRA_LONG_MIN[profile.goal][idx];
    longMin = Math.round(peakMin * phaseProg * (isDeload ? 0.7 : 1) / 10) * 10;
    longMin = clamp(longMin, 80, peakMin);
    // Back-to-back second run in build/peak (not deload/taper), ramping
    // from ~35% of the long run when introduced to ~60% at peak so the
    // combined weekend load steps up gradually.
    if ((phase === 'build' || phase === 'peak') && !isDeload && profile.daysPerWeek >= 4) {
      const ramp = 0.35 + 0.25 * clamp(progFrac ?? 1, 0, 1);
      b2bMin = Math.round(longMin * ramp / 10) * 10;
    }
  } else {
    const cap = LONG_CAP_KM[profile.goal][idx];
    longKm = Math.min(cap * phaseProg, volKm * (LONG_SHARE[profile.goal] ?? 0.35));
    if (isDeload) longKm *= 0.75;
    longKm = Math.max(longKm, Math.min(volKm * 0.28, cap));
  }
  // Ultra back-to-back day: the day after a Saturday long run, the day
  // before a Sunday one (never wrapping into the start of the week).
  let b2bDay = null;
  if (b2bMin) {
    const cand = longDay === 6 ? 5 : longDay + 1;
    if (cand <= 6 && days.includes(cand)) b2bDay = cand; else b2bMin = null;
  }

  // Key sessions
  let kinds = o.tt ? ['tt'] : keyKinds(profile, phase, o.phaseFrac, isDeload, volKm);
  const free = days.filter((d) => d !== longDay && d !== b2bDay);
  // leave at least one easy day when there's room (2-day plans: long + key)
  kinds = kinds.slice(0, Math.min(kinds.length, Math.max(Math.min(1, free.length), free.length - 1), profile.daysPerWeek <= 2 ? 1 : 2));
  const keyDays = pickKeyDays(free, longDay, kinds.length);
  const advance = !isDeload && phase !== 'taper';
  const keys = new Map();
  // Size sessions on the volume this week can actually hold (few run days
  // can't absorb the nominal target), and shrink them in the taper
  // (Bosquet: cut volume, not intensity).
  let keyVol = ultra ? volKm : Math.min(volKm, longKm + (days.length - 1) * Math.min(16, longKm * 0.85));
  if (phase === 'taper') keyVol *= 0.7;
  const keyCtx = { ...ctx, vol: keyVol };
  const keyOrder = [];
  kinds.forEach((k, i) => {
    const w = buildKey(k, addDays(weekStart, keyDays[i]), keyCtx, o.occ, advance);
    if (w) { keys.set(keyDays[i], w); keyOrder.push(w); }
  });

  // Small weeks can't carry two structured sessions plus the long run —
  // drop the lower-priority one rather than overshooting the week's volume.
  const longGuess = ultra ? (longMin || 0) / 7 : longKm;
  const sumKeys = () => [...keys.values()].reduce((s, w) => s + (w.distKm || 0), 0);
  while (keys.size > 1 && longGuess + sumKeys() + 3 > volKm * 1.05) {
    const lastKind = kinds.pop();
    const day = [...keys.entries()].find(([, w]) => w === keyOrder[keyOrder.length - 1])?.[0];
    keyOrder.pop();
    if (day != null) keys.delete(day);
    if (lastKind && advance) o.occ[lastKind] = Math.max(0, (o.occ[lastKind] || 1) - 1);
  }

  // The long run stays the longest run of the week.
  const maxKey = Math.max(0, ...[...keys.values()].map((w) => w.distKm || 0));
  if (!ultra && maxKey) longKm = Math.max(longKm, Math.min(maxKey + 0.5, LONG_CAP_KM[profile.goal][idx]));

  // Easy-day budget: recovery the day after the long run, easy elsewhere.
  const recDay = !ultra ? (longDay + 1) % 7 : null;
  let easyDays = days.filter((d) => d !== longDay && d !== b2bDay && !keys.has(d));
  const weightOf = (d) => (d === recDay ? 0.65 : 1);
  const keyKm = [...keys.values()].reduce((s, w) => s + (w.distKm || 0), 0);
  const longEquivKm = ultra ? (longMin != null ? longMin / 7 : 0) : longKm; // ~7 min/km easy-effort estimate
  const remaining = volKm - longEquivKm - (b2bMin ? b2bMin / 7 : 0) - keyKm;
  // When the week's volume can't feed every easy day at least ~3 km, the
  // most crowded easy days (closest to a hard day) become rest days rather
  // than flooring everything at 3 km (which would inflate small weeks).
  const hard = [longDay, ...keys.keys()];
  const crowd = (d) => Math.min(...hard.map((h) => Math.min(cyc(d, h), cyc(h, d))));
  while (easyDays.length > 1 && remaining / easyDays.reduce((s, d) => s + weightOf(d), 0) < 3) {
    const drop = easyDays.filter((d) => d !== recDay).sort((a, b) => crowd(a) - crowd(b) || b - a)[0] ?? easyDays[0];
    easyDays = easyDays.filter((d) => d !== drop);
  }
  const wsum = easyDays.reduce((s, d) => s + weightOf(d), 0);
  // Easy runs cap at ~85% of the long run (overflow volume is dropped, not
  // dumped onto easy days).
  const easyCapKm = longKm != null ? Math.max(3, Math.min(16, longKm * 0.85)) : 16;
  const easyKm = clamp(roundHalf(wsum ? remaining / wsum : 0), 3, easyCapKm);
  const recKm = Math.max(3, roundHalf(Math.min(easyKm * 0.65, longKm != null ? longKm * 0.5 : easyKm)));

  // Add-ons go on the easy days furthest from the hard days.
  const addKinds = o.tt ? [] : addOnKinds(profile, phase, o.phaseFrac, keys.size);
  const addOn = new Map();
  for (const k of addKinds) {
    // greedy: the easy day furthest from hard days and earlier add-ons
    const taken = [...hard, ...addOn.keys()];
    const dist = (d) => Math.min(...taken.map((h) => Math.min(cyc(d, h), cyc(h, d))));
    const pick = easyDays.filter((d) => d !== recDay && !addOn.has(d)).sort((a, b) => dist(b) - dist(a) || a - b)[0];
    if (pick != null) addOn.set(pick, k);
  }

  // Injury substitution: the last plain easy day becomes optional cross-training
  const plain = easyDays.filter((d) => d !== recDay && !addOn.has(d));
  const xDay = profile.injuries.length && easyDays.length > 1 && plain.length ? plain[plain.length - 1] : null;

  const workouts = [];
  for (const d of days) {
    const date = addDays(weekStart, d);
    if (d === longDay) {
      let variant = 'easy', mpN = 0;
      if (!isDeload && (phase === 'build' || phase === 'peak') && (profile.goal === 'marathon' || profile.goal === 'half')) {
        const n = o.occ.longQ || 0;
        o.occ.longQ = n + 1;
        if (n % 2 === 1) { variant = profile.goal === 'marathon' ? 'mp' : 'ff'; mpN = Math.floor(n / 2); }
      }
      workouts.push(ultra ? ultraLongRun(date, longMin, weekIdx, false)
        : longRun(date, longKm, weekIdx, profile.goal, variant, mpN));
    } else if (d === b2bDay) {
      workouts.push(ultraLongRun(date, b2bMin, weekIdx, true));
    } else if (keys.has(d)) {
      workouts.push(keys.get(d));
    } else if (!easyDays.includes(d)) {
      continue; // volume too low to feed this day — rest
    } else if (d === xDay) {
      workouts.push(xtrainDay(date, 40, weekIdx));
    } else if (d === recDay) {
      workouts.push(easyRun(date, recKm, weekIdx, 'recovery'));
    } else if (addOn.has(d)) {
      workouts.push(stridesRun(date, easyKm, weekIdx, addOn.get(d) === 'hills' ? 'hills' : 'strides'));
    } else {
      workouts.push(easyRun(date, easyKm, weekIdx));
    }
  }
  return weekResult(weekIdx, weekStart, phase, isDeload, workouts);
}

// Race week: race-specific sharpener 3–5 days out (intensity maintained,
// volume cut — Bosquet et al. 2007), easy + strides two days out, a short
// shakeout the day before, nothing after the race.
function buildRaceWeek(profile, ctx, weekIdx, weekStart, volKm, phase, raceDate, days) {
  const g = GOALS[profile.goal];
  const R = dayIndex(raceDate);
  const before = days.filter((d) => d < R);
  const budget = volKm * 0.6; // non-race running this week
  const workouts = [raceDayWorkout(raceDate, profile.goal)];
  const sharpDay = g.ultra ? null : [R - 4, R - 3, R - 5].find((d) => before.includes(d));
  const fixed = new Map();
  if (sharpDay != null) fixed.set(sharpDay, goalSession(addDays(weekStart, sharpDay), ctx, 0, true));
  if (before.includes(R - 2) && !fixed.has(R - 2)) fixed.set(R - 2, stridesRun(addDays(weekStart, R - 2), 4, weekIdx, 'strides', 4));
  if (before.includes(R - 1) && profile.daysPerWeek >= 4) fixed.set(R - 1, stridesRun(addDays(weekStart, R - 1), 3, weekIdx, 'shakeout', 3));
  const fixedKm = [...fixed.values()].reduce((s, w) => s + w.distKm, 0);
  let easy = before.filter((d) => !fixed.has(d));
  while (easy.length > 0 && (budget - fixedKm) / easy.length < 3) easy = easy.slice(1);
  const easyKm = easy.length ? clamp(roundHalf((budget - fixedKm) / easy.length), 3, 8) : 0;
  for (const d of before) {
    if (fixed.has(d)) workouts.push(fixed.get(d));
    else if (easy.includes(d)) workouts.push(easyRun(addDays(weekStart, d), easyKm, weekIdx));
  }
  workouts.sort((a, b) => a.date.localeCompare(b.date));
  return weekResult(weekIdx, weekStart, phase, false, workouts);
}

const workoutKm = (x) => x.distKm ?? (x.durMin && x.type !== 'xtrain' ? x.durMin / 7 : 0);

// Report the volume actually scheduled (caps can absorb less than the
// nominal target), so plan rows and progress math stay honest.
function weekResult(idx, start, phase, deload, workouts) {
  return {
    idx, start, phase, deload,
    targetKm: Math.round(workouts.reduce((s, x) => s + workoutKm(x), 0)), workouts,
  };
}

// Time-trial weeks: with no race time on file, a 5K (beginners: 3 km) time
// trial in week 2 calibrates every pace in the plan; plans with 10+ pre-taper
// weeks also get a mid-plan benchmark in the deload week nearest the middle
// (fresh legs → an honest reading). Results feed the fitness model at full
// confidence.
function timeTrialWeeks(profile, totalWeeks, taperWeeks) {
  const out = new Set();
  if (GOALS[profile.goal].ultra) return out;
  const pre = totalWeeks - taperWeeks;
  if (!profile.refRace && (profile.weeklyKm || 0) >= 10 && pre >= 4) out.add(1);
  if (pre >= 10) {
    const cands = [];
    for (let w = 4; w <= pre - 2; w++) if (deloadAt(w, totalWeeks, taperWeeks)) cands.push(w);
    const target = pre * 0.55;
    const pick = cands.filter((w) => ![...out].some((t) => Math.abs(t - w) < 3))
      .sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
    if (pick != null) out.add(pick);
  }
  return out;
}

// opts (mid-plan regeneration, see replanFrom):
//   timelineStart — Monday the plan's week 1 started (defaults to this one)
//   regenFrom     — Monday of the first week to return; earlier weeks are
//                   still generated (so progression/deload rhythm continue)
//                   but discarded
//   startKm       — current training load to continue from at regenFrom
//   trimBefore    — drop workouts dated before this (already-past days)
export function generatePlan(profile, fromDate = null, opts = {}) {
  const g = GOALS[profile.goal];
  const created = fromDate || todayStr();
  const start = opts.timelineStart || mondayOf(created);
  let totalWeeks;
  if (profile.goal === 'fitness' || !profile.raceDate) {
    totalWeeks = 12;
  } else {
    totalWeeks = clamp(Math.floor(diffDays(start, profile.raceDate) / 7) + 1, 2, 32);
  }
  const taperWeeks = profile.raceDate && profile.goal !== 'fitness' ? Math.min(g.taper, Math.max(0, totalWeeks - 2)) : 0;
  const k = opts.regenFrom ? clamp(Math.round(diffDays(start, opts.regenFrom) / 7), 0, totalWeeks - 1) : 0;
  const vols = volumeSeries(profile, totalWeeks, taperWeeks, k, opts.startKm ?? null);
  const pre = totalWeeks - taperWeeks;
  const phases = Array.from({ length: totalWeeks }, (_, w) => phaseFor(w, totalWeeks, taperWeeks, g.ultra));
  const tts = timeTrialWeeks(profile, totalWeeks, taperWeeks);
  const occ = {};
  const weeks = [];
  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = addDays(start, w * 7);
    const phase = phases[w];
    const first = phases.indexOf(phase);
    const len = phases.lastIndexOf(phase) - first + 1;
    const phaseFrac = len > 1 ? (w - first) / (len - 1) : 1;
    const progFrac = pre > 1 ? w / (pre - 1) : 1;
    const isDeload = deloadAt(w, totalWeeks, taperWeeks);
    weeks.push(buildWeek(profile, w, weekStart, vols[w], phase, profile.goal === 'fitness' ? null : profile.raceDate,
      progFrac, { isDeload, phaseFrac, occ, tt: tts.has(w) }));
  }
  // Smooth actual scheduled volume: structural changes (a key session
  // appearing, caps releasing) can make the scheduled sum jump more than the
  // nominal series' ≤10% — trim easy/recovery distance to restore the
  // guarantee. Long runs and structured sessions are never touched.
  const sumKm = (ws) => ws.reduce((s, x) => s + workoutKm(x), 0);
  let prevFull = null;
  for (const wk of weeks) {
    if (wk.idx === k) prevFull = null;
    if (wk.phase === 'taper' || wk.deload) continue;
    if (prevFull != null) {
      const capKm = Math.max(prevFull * 1.10, prevFull + 1);
      let over = sumKm(wk.workouts) - capKm;
      if (over > 0.25) {
        const cuttable = wk.workouts
          .filter((x) => ['easy', 'recovery', 'strides'].includes(x.type) && x.distKm > 3)
          .sort((a, b) => b.distKm - a.distKm);
        for (const e of cuttable) {
          if (over <= 0.25) break;
          const cut = Math.min(over, e.distKm - 3);
          e.distKm = roundHalf(e.distKm - cut);
          if (e.segments?.[0]?.km != null) e.segments[0].km = e.distKm;
          over -= cut;
        }
        // Still over with every easy run at the 3 km floor (typically an easy
        // day that just reappeared as volume grew): make it a rest day.
        while (over > 0.25) {
          const drop = wk.workouts.filter((x) => (x.type === 'easy' || x.type === 'strides') && x.status === 'planned')
            .sort((a, b) => a.distKm - b.distKm)[0];
          if (!drop) break;
          wk.workouts = wk.workouts.filter((x) => x !== drop);
          over -= drop.distKm;
        }
        // Last resort with two key sessions: the smaller one becomes an easy run.
        const keysIn = wk.workouts.filter((x) => ['tempo', 'intervals', 'reps', 'mpace', 'hills'].includes(x.type));
        if (over > 0.25 && keysIn.length >= 2) {
          const k2 = keysIn.sort((a, b) => a.distKm - b.distKm)[0];
          const repl = easyRun(k2.date, Math.max(3, roundHalf(k2.distKm - over)), wk.idx);
          over -= k2.distKm - repl.distKm;
          wk.workouts = wk.workouts.map((x) => (x === k2 ? repl : x));
        }
        wk.targetKm = Math.round(sumKm(wk.workouts));
      }
    }
    prevFull = sumKm(wk.workouts);
  }

  // The plan starts the day it is generated: days earlier in the calendar
  // week never existed as training days, so they must not be scheduled (they
  // would instantly read as "missed").
  const trim = (wk, from) => {
    const kept = wk.workouts.filter((x) => x.date >= from);
    if (kept.length !== wk.workouts.length) {
      wk.workouts = kept;
      wk.targetKm = Math.round(sumKm(kept));
    }
  };
  if (k === 0 && weeks[0]) trim(weeks[0], created);
  if (opts.trimBefore && weeks[k]) trim(weeks[k], opts.trimBefore);
  return {
    createdAt: created, startDate: start, goal: profile.goal,
    raceDate: profile.goal === 'fitness' ? null : profile.raceDate || null, totalWeeks,
    weeks: weeks.slice(k),
  };
}

// ---- race-time estimation ----

// Rough fitness-gain heuristic: Daniels suggests reassessing VDOT every 4–6
// weeks of consistent training (~1 point per block for developing runners,
// diminishing sharply with experience). Rate is per training week, capped.
const VDOT_GAIN_RATE = { beginner: 0.22, intermediate: 0.13, advanced: 0.07, elite: 0.035 };
const VDOT_GAIN_CAP = { beginner: 5, intermediate: 3.5, advanced: 2, elite: 1 };

// Time estimate for any goal distance. Daniels' equations are validated up
// to the marathon; beyond it, scale the marathon prediction with a fatigue
// exponent steeper than Riegel's road value (ultra reality: terrain, fueling,
// hiking) — still a flat-course, best-case style estimate.
export function estimateRaceTime(vdot, distKm) {
  if (distKm <= 42.3) return predictRace(vdot, distKm);
  const marathon = predictRace(vdot, 42.195);
  return marathon * Math.pow(distKm / 42.195, 1.15);
}

// ---- measured fitness: reading VDOT back out of actually-logged workouts ----
//
// A workout's *target* pace is derived forward from VDOT (paceAtFraction).
// This runs the same relationship in reverse: given the actual pace a
// quality session's MAIN SET was run at (entered by the runner), and the
// fixed intensity fraction of that zone, solve for the VDOT that would have
// produced it.
// Races/time-trials (a real, known duration) use the more precise
// duration-based Daniels curve (vdotFromRace) instead of a fixed fraction.
const EFFORT_FRACTION = {
  threshold: INTENSITY_FRACTIONS.threshold,
  interval: INTENSITY_FRACTIONS.interval,
  rep: INTENSITY_FRACTIONS.rep,
  marathon: INTENSITY_FRACTIONS.marathon,
};
const EVIDENCE_HALF_LIFE_DAYS = 21; // recent efforts count more; ~3-week memory
const MIN_EFFORT_KM = 1.5;
const MIN_EFFORT_SEC = 240; // race/time trial too short to trust as a fitness signal

// Workouts generated before the structured `work` field existed: map the
// session type to the pace zone its main set was run at.
const LEGACY_WORK_KEY = { tempo: 'threshold', intervals: 'interval', reps: 'rep', mpace: 'marathon' };

// The pace zone of a workout's main set (null for sessions with no
// pace-defined main set: easy/long/hills/strides/cross-training).
export function workPaceKey(w) {
  if (w.work) return w.work.paceKey || null;
  return LEGACY_WORK_KEY[w.type] || null;
}

// How hard a correctly-executed main set should feel (RPE 1-10). Goal-pace
// effort depends on the race distance.
const EXPECTED_RPE = { threshold: 7, interval: 8, rep: 8, marathon: 5.5 };
const GOALPACE_RPE = { '5k': 8, '10k': 7.5, half: 6.5, marathon: 5.5 };
export function expectedRpe(paceKey, goal) {
  if (paceKey === 'goalpace') return GOALPACE_RPE[goal] ?? 7;
  return EXPECTED_RPE[paceKey] ?? null;
}

// VDOT implied by a main set run at `paceSec` (sec/km) in zone `paceKey`.
// Fixed-fraction zones invert paceAtFraction; goal pace inverts the race
// prediction at the goal distance (goal pace = projected race pace).
function vdotFromWorkPace(paceKey, paceSec, goal) {
  if (paceKey === 'goalpace') {
    const d = GOALS[goal]?.distKm;
    return d ? vdotFromRace(d, paceSec * d) : null;
  }
  const frac = EFFORT_FRACTION[paceKey];
  return frac ? impliedVdotFromEffort(1, paceSec, frac) : null;
}

// Fitness reading from one logged workout, or null if it carries none.
//
// Only genuine, well-defined efforts count:
//  - races and time trials: the logged distance/time IS the effort → the
//    duration-based Daniels curve, full confidence;
//  - quality sessions, ONLY when the runner entered the pace of the main
//    set. The whole-session average (warm-up + cool-down + recovery jogs)
//    says nothing about the effort — reading it at threshold/interval
//    intensity made perfectly executed sessions look 6-13 VDOT "slower".
// RPE refines the reading: a main set that felt harder than the session
// calls for was run at a higher fraction of VO2max than assumed, so the
// implied fitness is scaled down (and up if it felt easier) by ~1.3% per
// RPE point, capped at ±2 points.
export function workoutEvidence(w, goal) {
  if (w.status !== 'done' || !w.log) return null;
  const log = w.log;
  if (w.type === 'race' || w.type === 'tt') {
    if (!(log.distKm >= MIN_EFFORT_KM && log.durSec >= MIN_EFFORT_SEC)) return null;
    return { vdot: vdotFromRace(log.distKm, log.durSec), conf: 1.0, kind: w.type };
  }
  const key = workPaceKey(w);
  if (!key || !(log.workPaceSec > 0)) return null;
  let vdot = vdotFromWorkPace(key, log.workPaceSec, goal);
  if (vdot == null) return null;
  const exp = expectedRpe(key, goal);
  if (log.rpe && exp != null) vdot *= 1 - 0.013 * clamp(log.rpe - exp, -2, 2);
  return { vdot, conf: 0.6, kind: 'session' };
}

// Evidence points dated within [profile.vdotDate, asOfDate]. Anything before
// the fitness anchor is superseded by the newer race/test that set it.
function fitnessEvidencePoints(profile, plan, extraLogs, asOfDate) {
  const points = [];
  const since = profile.vdotDate || '0000-00-00';
  const add = (date, ev, title) => {
    if (!ev || date > asOfDate || date < since) return;
    if (!(ev.vdot > 15 && ev.vdot < 85)) return; // reject bad/garbled log data
    points.push({ date, title, ...ev });
  };
  const goal = plan?.goal || profile.goal;
  if (plan) {
    for (const wk of plan.weeks) {
      for (const w of wk.workouts) add(w.date, workoutEvidence(w, goal), w.title);
    }
  }
  for (const e of extraLogs || []) {
    // An unplanned run is evidence only when flagged as a race / time trial.
    if (e.race && e.distKm >= MIN_EFFORT_KM && e.durSec >= MIN_EFFORT_SEC) {
      add(e.date, { vdot: vdotFromRace(e.distKm, e.durSec), conf: 1.0, kind: 'race' }, 'Race / time trial');
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

// Assumption-based fitness on a date: entered VDOT plus the capped,
// experience-scaled weekly gain since the fitness anchor.
function baselineAt(profile, dateStr) {
  const anchor = profile.vdotDate || dateStr;
  const weeks = Math.max(0, diffDays(anchor, dateStr) / 7);
  const gain = Math.min(weeks * VDOT_GAIN_RATE[profile.experience],
    VDOT_GAIN_CAP[profile.experience]);
  return profile.vdot + gain;
}

// Full picture behind the effective VDOT on a date.
//
// Residual model: each evidence point is compared with the baseline ON ITS
// OWN DATE ("were you ahead of or behind the projection then?"). The
// recency-weighted mean residual then shifts the baseline trajectory, scaled
// by trust. This keeps the planned gain intact when projecting forward — an
// on-target session leaves the race-day projection unchanged instead of
// dragging a future date down to a past fitness level.
// Trust grows with the summed confidence of the evidence (one race ≈ 0.45,
// one paced session ≈ 0.35, capped at 0.85), so a single outlier nudges
// rather than overrides.
export function vdotBreakdown(profile, dateStr, plan = null, extraLogs = []) {
  const baseline = baselineAt(profile, dateStr);
  const points = fitnessEvidencePoints(profile, plan, extraLogs, dateStr);
  if (!points.length) {
    return { baseline, measured: null, blended: baseline, nPoints: 0, trust: 0, residual: 0, points };
  }
  let wsum = 0, rsum = 0, csum = 0;
  for (const p of points) {
    const age = Math.max(0, diffDays(p.date, dateStr));
    const w = p.conf * Math.pow(0.5, age / EVIDENCE_HALF_LIFE_DAYS);
    wsum += w;
    rsum += w * (p.vdot - baselineAt(profile, p.date));
    csum += p.conf;
  }
  const residual = rsum / wsum;
  const trust = clamp(0.2 + 0.25 * csum, 0.2, 0.85);
  return {
    baseline, measured: baseline + residual, blended: baseline + trust * residual,
    nPoints: points.length, trust, residual, points,
  };
}

// Effective VDOT on a given date: baseline projection blended with whatever
// real performance evidence has been logged by then. This is what makes
// pace targets both progress through the plan AND respond to actually
// running faster (or slower) than the plan assumed.
export function vdotForDate(profile, dateStr, plan = null, extraLogs = []) {
  return vdotBreakdown(profile, dateStr, plan, extraLogs).blended;
}

export function pacesForDate(profile, dateStr, plan = null, extraLogs = []) {
  return trainingPaces(vdotForDate(profile, dateStr, plan, extraLogs));
}

// Current-fitness estimate + projection at race day assuming the plan is
// followed. Both anchored at vdotDate so "current" also drifts up as
// training accumulates, and both reflect logged evidence if any exists.
export function projectedRaceTime(profile, plan, extraLogs = []) {
  const g = GOALS[profile.goal];
  if (!g.distKm) return null;
  const vToday = vdotForDate(profile, todayStr(), plan, extraLogs);
  const current = estimateRaceTime(vToday, g.distKm);
  const raceDate = plan?.raceDate || profile.raceDate;
  if (!raceDate || diffDays(todayStr(), raceDate) < 0) {
    return { current, projected: null, gain: 0 };
  }
  const vRace = vdotForDate(profile, raceDate, plan, extraLogs);
  return { current, projected: estimateRaceTime(vRace, g.distKm), gain: vRace - vToday };
}

// Race-day pace target (sec/km): the same distance-aware projection used for
// "Projected finish" (estimateRaceTime, not the fixed marathon-effort zone),
// so the pace on the race-day workout always agrees with the projected time
// divided by distance — a 5K race pace, not a marathon-intensity pace.
export function racePaceForDate(profile, dateStr, distKm, plan = null, extraLogs = []) {
  const vdot = vdotForDate(profile, dateStr, plan, extraLogs);
  return estimateRaceTime(vdot, distKm) / distKm;
}

// Goal pace (sec/km): the projected race-day pace for the goal distance —
// the pace goal-pace sessions rehearse all plan long, and exactly the pace
// the race-day workout and "Projected finish" use. null without a race.
export function goalPaceSec(profile, plan = null, extraLogs = []) {
  const d = GOALS[profile.goal]?.distKm;
  const raceDate = plan?.raceDate || profile.raceDate;
  if (!d || !raceDate) return null;
  return racePaceForDate(profile, raceDate, d, plan, extraLogs);
}

// Most recent full-load (non-deload, non-taper) planned week volume before
// `beforeMonday` — the load a regenerated plan continues from.
export function recentLoadKm(plan, beforeMonday) {
  if (!plan?.weeks) return null;
  const full = plan.weeks.filter((w) => w.start < beforeMonday && !w.deload && w.phase !== 'taper');
  const last = full[full.length - 1];
  return last && last.workouts.length >= 2 ? last.targetKm : null;
}

// Regenerate future weeks after a profile change, keeping history intact.
//
// - Past weeks are kept as they are. So is the current week once anything
//   in it has been logged/skipped (or with opts.keepCurrentWeek): changes then
//   apply from next Monday, so a mid-week change can't stack extra quality
//   sessions on top of ones already run.
// - The new weeks are generated on the plan's ORIGINAL timeline (same week
//   1), so week numbers, phase split, deload rhythm, session progression and
//   long-run progression all continue instead of restarting — and weekly
//   volume continues from the current planned load (opts.startKm overrides)
//   rather than dropping back to the onboarding number.
// - Anything already logged in a regenerated week is carried over.
export function replanFrom(plan, profile, fromDateStr, opts = {}) {
  if (!plan?.weeks?.length) return generatePlan(profile, fromDateStr);
  const curMonday = mondayOf(fromDateStr);
  const cur = plan.weeks.find((w) => w.start === curMonday);
  const actioned = cur && cur.workouts.some((x) => x.status !== 'planned');
  const regenMonday = cur && (actioned || opts.keepCurrentWeek) ? addDays(curMonday, 7) : curMonday;
  const raceDate = profile.goal === 'fitness' ? null : profile.raceDate;
  if (raceDate && raceDate < regenMonday) return plan; // nothing left to regenerate
  const past = plan.weeks.filter((w) => w.start < regenMonday);
  const load = opts.startKm ?? recentLoadKm(plan, regenMonday);
  const startKm = past.length && load ? load : null;
  // A general-fitness plan runs in 12-week blocks; its timeline is the
  // current block.
  const timelineStart = (!raceDate && plan.blockStart) || plan.weeks[0].start;
  const span = raceDate ? Math.floor(diffDays(timelineStart, raceDate) / 7) + 1 : 12;
  const k = Math.round(diffDays(timelineStart, regenMonday) / 7);
  const trimBefore = fromDateStr > regenMonday ? fromDateStr : null;
  let fresh;
  if (span <= 32 && k >= 0 && k < span) {
    fresh = generatePlan(profile, plan.createdAt, { timelineStart, regenFrom: regenMonday, startKm, trimBefore });
    if (!raceDate) fresh.blockStart = timelineStart;
  } else {
    // Past the end of the timeline (a finished fitness block, or a very
    // long new race timeline): a fresh block from now, continuing from the
    // current training load.
    fresh = generatePlan(profile, trimBefore || regenMonday, { startKm });
    fresh.blockStart = fresh.startDate;
  }
  for (const fw of fresh.weeks) {
    const old = plan.weeks.find((w) => w.start === fw.start);
    const keep = old ? old.workouts.filter((x) => x.status !== 'planned') : [];
    if (keep.length) {
      fw.workouts = fw.workouts.filter((x) => !keep.some((d) => d.date === x.date))
        .concat(keep).sort((a, b) => a.date.localeCompare(b.date));
    }
  }
  fresh.weeks = past.concat(fresh.weeks).map((w, i) => ({ ...w, idx: i }));
  fresh.startDate = timelineStart;
  fresh.createdAt = plan.createdAt;
  fresh.totalWeeks = fresh.weeks.length;
  return fresh;
}

// Reverse-engineered plan: given current fitness and a goal time, how long
// (and how aggressive) does the plan need to be? Inverts the same VDOT
// gain-rate heuristic the projection uses.
export function planRecommendation(goalKey, currentVdot, goalTimeSec, experience) {
  const g = GOALS[goalKey];
  if (!g.distKm) return null;
  const currentTime = estimateRaceTime(currentVdot, g.distKm);
  // find the VDOT that produces the goal time at this distance (bisection —
  // estimateRaceTime is monotonically decreasing in VDOT)
  let lo = 20, hi = 85;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (estimateRaceTime(mid, g.distKm) > goalTimeSec) lo = mid; else hi = mid;
  }
  const targetVdot = (lo + hi) / 2;
  const delta = targetVdot - currentVdot;
  const rate = VDOT_GAIN_RATE[experience];
  const cap = VDOT_GAIN_CAP[experience];
  const wk = (r) => clamp(Math.ceil(delta / r), g.minWeeks, 32);
  return {
    currentTime, targetVdot: Math.round(targetVdot * 10) / 10, delta,
    already: delta <= 0.3,
    // one training block realistically delivers ~`cap` VDOT points
    withinOneBlock: delta <= cap,
    stretch: delta > cap * 1.5,
    tiers: delta > 0.3 ? {
      conservative: wk(rate * 0.75),
      moderate: wk(rate),
      aggressive: wk(rate * 1.35),
    } : { conservative: g.minWeeks, moderate: g.minWeeks, aggressive: g.minWeeks },
  };
}

// ---- missed-workout reshuffle ----

export function missedWorkouts(plan, today = todayStr()) {
  if (!plan) return [];
  const curMonday = mondayOf(today);
  const week = plan.weeks.find((w) => w.start === curMonday);
  if (!week) return [];
  return week.workouts.filter((x) => x.date < today && x.status === 'planned' && x.type !== 'race');
}

const PRIORITY = { race: 5, long: 4, tt: 3, tempo: 3, intervals: 3, reps: 3, mpace: 3, hills: 3, strides: 2, easy: 1, recovery: 1, xtrain: 0 };

// Re-place this week's remaining sessions over the remaining days:
// priority sessions (long > quality) survive, easy runs are dropped first.
export function reshuffleWeek(plan, today = todayStr()) {
  const curMonday = mondayOf(today);
  const week = plan.weeks.find((w) => w.start === curMonday);
  if (!week) return false;

  const done = week.workouts.filter((x) => x.status !== 'planned' || x.type === 'race');
  const pending = week.workouts
    .filter((x) => x.status === 'planned' && x.type !== 'race')
    .sort((a, b) => (PRIORITY[b.type] || 0) - (PRIORITY[a.type] || 0));

  // Days still available this week (today through Sunday), excluding days
  // already holding a completed workout or the race.
  const takenDates = new Set(done.map((x) => x.date));
  const freeDates = [];
  for (let d = dayIndex(today); d < 7; d++) {
    const date = addDays(curMonday, d);
    if (!takenDates.has(date)) freeDates.push(date);
  }

  const placed = [];
  // Long run goes last-available day (weekend if possible), quality spread out.
  const long = pending.filter((x) => x.type === 'long');
  const quality = pending.filter((x) => PRIORITY[x.type] === 3);
  const rest = pending.filter((x) => x.type !== 'long' && PRIORITY[x.type] !== 3);

  const free = freeDates.slice();
  // place long runs from the end
  for (const l of long) {
    if (!free.length) break;
    l.date = free.pop();
    placed.push(l);
  }
  // quality from the front, skipping a day between hard sessions when possible
  for (const q of quality) {
    if (!free.length) { q.status = 'skipped'; placed.push(q); continue; }
    q.date = free.shift();
    placed.push(q);
    if (free.length > 1) free.shift(); // leave an easy/rest day after quality
  }
  // easy runs fill whatever remains; overflow is skipped
  for (const e of rest) {
    if (free.length) { e.date = free.shift(); placed.push(e); }
    else { e.status = 'skipped'; placed.push(e); }
  }
  // re-place skipped-quality onto days freed by dropped easies? keep simple.

  week.workouts = done.concat(placed).sort((a, b) => a.date.localeCompare(b.date));
  return true;
}

// ---- helpers used by views ----

export function findWorkout(plan, id) {
  if (!plan) return null;
  for (const w of plan.weeks) {
    const x = w.workouts.find((k) => k.id === id);
    if (x) return { week: w, workout: x };
  }
  return null;
}

export function workoutsOn(plan, dateStr) {
  if (!plan) return [];
  const res = [];
  for (const w of plan.weeks) {
    for (const x of w.workouts) if (x.date === dateStr) res.push(x);
  }
  return res;
}

export function weekOf(plan, dateStr) {
  if (!plan) return null;
  const m = mondayOf(dateStr);
  return plan.weeks.find((w) => w.start === m) || null;
}

// Today's paces (fitness drifts up with training — see vdotForDate)
export function pacesForProfile(profile, plan = null, extraLogs = []) {
  return pacesForDate(profile, todayStr(), plan, extraLogs);
}

export function goalPrediction(profile, plan = null, extraLogs = []) {
  const g = GOALS[profile.goal];
  if (!g.distKm) return null;
  return predictRace(vdotForDate(profile, todayStr(), plan, extraLogs), g.distKm);
}
