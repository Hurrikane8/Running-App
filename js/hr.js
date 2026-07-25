// Heart-rate targets.
//
// Karvonen (Heart Rate Reserve) method when resting HR is known — it scales
// the target to the individual's actual reserve (max minus resting) rather
// than a flat cut of max HR, so two runners with the same max HR but very
// different fitness/resting HR get different, more accurate targets:
//   target = ((maxHR - restingHR) * %intensity) + restingHR
// Falls back to a straight %-of-max-HR when resting HR isn't provided:
//   target = maxHR * %intensity

// 220-age is a widely used population-average estimate, not a measurement —
// published studies put its error at roughly +/-10-12 bpm for any one
// person. profile.maxHR lets someone override it with a real number from an
// actual max-effort test (lab VO2max test, all-out time trial, etc.).
export function estimateMaxHR(age) {
  return 220 - age;
}

export function resolveMaxHR(profile) {
  if (profile.maxHR) return profile.maxHR;
  if (profile.age) return estimateMaxHR(profile.age);
  return null;
}

// [lo, hi] fraction of heart-rate reserve (Karvonen) / max HR (fallback) per
// training zone — standard endurance-coaching HRR bands. 'rep' and
// 'racepace' are intentionally absent: rep efforts are too short for HR to
// reach a meaningful steady state, and race-day HR is skewed by adrenaline
// and taper, so a number there would mislead more than help.
export const HR_ZONE_FRACTIONS = {
  recovery: [0.50, 0.60],
  easy: [0.60, 0.75],
  marathon: [0.75, 0.84],
  threshold: [0.84, 0.90],
  interval: [0.90, 0.97],
};

// Target HR band (bpm) for a zone, or null if maxHR can't be resolved yet
// (no age entered and no manual override) or the zone has no HR target.
export function targetHR(profile, zoneKey) {
  const frac = HR_ZONE_FRACTIONS[zoneKey];
  if (!frac) return null;
  const maxHR = resolveMaxHR(profile);
  if (!maxHR) return null;
  const [loFrac, hiFrac] = frac;
  if (profile.restingHR) {
    const hrr = maxHR - profile.restingHR;
    return [Math.round(hrr * loFrac + profile.restingHR), Math.round(hrr * hiFrac + profile.restingHR)];
  }
  return [Math.round(maxHR * loFrac), Math.round(maxHR * hiFrac)];
}
