# Tests

Two suites. The app itself has no build step, so these run the ES modules and the
served page directly.

## `logic.mjs` — plan-engine property + unit checks (fast, no browser)

Imports `js/plangen.js`, `js/paces.js`, `js/hr.js`, and `js/storage.js` directly
under Node and asserts invariants that must hold for **every** plan across the full
matrix of goal × experience × days/week × starting volume:

- no NaN / negative / duplicate-date workouts; week `idx` contiguous
- long run is the longest run of its week (non-ultra)
- recovery ≤ easy; phases in order; deloads present; taper load eases
- race day present exactly on the race date; nothing scheduled before creation
- full-load week-over-week growth stays within slack (road goals; ultra spikes are
  recorded as `NOTE`s, not failures — see scope in the plan)
- pace math (monotonic in VDOT, zone ordering, recovery offset, race pace = projected
  finish ÷ distance), heart-rate math (Karvonen + %-max fallback + overrides), and
  storage migrations v1→current
- `replanFrom` keeps week numbers contiguous and preserves past weeks + logs

`NOTE` lines are non-failing observations (judgment calls / ultra tuning we watch).

```
npm test          # or: node tests/logic.mjs
```

Exit code is non-zero if any hard invariant fails.

## `e2e.mjs` — browser / PWA checks (needs a server + Playwright)

Drives the real app in Chromium: onboarding, tab rendering, log persistence, HR/pace
surfacing, the mid-plan replan week-numbering regression, and PWA manifest/icons/
service-worker/offline.

```
npm run serve &          # python3 -m http.server 8321, from the repo root
npm run test:e2e         # or: node tests/e2e.mjs   (set BASE=... to override URL)
```

Uses the Chromium bundled at `/opt/node22/.../playwright` in this environment; adjust
the import in `e2e.mjs` if your Playwright lives elsewhere.
