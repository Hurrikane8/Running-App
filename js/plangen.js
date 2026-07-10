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
  // Weekly volume is capped by what the schedule can actually absorb: the
  // long run at its cap plus each remaining day at an easy run that stays
  // shorter than the long run. Without this, short-race plans with high
  // entered mileage dump leftover volume into oversized "easy" runs.
  let peakCap = PEAK_KM[profile.goal][idx];
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
  ultralong: [
    'Time on feet is the goal, not pace. Hike the hills. It is free speed later.',
    'Treat this as a fueling rehearsal: eat early, eat often, and note what sits well.',
    'Run the flats and downhills relaxed; power-hike anything steep. That is race craft.',
  ],
  tempo: [
    'Threshold effort is "comfortably hard": you could speak a sentence, not a paragraph.',
    'Do not race the tempo. The last rep should feel like you could do one more.',
  ],
  intervals: [
    'Run the first rep as if it were the fifth. Even pacing wins interval sessions.',
    'Full recovery is part of the workout. Jog it out and let your breathing settle.',
  ],
  reps: [
    'These are about speed and form, not suffering. Fast, relaxed, full recovery.',
  ],
  mpace: [
    'Goal-pace running teaches rhythm. Lock into the pace and let it feel automatic.',
  ],
  strides: [
    'Strides are 20-30 s of fast, relaxed running: build up, float, ease off. Not sprints.',
  ],
  xtrain: [
    'Bike, swim, elliptical or brisk uphill walk: aerobic effort without the impact.',
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
    main: type === 'recovery' ? 'Very relaxed running at recovery pace' : 'Relaxed, conversational running at easy pace',
    cooldown: null,
  }, type === 'recovery' ? 'recovery' : 'easy', tip(type, weekIdx));
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
    main: `${reps} × 3 min at interval pace, 2-3 min jog recovery`,
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
    main: `${fmtMin(min)} on feet at easy effort (RPE 3-4). Power-hike climbs, run the rest. Practice race fueling.`,
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
  return wk(date, 'race', `Race day: ${g.label}`, g.distKm, null, {
    warmup: g.ultra ? 'Easy 5-10 min walk/jog, well before the start' : '10-15 min easy jog + 4 strides',
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

// progFrac: 0→1 across the pre-taper weeks — long runs build smoothly week
// by week rather than stepping at phase boundaries.
function buildWeek(profile, weekIdx, weekStart, volKm, phase, totalWeeks, raceDate, progFrac) {
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

  // Long run sizing — continuous progression toward the cap, dip in taper
  const ultra = g.ultra;
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
    longKm = Math.min(cap * phaseProg, volKm * 0.35);
    if (isDeload) longKm *= 0.75;
    longKm = Math.max(longKm, Math.min(volKm * 0.28, cap));
  }

  // Race week: place the race, taper everything else around it. The race
  // day itself is always scheduled, even when it isn't a usual training day.
  const raceThisWeek = raceDate && mondayOf(raceDate) === weekStart;
  if (raceThisWeek) {
    const raceDow = dayIndex(raceDate);
    if (!days.includes(raceDow)) days.push(raceDow);
    days.sort((a, b) => a - b);
  }

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
  const qKm = clamp(roundHalf(volKm * 0.16), 4, 14);
  // Long run stays the longest session of the week, even on tiny deload
  // weeks where the quality-session floor would otherwise overtake it.
  if (!ultra && qTypes.length) {
    longKm = Math.max(longKm, Math.min(qKm + 0.5, LONG_CAP_KM[profile.goal][idx]));
  }
  const longEquivKm = ultra ? (longMin != null ? longMin / 7 : 0) : longKm; // ~7 min/km easy-effort estimate
  const b2bEquivKm = b2bMin ? b2bMin / 7 : 0;
  let remaining = volKm - longEquivKm - b2bEquivKm - qTypes.length * qKm;
  const nEasy = easyDays.length - (b2bMin && easyDays.includes(6) ? 1 : 0);
  // When the week's volume can't feed every scheduled day at least ~3 km,
  // surplus easy days become rest days rather than flooring everything at
  // 3 km (which would silently inflate low-volume weeks).
  let usableEasy = nEasy;
  while (usableEasy > 1 && remaining / usableEasy < 3) usableEasy--;
  const skipDays = new Set(
    nEasy > usableEasy
      ? easyDays.filter((d) => !(b2bMin && d === 6)).slice(usableEasy - nEasy)
      : []);
  let easyKm = usableEasy > 0 ? remaining / usableEasy : 0;
  // The long run must stay the longest run of the week: easy runs cap at
  // ~85% of it (overflow volume is dropped, not dumped onto easy days).
  const easyCapKm = longKm != null ? Math.max(4, Math.min(16, longKm * 0.85)) : 16;
  easyKm = clamp(roundHalf(easyKm), 3, easyCapKm);

  // Injury substitution: convert the last easy day to optional cross-training
  const liveEasy = easyDays.filter((d) => !skipDays.has(d));
  const xtrainDayIdx = profile.injuries.length && liveEasy.length > 1
    ? liveEasy[liveEasy.length - 1] === 6 && b2bMin ? liveEasy[liveEasy.length - 2] : liveEasy[liveEasy.length - 1]
    : null;

  let qUsed = 0;
  for (const d of days) {
    const date = addDays(weekStart, d);
    // Race day is always scheduled, even if the volume budget would
    // otherwise have turned this into a rest day — check before skipDays.
    if (raceDate && date === raceDate && raceThisWeek) {
      workouts.push(raceDayWorkout(date, profile.goal));
      continue;
    }
    if (skipDays.has(d)) continue; // volume too low to feed this day — rest
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
    // Recovery runs bracket the long run: the Sunday directly after it
    // (non-ultra — ultras deliberately stack back-to-back volume) and the
    // Monday after the weekend for 6–7 day schedules.
    const afterLong = d === 6 && longDay === 5 && !ultra;
    const type = afterLong || (d === 0 && profile.daysPerWeek >= 6) ? 'recovery' : 'easy';
    const km = type === 'recovery'
      ? Math.max(3, roundHalf(Math.min(easyKm * 0.65, longKm != null ? longKm * 0.5 : easyKm)))
      : easyKm;
    workouts.push(easyRun(date, km, weekIdx, type));
  }

  // Report the volume actually scheduled (caps can absorb less than the
  // nominal target), so plan rows and progress math stay honest.
  const scheduledKm = workouts.reduce(
    (s, x) => s + (x.distKm ?? (x.durMin && x.type !== 'xtrain' ? x.durMin / 7 : 0)), 0);
  return {
    idx: weekIdx, start: weekStart, phase, deload: isDeload,
    targetKm: Math.round(scheduledKm), workouts,
  };
}

export function generatePlan(profile, fromDate = null) {
  const g = GOALS[profile.goal];
  const created = fromDate || todayStr();
  const start = mondayOf(created);
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
    const pre = totalWeeks - taperWeeks;
    const progFrac = pre > 1 ? w / (pre - 1) : 1;
    weeks.push(buildWeek(profile, w, weekStart, vols[w], phase, totalWeeks, profile.raceDate, progFrac));
  }
  // Smooth actual scheduled volume: structural changes (a second quality
  // session appearing, caps releasing) can make the scheduled sum jump more
  // than the nominal series' ≤10% — trim easy/recovery distance to restore
  // the guarantee. Long runs and quality sessions are never touched.
  const sumKm = (ws) => ws.reduce(
    (s, x) => s + (x.distKm ?? (x.durMin && x.type !== 'xtrain' ? x.durMin / 7 : 0)), 0);
  let prevFull = null;
  for (const wk of weeks) {
    if (wk.phase === 'taper' || wk.deload) continue;
    if (prevFull != null) {
      const capKm = Math.max(prevFull * 1.10, prevFull + 1);
      let over = sumKm(wk.workouts) - capKm;
      if (over > 0.25) {
        // easy/recovery first (floor 3), then quality (floor 4); never long
        const stages = [
          [(x) => ['easy', 'recovery', 'strides'].includes(x.type), 3],
          [(x) => ['tempo', 'intervals', 'reps', 'mpace', 'hills'].includes(x.type), 4],
        ];
        for (const [match, floor] of stages) {
          const cuttable = wk.workouts
            .filter((x) => match(x) && x.distKm > floor)
            .sort((a, b) => b.distKm - a.distKm);
          for (const e of cuttable) {
            if (over <= 0.25) break;
            const cut = Math.min(over, e.distKm - floor);
            e.distKm = roundHalf(e.distKm - cut);
            over -= cut;
          }
          if (over <= 0.25) break;
        }
        wk.targetKm = Math.round(sumKm(wk.workouts));
      }
    }
    prevFull = sumKm(wk.workouts);
  }

  // The plan starts the day it is generated: days earlier in the calendar
  // week never existed as training days, so they must not be scheduled (they
  // would instantly read as "missed").
  const first = weeks[0];
  if (first) {
    const kept = first.workouts.filter((x) => x.date >= created);
    if (kept.length !== first.workouts.length) {
      first.workouts = kept;
      first.targetKm = Math.round(kept.reduce(
        (s, x) => s + (x.distKm ?? (x.durMin ? x.durMin / 7 : 0)), 0));
    }
  }
  return {
    createdAt: created, startDate: start, goal: profile.goal,
    raceDate: profile.raceDate || null, totalWeeks, weeks,
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
// logged quality session was run at, and the fixed intensity fraction that
// session type represents, solve for the VDOT that would have produced it.
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
const MIN_EFFORT_SEC = 240; // effort too short to trust as a fitness signal

// Easy/long/recovery runs are deliberately run well below capacity, so their
// pace says little about fitness — only genuine efforts (quality sessions,
// races, and near-maximal ad-hoc runs) are used as evidence.
function fitnessEvidencePoints(plan, extraLogs, asOfDate) {
  const points = [];
  const add = (date, vdot, conf) => {
    if (date > asOfDate) return;
    if (!(vdot > 15 && vdot < 85)) return; // reject bad/garbled log data
    points.push({ date, vdot, conf });
  };
  if (plan) {
    for (const wk of plan.weeks) {
      for (const w of wk.workouts) {
        if (w.status !== 'done' || !w.log?.distKm || !w.log?.durSec) continue;
        if (w.log.distKm < MIN_EFFORT_KM || w.log.durSec < MIN_EFFORT_SEC) continue;
        if (w.type === 'race') add(w.date, vdotFromRace(w.log.distKm, w.log.durSec), 1.0);
        else if (EFFORT_FRACTION[w.paceKey]) {
          add(w.date, impliedVdotFromEffort(w.log.distKm, w.log.durSec, EFFORT_FRACTION[w.paceKey]), 0.6);
        }
      }
    }
  }
  for (const e of extraLogs || []) {
    // An unplanned run only tells us fitness if it was run near-maximally —
    // treat a high-RPE ad-hoc effort as an informal time trial.
    if (e.rpe >= 9 && e.distKm >= MIN_EFFORT_KM && e.durSec >= MIN_EFFORT_SEC) {
      add(e.date, vdotFromRace(e.distKm, e.durSec), 0.8);
    }
  }
  return points;
}

// Full picture behind the effective VDOT on a date: the assumption-based
// baseline (entered fitness + capped generic weekly gain, same as before),
// the recency-weighted VDOT implied by real logged efforts (null if none
// exist yet), and the blend actually used. Trust in the measured signal
// grows with how much evidence exists, so one lucky or bad session can nudge
// the estimate but never fully override it.
export function vdotBreakdown(profile, dateStr, plan = null, extraLogs = []) {
  const anchor = profile.vdotDate || dateStr;
  const weeks = Math.max(0, diffDays(anchor, dateStr) / 7);
  const gain = Math.min(weeks * VDOT_GAIN_RATE[profile.experience],
    VDOT_GAIN_CAP[profile.experience]);
  const baseline = profile.vdot + gain;

  const points = fitnessEvidencePoints(plan, extraLogs, dateStr);
  if (!points.length) return { baseline, measured: null, blended: baseline, nPoints: 0, trust: 0 };

  let wsum = 0, vsum = 0;
  for (const p of points) {
    const age = Math.max(0, diffDays(p.date, dateStr));
    const recency = Math.pow(0.5, age / EVIDENCE_HALF_LIFE_DAYS);
    const w = p.conf * recency;
    wsum += w; vsum += w * p.vdot;
  }
  const measured = vsum / wsum;
  const trust = clamp(0.25 + points.length * 0.15, 0.25, 0.85);
  return { baseline, measured, blended: trust * measured + (1 - trust) * baseline, nPoints: points.length, trust };
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

// Today's paces (fitness drifts up with training — see vdotForDate)
export function pacesForProfile(profile, plan = null, extraLogs = []) {
  return pacesForDate(profile, todayStr(), plan, extraLogs);
}

export function goalPrediction(profile, plan = null, extraLogs = []) {
  const g = GOALS[profile.goal];
  if (!g.distKm) return null;
  return predictRace(vdotForDate(profile, todayStr(), plan, extraLogs), g.distKm);
}
