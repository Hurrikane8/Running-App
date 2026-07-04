# Stride — Personal Running Coach (PWA)

An adaptive running-coach web app for personal use. Interviews you once, builds a
periodized training plan grounded in published exercise science, and delivers it
day by day — with logging, rescheduling, plan adaptation, and progress tracking.
Everything runs client-side; all data stays in your browser.

**Methodology & design rationale:** see [DESIGN_NOTES.md](DESIGN_NOTES.md).

## Features

- **Onboarding interview** — goal (5K → 100-mile ultra, or general fitness), race
  date, experience, current volume, recent race/time trial, run days per week,
  injury flags, km/mi.
- **Evidence-based plan generation** — VDOT pace zones, base/build/peak/taper
  periodization, 80/20 intensity, ≤10% weekly progression, deload every 4th week,
  ultra-specific back-to-back time-on-feet long runs.
- **Today view** — session structure (warm-up / main set / cool-down) with your
  personal pace targets and a coaching tip.
- **Week view** — full week at a glance, drag or tap-to-move rescheduling,
  missed-workout reshuffle that protects key sessions.
- **Logging** — distance, time, RPE, notes; ad-hoc runs too.
- **Progress** — weekly volume chart, pace trend, personal records.
- **Mid-plan adaptation** — change goal/race date/fitness in Settings and the
  future plan regenerates; history is kept.
- **PWA** — installable, works offline, full-screen on iOS home screen.

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
