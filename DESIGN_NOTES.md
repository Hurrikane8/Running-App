# Stride — Design Notes

Personal running-coach PWA. Original UI and methodology; no third-party branding or
content. This note explains where the training model comes from and how the engine
turns it into a plan.

## Training methodology & sourcing

### Pace zones — Daniels/Gilbert VDOT
Fitness is summarized as a VDOT score computed from a recent race or time trial,
using the oxygen-cost and %VO2max-versus-duration equations published by Jack
Daniels & Jimmy Gilbert (*Oxygen Power*, 1979; *Daniels' Running Formula*):

- Oxygen cost of running at velocity `v` (m/min):
  `VO2 = -4.60 + 0.182258·v + 0.000104·v²`
- Fraction of VO2max sustainable for a race of duration `t` (min):
  `F = 0.8 + 0.1894393·e^(-0.012778·t) + 0.2989558·e^(-0.1932605·t)`
- `VDOT = VO2(race velocity) / F(race duration)`

Training paces run the cost equation in reverse at standard intensity fractions:
easy is a 62–72% VDOT **range** (shown as one, e.g. `5:40–6:23 /km`), recovery is
30–45 s/km slower than each end of the easy range, marathon ≈ 80%, threshold ≈
87% (comfortably hard, ~1-hour race effort), interval ≈ 98.5% (VO2max) and
repetition ≈ 107% (speed/economy).

**Goal pace** is not a fixed fraction: it is the *projected race-day pace* for
the goal distance (Daniels' race prediction at the race-day VDOT). Goal-pace
sessions, goal-pace long-run finishes, the race-week sharpener, the race-day
target and "Projected finish" all use this one number, so what you rehearse is
exactly what the plan expects you to race.

### Periodization
Classical linear periodization (Lydiard; Daniels; Bompa): **Base → Build → Peak →
Taper**, ~45/35/20 of the pre-taper weeks (ultras 50/30/20). Taper length scales
with distance: 1 week (5K/10K), 2 (half/marathon), 3 (ultras).

### Weekly structure & scheduling
Run days are chosen by the runner (or defaulted) and placed around a Saturday or
Sunday long run. Defaults: 5 days = Tue Wed Thu Sat Sun, 6 = Tue–Sun, 7 = daily.
Key sessions go on the days that **maximize the gap between hard days** (key
sessions and the long run), never the day directly before or after the long run
when the schedule allows — Tue/Thu around a Saturday long run. The day after the
long run is a recovery run. When a week's volume can't feed every easy day at
≥3 km, the most crowded easy days (closest to a hard day) become rest days.

### Session library & progression
Each key-session type progresses by *occurrence* — the n-th threshold session is a
step beyond the (n−1)-th — and is sized from Daniels' per-session volume guidance
(threshold ≤ ~10%, interval ≤ ~8%, repetition ≤ ~5% of weekly volume; floors for
low-volume weeks). First exposures start at ~80% of that cap.

| Type | Progression |
|---|---|
| Threshold | 3 × 1.6 km cruise → 20′ tempo → 4 × 1.6 km / 3 × 2 km → 25–30′ tempo or 2 × 15′ |
| VO2max | 800 m → 1000 m → 1200 m reps, 3–8 reps, 2–3 min jog |
| Speed | 200 → 300 → 400 m reps, full recovery |
| Goal pace | 5K: 5 × 1 km → 3 × 1.6 km · 10K: 1.6 → 3 km reps · Half: 2 × 3 km → 2 × 5 km → continuous · Marathon: 6 → 16 km at MP |
| Hills | 6 × 45 s → 10 × 60 s, by effort (no pace/HR — gradient makes both meaningless) |
| Add-ons | strides (6 × 20 s) and hill sprints (6 × 10 s) on easy days |

Phase menus (two key sessions for intermediate+; one for beginners, ≤3-day
schedules, weeks under ~25 km, and deload weeks):

- **Base** — early: easy volume with strides/hill-sprint add-ons only; late: hill
  repeats (Daniels Phase I/II: foundation, then light neuromuscular/strength work).
- **Build** — threshold + VO2max (marathon: threshold + marathon pace).
- **Peak** — race-specific: 5K = goal pace + speed; 10K = goal pace + VO2max;
  half and marathon = goal pace + threshold.
- **Taper** — a smaller goal-pace session keeps intensity while volume drops.
- **Race week** — sharpener 3–5 days out (e.g. 3 × 1 km at 5K pace), easy +
  strides two days out, a short shakeout the day before.

The taper follows Bosquet et al. (MSSE 2007): cut volume ~40–60%, **maintain
intensity** and frequency.

### Long runs
Long runs grow continuously toward a per-goal/experience cap and a share of the
week: 35% for 5K/10K/fitness, 40% half, 45% marathon (standard marathon plans
peak at 30–32 km on ~65–90 km weeks). Half and marathon plans alternate an easy
long run with a fast-finish / marathon-pace-finish long run in build and peak.

### Progression & recovery
- Full-load weeks grow ≤8% (6% with injury flags); a smoothing pass keeps the
  scheduled week-over-week growth within ~10% (trimming easy running, or turning
  the smaller key session into an easy run on tiny weeks).
- Every 4th week is a **deload** (~72%) — except the week right before the taper,
  which is itself the recovery.
- The week after a deload resumes one growth step above the last full-load week
  (step loading, not a violation of the 10% guideline).

### Time trials
With no race time on file, week 2 holds a 5K time trial (3 km for beginners) that
calibrates every pace in the plan. Plans with 10+ pre-taper weeks also get a
mid-plan benchmark in the deload week nearest the middle (fresh legs, honest
reading). Logged results feed the fitness model at full confidence.

### Adaptive fitness (logged evidence)
Pace targets come from the *effective* VDOT on the workout's date:

- **Baseline** — entered VDOT plus a capped, experience-scaled weekly gain
  (Daniels: reassess every 4–6 weeks, ~1 point per block for developing runners),
  anchored at the last fitness test (`vdotDate`).
- **Evidence** — only genuine efforts: races and time trials (Daniels race curve,
  full confidence), unplanned runs flagged as a race/time trial, and quality
  sessions **where the runner enters the main-set pace** (inverted at that zone's
  fraction; goal pace via the race prediction). Whole-session averages are never
  used: warm-ups, cool-downs and jog recoveries made a perfectly executed tempo
  read ~6 VDOT low. RPE versus the session's expected RPE shifts a reading by
  ~1.3% per point (±2 points max): a main set that felt far harder than it should
  was run at a higher %VO2max than assumed.
- **Residual blend** — each evidence point is compared with the baseline *on its
  own date*; the recency-weighted (21-day half-life) mean residual shifts the
  whole baseline trajectory, scaled by trust (grows with summed confidence: one
  race ≈ 0.45, capped at 0.85). On-target sessions leave the projection
  unchanged; a faster race lifts both today's paces and the race-day projection
  by the same amount. Evidence older than `vdotDate` is superseded.

### Heart rate
Optional. Karvonen (heart-rate reserve) when resting HR is known, %-of-max
otherwise; max HR = 220 − age unless overridden with a measured value. Goal-pace
sessions map to the zone for that race distance; hills, reps and race day show no
HR target.

### Mid-plan changes
Changing goal, schedule or fitness regenerates on the plan's **original
timeline**, so week numbers, phase split, deload rhythm and session/long-run
progression continue, and volume continues from the current planned load. A week
with anything already logged is kept; changes apply from next Monday. Logs in
regenerated weeks are carried over.

### Reverse-engineered plans
"I have a goal time" inverts the projection: the VDOT the goal requires minus
current VDOT, divided by the weekly gain rate, gives conservative / moderate /
aggressive plan lengths. Gaps beyond one block are flagged as multi-cycle goals.

### Ultramarathons (50K–100 mi)
Time-on-feet long runs by effort, back-to-back weekend runs in build/peak, longer
base, threshold + hill work rather than VO2max (Koop, *Training Essentials for
Ultrarunning*). Ultra tuning is lower priority than road goals.

### Injury accommodations
Niggle flags slow progression (6%), turn one easy day into optional
cross-training, and add a swap-to-low-impact note on hard sessions.

## Product decisions

- **Zero build step** — vanilla ES modules, static hosting.
- **All data local** — one versioned JSON blob in `localStorage` with sequential
  migrations (v8 upgraded existing plans to the v2 engine from the next Monday);
  JSON export/import and an .ics calendar export in Settings.
- **PWA** — cache-first service worker (installs fetch with `cache: 'reload'`),
  an "update ready → Refresh" toast, tabs in the URL hash.
- **Design system "Instrument"** — Space Grotesk numerics, one orange accent for
  the single focus element, blue/violet secondary/tertiary, a CVD-checked
  run-type palette, dark/light by system preference. Charts follow the dataviz
  method: round ticks, thin rounded marks, legends for multi-series, tap
  tooltips; the periodization chart uses a validated single-hue ordinal ramp
  (base → build → peak).
- **Coaching, not just logging** — every session shows its intensity profile and
  exact targets (per-rep splits for track reps); every log gets feedback against
  its target and zone.
