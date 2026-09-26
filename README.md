# Stride — Personal Running Coach (PWA)

An adaptive running-coach web app for personal use. Interviews you once, builds a
periodized training plan grounded in published exercise science, and delivers it
day by day — with logging, rescheduling, plan adaptation, and progress tracking.
Everything runs client-side; all data stays in your browser.

**Methodology & design rationale:** see [DESIGN_NOTES.md](DESIGN_NOTES.md).

## Features

- **Onboarding interview**: goal (5K to 100-mile ultra, or general fitness), race
  date or goal time, experience, current volume, a recent race (optional; otherwise
  a week-2 time trial calibrates you), which days you can run and your long-run day,
  injury flags, km/mi.
- **Training engine**: VDOT pace zones; base/build/peak/taper periodization; key
  sessions spaced away from each other and from the long run; progressive
  threshold, VO2max, speed, hill and race-specific goal-pace sessions sized by
  Daniels' volume guidance; 3:1 deloads (never right before the taper); a taper
  that keeps intensity; race-week sharpener and shakeout; time trials.
- **Adaptive fitness**: races, time trials and main-set paces you log recalibrate
  every pace target and the race-day projection.
- **Today**: the session with its intensity profile, pace/HR targets and per-rep
  splits, week-at-a-glance, coaching feedback after you log.
- **Week**: planned vs actual, unplanned runs, missed sessions, drag or tap-to-move
  rescheduling, a missed-workout reshuffle that protects key sessions.
- **Plan**: race-day projection, periodization chart, tappable week-by-week list,
  session guide.
- **Progress**: fitness trend and race equivalents, logged vs planned volume,
  consistency, 80/20 intensity split, best efforts, records.
- **Mid-plan changes**: change goal, schedule or fitness and the rest of the plan
  regenerates while keeping your progression and history.
- **Calendar export (.ics)**, JSON backup/restore, optional heart-rate zones
  (Karvonen).
- **PWA**: installable, works offline, update prompt, full-screen on iOS.

## Tests

`npm test` (plan-engine property sweep and unit checks) and `npm run test:e2e`
(browser flows; needs `npm run serve`). See [tests/README.md](tests/README.md).

## Run it

Any static file server works (no build step):

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

To install on a phone, serve over HTTPS (e.g. GitHub Pages), open it in the
browser, then *Add to Home Screen*.

## Stack

Vanilla ES modules + hand-rolled SVG charts. No dependencies, no backend, no
accounts. State is one versioned JSON blob in `localStorage` (export/import
available in Settings).
