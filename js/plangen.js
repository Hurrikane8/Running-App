// Plan generation rules engine. See DESIGN_NOTES.md for the sourcing of every
// constant here (periodization splits, 80/20, 10% rule, deloads, taper lengths,
// ultra adaptations).

import { addDays, mondayOf, todayStr, diffDays, roundHalf, clamp, uid, dayIndex } from './util.js';
import { trainingPaces, predictRace } from './paces.js';

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

// Training-day templates by daysPerWeek (Mon=0..Sun=6); Saturday long run.
const DAY_TEMPLATES = {
  2: [2, 5], 3: [1, 3, 5], 4: [1, 3, 5, 6], 5: [1, 2, 4, 5, 6],
  6: [0, 1, 2, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6],
};

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

// Weekly volume series: classic 3:1 step-loading. Full-load weeks grow ≤10%
// (6–8% with injuries); every 4th week is a planned deload at ~72% of the
// current full load. The growth chain advances only on full-load weeks, so the
// week after a deload resumes one growth step (≤10%) above the previous
// full-load week — the deload itself is unloading, not the progression
// baseline. Taper multipliers at the end.
function volumeSeries(profile, totalWeeks, taperWeeks) {
  const idx = EXP_IDX[profile.experience];
  const peakCap = PEAK_KM[profile.goal][idx];
  const growth = profile.injuries.length ? 1.06 : 1.08;
  const start = clamp(profile.weeklyKm || 15, 8, peakCap);
  const taperMult = { 1: [0.55], 2: [0.7, 0.45], 3: [0.72, 0.55, 0.38] }[taperWeeks] || [];
  const vols = [];
  let chain = start;
  let lastFull = start;
  for (let w = 0; w < totalWeeks; w++) {
    const tIdx = w - (totalWeeks - taperWeeks);
    if (tIdx >= 0) {
      vols.push(lastFull * taperMult[tIdx]);
      continue;
    }
    const isDeload = w % 4 === 3;
    if (w > 0 && !isDeload) chain = Math.min(chain * growth, peakCap);
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

const TIPS = {
  easy: [
    'Easy means genuinely easy — you should be able to hold a conversation the whole way.',
    'If your watch pace looks slow today, good. Easy runs build the engine; save the effort for quality days.',
    'Relax your shoulders and shorten your stride slightly — smooth beats fast on easy days.',
  ],
  recovery: [
    'This run is about blood flow, not fitness. Slower than feels necessary is exactly right.',
    'Keep it short and gentle. If your legs feel heavy, walking breaks are fine.',
  ],
  long: [
    'Start slower than feels natural — the goal is finishing steady, not starting fast.',
    'Practice fueling: take on carbs every 30–40 minutes on runs over 90 minutes.',
    'Break the distance into thirds mentally: settle, cruise, then hold form when tired.',
  ],
  ultralong: [
    'Time on feet is the goal, not pace. Hike the hills — it is free speed later.',
    'Treat this as a fueling rehearsal: eat early, eat often, and note what sits well.',
    'Run the flats and downhills relaxed; power-hike anything steep. That is race craft.',
  ],
  tempo: [
    'Threshold effort is "comfortably hard" — you could speak a sentence, not a paragraph.',
    'Do not race the tempo. The last rep should feel like you could do one more.',
  ],
  intervals: [
    'Run the first rep as if it were the fifth — even pacing wins interval sessions.',
    'Full recovery is part of the workout. Jog it out and let your breathing settle.',
  ],
  reps: [
    'These are about speed and form, not suffering. Fast, relaxed, full recovery.',
  ],
  mpace: [
    'Goal-pace running teaches rhythm. Lock into the pace and let it feel automatic.',
  ],
  strides: [
    'Strides are 20–30 s of fast, relaxed running — build up, float, ease off. Not sprints.',
  ],
  xtrain: [
    'Bike, swim, elliptical or brisk uphill walk — aerobic effort without the impact.',
  ],
  race: [
    'Trust the training. Start conservatively, execute your fueling plan, and finish strong.',
  ],
  hills: [
    'Run hills by effort, not pace. Strong up, relaxed down, tall posture throughout.',
  ],
};

function tip(type, weekIdx) {
  const arr = TIPS[type] || TIPS.easy;
  return arr[weekIdx % arr.length];
}

// One workout object. Distances km, durations minutes.
function wk(date, type, title, distKm, durMin, structure, paceKey, theTip) {
  return {
    id: uid(), date, type, title,
    distKm: distKm != null ? roundHalf(distKm) : null,
    durMin: durMin != null ? Math.round(durMin) : null,
    structure, paceKey, tip: theTip,
    status: 'planned', log: null,
  };
}

function easyRun(date, km, weekIdx, type = 'easy') {
  const title = type === 'recovery' ? 'Recovery run' : 'Easy run';
  return wk(date, type, title, km, null, {
    warmup: null,
    main: `${type === 'recovery' ? 'Very relaxed' : 'Relaxed, conversational'} running at easy pace`,
    cooldown: null,
  }, 'easy', tip(type, weekIdx));
}

function stridesRun(date, km, weekIdx) {
  return wk(date, 'strides', 'Easy run + strides', km, null, {
    warmup: null,
    main: 'Easy pace throughout',
    cooldown: '6 × 25 s strides with full recovery, after the run',
  }, 'easy', tip('strides', weekIdx));
}

function tempoRun(date, km, weekIdx, phase) {
  const mainKm = Math.max(3, roundHalf(km * 0.55));
  const tMin = phase === 'peak' ? '2 × ' : '';
  const main = phase === 'peak'
    ? `2 × ${roundHalf(mainKm / 2)} km at threshold pace, 3 min easy jog between`
    : `${mainKm} km continuous at threshold pace`;
  return wk(date, 'tempo', 'Threshold run', km, null, {
    warmup: '2 km easy + 4 strides',
    main,
    cooldown: '1.5 km easy jog',
  }, 'threshold', tip('tempo', weekIdx));
}

function intervalRun(date, km, weekIdx) {
  const reps = clamp(Math.round(km * 0.55 / 1), 4, 6);
  return wk(date, 'intervals', 'VO2max intervals', km, null, {
    warmup: '2 km easy + 4 strides',
    main: `${reps} × 3 min at interval pace, 2–3 min jog recovery`,
    cooldown: '1.5 km easy jog',
  }, 'interval', tip('intervals', weekIdx));
}

function repRun(date, km, weekIdx) {
  return wk(date, 'reps', 'Speed reps', km, null, {
    warmup: '2 km easy + 4 strides',
    main: '8 × 200 m at repetition pace, full walk/jog recovery',
    cooldown: '1.5 km easy jog',
  }, 'rep', tip('reps', weekIdx));
}

function mpaceRun(date, km, weekIdx) {
  const mainKm = Math.max(4, roundHalf(km * 0.6));
  return wk(date, 'mpace', 'Goal-pace run', km, null, {
    warmup: '2 km easy',
    main: `${mainKm} km at marathon (goal) pace`,
    cooldown: '1 km easy jog',
  }, 'marathon', tip('mpace', weekIdx));
}

function hillsRun(date, km, weekIdx) {
  return wk(date, 'hills', 'Hill strength', km, null, {
    warmup: '2 km easy',
    main: '8 × 45 s strong uphill effort, jog-down recovery',
    cooldown: '1.5 km easy jog',
  }, 'easy', tip('hills', weekIdx));
}

function longRun(date, km, weekIdx, goal, phase) {
  let main = 'Steady, relaxed effort at easy pace throughout';
  if (goal === 'marathon' && (phase === 'build' || phase === 'peak')) {
    main = `Easy pace, with the final ${Math.max(3, Math.round(km * 0.25))} km at marathon pace`;
  } else if (goal === 'half' && phase === 'peak') {
    main = `Easy pace, with the final ${Math.max(2, Math.round(km * 0.2))} km at goal pace`;
  }
  return wk(date, 'long', 'Long run', km, null, {
    warmup: null, main, cooldown: null,
  }, 'easy', tip('long', weekIdx));
}

function ultraLongRun(date, min, weekIdx, back2back) {
  const title = back2back ? 'Back-to-back long run' : 'Long run (time on feet)';
  return wk(date, 'long', title, null, min, {
    warmup: null,
    main: `${fmtMin(min)} on feet at easy effort (RPE 3–4). Power-hike climbs, run the rest. Practice race fueling.`,
    cooldown: null,
  }, null, tip('ultralong', weekIdx));
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
  return wk(date, 'race', `Race day — ${g.label}`, g.distKm, null, {
    warmup: g.ultra ? 'Easy 5–10 min walk/jog, well before the start' : '10–15 min easy jog + 4 strides',
    main: g.ultra
      ? 'Start easier than feels right, hike climbs early, fuel from the first hour.'
      : 'Even or slightly negative splits at goal pace.',
    cooldown: 'Walk, eat, celebrate.',
  }, g.ultra ? null : 'marathon', tip('race', 0));
}

// ---- weekly assembly ----

// Decide the quality sessions for a week.
function qualityTypesFor(goal, phase, experience, maxQuality) {
  if (maxQuality === 0 || phase === 'taper') return phase === 'taper' && maxQuality > 0 ? ['strides'] : [];
  const beginnerish = experience === 'beginner';
  const ultra = GOALS[goal].ultra;
  let list;
  if (ultra) {
    // Ultras: steady/hill strength over VO2 work
    list = { base: ['hills'], build: ['tempo'], peak: ['tempo'] }[phase] || [];
    if (!beginnerish && phase !== 'base') list = list.concat(['hills']);
  } else if (goal === '5k' || goal === '10k') {
    list = { base: ['strides', 'hills'], build: ['tempo', 'intervals'], peak: ['intervals', 'reps'] }[phase];
  } else if (goal === 'half') {
    list = { base: ['strides', 'hills'], build: ['tempo', 'intervals'], peak: ['tempo', 'intervals'] }[phase];
  } else if (goal === 'marathon') {
    list = { base: ['strides', 'hills'], build: ['tempo', 'mpace'], peak: ['mpace', 'tempo'] }[phase];
  } else { // fitness
    list = { base: ['strides'], build: ['tempo', 'intervals'], peak: ['tempo', 'intervals'] }[phase];
  }
  return list.slice(0, maxQuality);
}

function buildWeek(profile, weekIdx, weekStart, volKm, phase, totalWeeks, raceDate) {
  const g = GOALS[profile.goal];
  const idx = EXP_IDX[profile.experience];
  const days = DAY_TEMPLATES[profile.daysPerWeek].slice();
  const isDeload = phase !== 'taper' && weekIdx % 4 === 3;
  const workouts = [];

  // Quality budget: beginner 1, others 2 (needs ≥4 run days for 2); base phase max 1.
  let maxQ = profile.experience === 'beginner' ? 1 : 2;
  if (profile.daysPerWeek <= 3) maxQ = 1;
  if (phase === 'base') maxQ = Math.min(maxQ, 1);
  if (isDeload) maxQ = Math.min(maxQ, 1);
  const qTypes = qualityTypesFor(profile.goal, phase, profile.experience, maxQ);

  // Long run sizing
  const ultra = g.ultra;
  let longKm = null, longMin = null, b2bMin = null;
  const phaseProg = { base: 0.7, build: 0.9, peak: 1.0, taper: 0.55 }[phase];
  if (ultra) {
    const peakMin = ULTRA_LONG_MIN[profile.goal][idx];
    longMin = Math.round(peakMin * phaseProg * (isDeload ? 0.7 : 1) / 10) * 10;
    longMin = clamp(longMin, 80, peakMin);
    // Back-to-back second run in build/peak (not deload/taper)
    if ((phase === 'build' || phase === 'peak') && !isDeload && profile.daysPerWeek >= 4) {
      b2bMin = Math.round(longMin * 0.55 / 10) * 10;
    }
  } else {
    const cap = LONG_CAP_KM[profile.goal][idx];
    longKm = Math.min(cap * phaseProg, volKm * 0.35);
    if (isDeload) longKm *= 0.75;
    longKm = Math.max(longKm, Math.min(volKm * 0.28, cap));
  }

  // Race week: place the race, taper everything else around it.
  const raceThisWeek = raceDate && mondayOf(raceDate) === weekStart;

  // Assign days: Sat(5)=long, Sun(6)=b2b/recovery, quality on first non-adjacent days.
  const longDay = days.includes(5) ? 5 : days[days.length - 1];
  const qualityDays = days.filter((d) => d !== longDay && d !== 6).slice(0, 2);
  // keep a day between the two quality sessions where possible
  if (qualityDays.length === 2 && qualityDays[1] - qualityDays[0] < 2 && days.length > 3) {
    const alt = days.find((d) => d > qualityDays[0] + 1 && d !== longDay && d !== 6);
    if (alt != null) qualityDays[1] = alt;
  }

  // Volume bookkeeping (km-equivalent; ultra time converted at rough easy pace later)
  const easyDays = days.filter((d) => d !== longDay && !qualityDays.slice(0, qTypes.length).includes(d));

  // Estimate quality session distance: ~15% of week each, clamped
  const qKm = clamp(roundHalf(volKm * 0.16), 5, 14);
  const longEquivKm = ultra ? (longMin != null ? longMin / 7 : 0) : longKm; // ~7 min/km easy-effort estimate
  const b2bEquivKm = b2bMin ? b2bMin / 7 : 0;
  let remaining = volKm - longEquivKm - b2bEquivKm - qTypes.length * qKm;
  const nEasy = easyDays.length - (b2bMin && easyDays.includes(6) ? 1 : 0);
  let easyKm = nEasy > 0 ? remaining / nEasy : 0;
  easyKm = clamp(roundHalf(easyKm), 3, 16);

  // Injury substitution: convert the last easy day to optional cross-training
  const xtrainDayIdx = profile.injuries.length && easyDays.length > 1
    ? easyDays[easyDays.length - 1] === 6 && b2bMin ? easyDays[easyDays.length - 2] : easyDays[easyDays.length - 1]
    : null;

  let qUsed = 0;
  for (const d of days) {
    const date = addDays(weekStart, d);
    if (raceDate && date === raceDate && raceThisWeek) {
      workouts.push(raceDayWorkout(date, profile.goal));
      continue;
    }
    if (raceThisWeek && diffDays(date, raceDate) < 0) continue; // nothing after race
    if (raceThisWeek && diffDays(date, raceDate) <= 2 && diffDays(date, raceDate) > 0) {
      // day or two before race: short shakeout
      workouts.push(stridesRun(date, 4, weekIdx));
      continue;
    }
    if (d === longDay && !raceThisWeek) {
      workouts.push(ultra ? ultraLongRun(date, longMin, weekIdx, false)
                          : longRun(date, longKm, weekIdx, profile.goal, phase));
      continue;
    }
    if (d === 6 && b2bMin && !raceThisWeek) {
      workouts.push(ultraLongRun(date, b2bMin, weekIdx, true));
      continue;
    }
    if (qualityDays.includes(d) && qUsed < qTypes.length && !raceThisWeek) {
      const t = qTypes[qUsed++];
      const builders = {
        tempo: () => tempoRun(date, qKm, weekIdx, phase),
        intervals: () => intervalRun(date, qKm, weekIdx),
        reps: () => repRun(date, Math.min(qKm, 9), weekIdx),
        mpace: () => mpaceRun(date, qKm, weekIdx),
        hills: () => hillsRun(date, Math.min(qKm, 10), weekIdx),
        strides: () => stridesRun(date, easyKm, weekIdx),
      };
      workouts.push(builders[t]());
      continue;
    }
    if (d === xtrainDayIdx) {
      workouts.push(xtrainDay(date, 40, weekIdx));
      continue;
    }
    // Recovery run the day after the long run for 6–7 day schedules
    const type = d === 0 && profile.daysPerWeek >= 6 ? 'recovery' : 'easy';
    workouts.push(easyRun(date, type === 'recovery' ? Math.max(3, roundHalf(easyKm * 0.7)) : easyKm, weekIdx, type));
  }

  return {
    idx: weekIdx, start: weekStart, phase, deload: isDeload,
    targetKm: Math.round(volKm), workouts,
  };
}

export function generatePlan(profile, fromDate = null) {
  const g = GOALS[profile.goal];
  const start = mondayOf(fromDate || todayStr());
  let totalWeeks;
  if (profile.goal === 'fitness' || !profile.raceDate) {
    totalWeeks = 12;
  } else {
    totalWeeks = clamp(Math.floor(diffDays(start, profile.raceDate) / 7) + 1, 2, 32);
  }
  const taperWeeks = profile.raceDate ? Math.min(g.taper, Math.max(0, totalWeeks - 2)) : 0;
  const vols = volumeSeries(profile, totalWeeks, taperWeeks);
  const weeks = [];
  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = addDays(start, w * 7);
    const phase = profile.raceDate || profile.goal !== 'fitness'
      ? phaseFor(w, totalWeeks, taperWeeks, g.ultra)
      : phaseFor(w, totalWeeks, 0, false);
    weeks.push(buildWeek(profile, w, weekStart, vols[w], phase, totalWeeks, profile.raceDate));
  }
  return {
    createdAt: todayStr(), startDate: start, goal: profile.goal,
    raceDate: profile.raceDate || null, totalWeeks, weeks,
  };
}

// Regenerate future weeks (from the current week) after a profile change,
// keeping past weeks and their logs intact.
export function replanFrom(plan, profile, fromDateStr) {
  const curMonday = mondayOf(fromDateStr);
  const past = plan ? plan.weeks.filter((w) => w.start < curMonday) : [];
  const fresh = generatePlan(profile, fromDateStr);
  // Preserve logs for already-actioned workouts earlier in the current week
  if (plan) {
    const cur = plan.weeks.find((w) => w.start === curMonday);
    const freshCur = fresh.weeks.find((w) => w.start === curMonday);
    if (cur && freshCur) {
      const done = cur.workouts.filter((x) => x.status !== 'planned');
      freshCur.workouts = freshCur.workouts.filter(
        (x) => !done.some((d) => d.date === x.date)
      ).concat(done).sort((a, b) => a.date.localeCompare(b.date));
    }
  }
  fresh.weeks = past.concat(fresh.weeks.map((w, i) => ({ ...w })));
  fresh.startDate = past.length ? past[0].start : fresh.startDate;
  return fresh;
}

// ---- missed-workout reshuffle ----

export function missedWorkouts(plan, today = todayStr()) {
  if (!plan) return [];
  const curMonday = mondayOf(today);
  const week = plan.weeks.find((w) => w.start === curMonday);
  if (!week) return [];
  return week.workouts.filter((x) => x.date < today && x.status === 'planned' && x.type !== 'race');
}

const PRIORITY = { race: 5, long: 4, tempo: 3, intervals: 3, reps: 3, mpace: 3, hills: 3, strides: 2, easy: 1, recovery: 1, xtrain: 0 };

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

export function pacesForProfile(profile) {
  return trainingPaces(profile.vdot);
}

export function goalPrediction(profile) {
  const g = GOALS[profile.goal];
  if (!g.distKm) return null;
  return predictRace(profile.vdot, g.distKm);
}
