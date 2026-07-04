# Stride — Design Notes

Personal running-coach PWA. Original UI and methodology; no third-party branding or
content. This note explains where the training model comes from before any code.

## Training methodology & sourcing

The plan generator is a rules engine built on long-established, published training
science — not ad-hoc heuristics:

### Pace zones — Daniels/Gilbert VDOT
Fitness is summarized as a VDOT score computed from a recent race or time trial,
using the oxygen-cost and %VO2max-versus-duration equations published by Jack
Daniels & Jimmy Gilbert (*Oxygen Power*, 1979; *Daniels' Running Formula*):

- Oxygen cost of running at velocity `v` (m/min):
  `VO2 = -4.60 + 0.182258·v + 0.000104·v²`
- Fraction of VO2max sustainable for a race of duration `t` (min):
  `F = 0.8 + 0.1894393·e^(-0.012778·t) + 0.2989558·e^(-0.1932605·t)`
- `VDOT = VO2(race velocity) / F(race duration)`

Training paces are derived by running the cost equation in reverse at standard
intensity fractions from *Daniels' Running Formula*: Easy 59–74% of VDOT,
Marathon ≈ 75–84%, Threshold ≈ 86–88% (comfortably-hard, ~1-hour race effort),
Interval ≈ 97–100% (VO2max, 3–5 min reps), Repetition ≈ 105–110% (speed/economy).
Equivalent race predictions use the Riegel power law `t2 = t1·(d2/d1)^1.06`
(Riegel, 1981). With no race time available, a conservative default VDOT is
assigned per experience level and the user is nudged to run a time trial.

### Structure — periodization
Plans follow classical linear periodization (Lydiard; Daniels; Bompa):
**Base → Build → Peak → Taper**, split roughly 45/35/20 of the pre-taper weeks
(ultras: 50/30/20 with a longer, more conservative base). Taper length scales
with race distance: 1 week (5K/10K), 2 weeks (half/marathon), 3 weeks (ultras) —
consistent with meta-analysis findings that ~2 weeks of 40–60% volume reduction
with maintained intensity optimizes performance (Bosquet et al., MSSE 2007).

### Intensity distribution — 80/20 polarized
At least ~80% of weekly volume is at easy effort, per Seiler's research on
intensity distribution in elite endurance athletes (Seiler & Kjerland 2006;
Stöggl & Sperlich 2014). Enforced structurally: beginners get at most one quality
session per week, everyone else at most two, and quality-session volume is capped
as a fraction of the week.

### Progression & recovery
- Weekly volume increases are capped at ~8–10% (the widely used 10% guideline;
  progression is the classic overload-recovery cycle from Bompa's periodization
  model), reduced further when injury flags are set.
- Every 4th week is a **deload** (~70–75% volume) — the standard 3:1
  load:recovery mesocycle. This is deliberate step-loading: the ~10% cap
  applies between *full-load* weeks, so the week after a deload resumes one
  growth step above the previous full-load week. The apparent large jump out
  of a recovery week is the return to the loading trajectory, not a
  progression violation.
- The long run is capped at ~30–35% of weekly volume.

### Ultramarathon adaptations (50K–100 mi)
Grounded in accepted ultra coaching practice (e.g. Koop, *Training Essentials for
Ultrarunning*; Krissy Moehl's plan structures):
- Long efforts are prescribed by **time on feet and effort (RPE)**, not pace.
- **Back-to-back weekend long runs** in build/peak to accumulate fatigue-resistant
  volume without single monster runs.
- Longer minimum plan lengths, larger base fraction, less VO2max work (intensity
  is mostly steady-state/tempo and hills), plus fueling- and hiking-practice cues.

### Race-time projection
The Plan tab shows two estimates: today's fitness (VDOT → Daniels equivalent
race time) and a race-day projection. The projection adds a conservative
training-gain heuristic — Daniels recommends reassessing VDOT every 4–6 weeks
of consistent training, with roughly a point per block for developing runners
and sharply diminishing returns with experience — implemented as a per-week
gain rate by experience level, capped. Distances beyond the marathon scale the
marathon prediction with a fatigue exponent steeper than Riegel's road value
(1.15), and are labeled as flat-course estimates since terrain dominates ultra
finish times.

### Injury accommodations
If the user flags a current niggle, the generator: caps weekly progression at 6–8%,
converts one easy day to an optional low-impact cross-training day, and attaches
low-impact alternatives to quality sessions (e.g. uphill treadmill walking,
elliptical intervals) — consistent with standard return-to-running guidance of
maintaining aerobic load while reducing impact exposure.

## Product decisions

- **Zero build step**: vanilla ES modules, static hosting anywhere.
- **All data local**: one versioned JSON blob in `localStorage`; export/import via
  Settings for backup.
- **PWA**: manifest + cache-first service worker; standalone/full-screen on iOS
  with safe-area handling.
- **Distances stored in km internally**, rendered in the user's preferred units.
- **Original visual design**: warm paper/ink palette with an ember-orange accent,
  system type stack, no resemblance to any commercial training app.
