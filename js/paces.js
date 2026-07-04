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

// Training paces (sec/km) at Daniels' intensity fractions.
export function trainingPaces(vdot) {
  return {
    easy: [paceAtFraction(vdot, 0.62), paceAtFraction(vdot, 0.72)], // range, slow→fast bound order fixed below
    marathon: paceAtFraction(vdot, 0.80),
    threshold: paceAtFraction(vdot, 0.87),
    interval: paceAtFraction(vdot, 0.985),
    rep: paceAtFraction(vdot, 1.07),
  };
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
