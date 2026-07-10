// VDOT fitness model — Daniels/Gilbert equations (Oxygen Power, 1979;
// Daniels' Running Formula) plus Riegel (1981) equivalent-race scaling.

// Oxygen cost (ml/kg/min) of running at v m/min
function vo2AtVelocity(v) {
  return -4.60 + 0.182258 * v + 0.000104 * v * v;
}

// Velocity (m/min) that demands a given VO2 — inverse of the quadratic above
function velocityAtVo2(vo2) {
  return (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (4.60 + vo2))) / (2 * 0.000104);
}

// Fraction of VO2max sustainable for a race lasting t minutes
function fracVo2max(tMin) {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
}

export function vdotFromRace(distKm, timeSec) {
  const tMin = timeSec / 60;
  const v = (distKm * 1000) / tMin;
  return vo2AtVelocity(v) / fracVo2max(tMin);
}

export const DEFAULT_VDOT = { beginner: 32, intermediate: 40, advanced: 48, elite: 56 };

// sec/km at a given fraction of VDOT
function paceAtFraction(vdot, frac) {
  const v = velocityAtVo2(vdot * frac); // m/min
  return 60000 / v; // sec/km
}

// Shared so the "measured fitness" reverse-calculation (plangen.js) uses the
// exact same fractions as the forward pace calculation — one source of truth.
export const INTENSITY_FRACTIONS = {
  easyLo: 0.62, easyHi: 0.72, marathon: 0.80, threshold: 0.87, interval: 0.985, rep: 1.07,
};

// Recovery isn't a fixed VO2max fraction like the other zones — it's defined
// relative to easy pace: slower by a fixed seconds-per-km offset, per
// common coaching guidance ("recovery pace, or easy pace and slower").
const RECOVERY_OFFSET_SEC = [30, 45]; // [fast end, slow end] slower than easy pace

// Training paces (sec/km) at Daniels' intensity fractions. easy/recovery are
// [slow, fast] bands; the rest are single targets.
export function trainingPaces(vdot) {
  const easy = [paceAtFraction(vdot, INTENSITY_FRACTIONS.easyLo), paceAtFraction(vdot, INTENSITY_FRACTIONS.easyHi)];
  const easyMid = (easy[0] + easy[1]) / 2;
  return {
    easy,
    recovery: [easyMid + RECOVERY_OFFSET_SEC[1], easyMid + RECOVERY_OFFSET_SEC[0]],
    marathon: paceAtFraction(vdot, INTENSITY_FRACTIONS.marathon),
    threshold: paceAtFraction(vdot, INTENSITY_FRACTIONS.threshold),
    interval: paceAtFraction(vdot, INTENSITY_FRACTIONS.interval),
    rep: paceAtFraction(vdot, INTENSITY_FRACTIONS.rep),
  };
}

// Implied VDOT from an actual logged effort at a known, fixed intensity
// fraction — the inverse of paceAtFraction. This is what lets real workout
// results (not just formal race times) feed back into the fitness estimate.
export function impliedVdotFromEffort(distKm, durSec, fraction) {
  const v = (distKm * 1000) / (durSec / 60); // m/min
  return vo2AtVelocity(v) / fraction;
}

// Predict race time (sec) for distKm at a given VDOT — bisection on duration.
export function predictRace(vdot, distKm) {
  let lo = 4, hi = 3000; // minutes
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = (distKm * 1000) / mid;
    const implied = vo2AtVelocity(v) / fracVo2max(mid);
    if (implied > vdot) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * 60;
}

// Riegel power law for quick equivalences
export function riegel(timeSec, fromKm, toKm) {
  return timeSec * Math.pow(toKm / fromKm, 1.06);
}
