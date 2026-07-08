// Single-key localStorage persistence with versioned schema migrations.
// Any change to the persisted data structure MUST ship a migration below so
// existing plans and logged workouts survive the update.

const KEY = 'stride.state.v1'; // storage key is stable; `version` tracks the schema

export const STATE_VERSION = 4;

const DEFAULT_STATE = {
  version: STATE_VERSION,
  settings: { units: 'km', paceDisplay: 'outdoor' }, // paceDisplay: 'outdoor' | 'treadmill'
  profile: null,      // set by onboarding
  plan: null,         // { createdAt, startDate, goal, raceDate, weeks: [...] }
  extraLogs: [],      // ad-hoc runs logged outside the plan
  ui: { reshuffleDismissed: null },
};

// Sequential migrations: MIGRATIONS[n] upgrades a state from version n to n+1.
const MIGRATIONS = {
  // v1 → v2: settings gains paceDisplay (treadmill pace mode)
  1: (s) => {
    s.settings = { units: 'km', ...s.settings };
    if (!s.settings.paceDisplay) s.settings.paceDisplay = 'outdoor';
    return s;
  },
  // v2 → v3: plans used to schedule workouts on days earlier in the calendar
  // week than the plan's creation date, which instantly read as "missed".
  // Strip those phantom entries (only untouched, still-planned ones — any
  // workout the user logged or skipped is kept).
  2: (s) => {
    if (s.plan?.weeks && s.plan.createdAt) {
      for (const w of s.plan.weeks) {
        const before = w.workouts.length;
        w.workouts = w.workouts.filter(
          (x) => x.date >= s.plan.createdAt || x.status !== 'planned');
        if (w.workouts.length !== before) {
          w.targetKm = Math.round(w.workouts.reduce(
            (sum, x) => sum + (x.distKm ?? (x.durMin ? x.durMin / 7 : 0)), 0));
        }
      }
    }
    return s;
  },
  // v3 → v4: profile gains vdotDate (anchor for progressive pace targets)
  // and optional goalTimeSec (reverse-engineered plans)
  3: (s) => {
    if (s.profile) {
      if (!s.profile.vdotDate) {
        s.profile.vdotDate = s.plan?.createdAt || new Date().toISOString().slice(0, 10);
      }
      s.profile.goalTimeSec ??= null;
    }
    return s;
  },
};

function migrate(s) {
  if (!s || typeof s !== 'object') return structuredClone(DEFAULT_STATE);
  if (!s.version) s.version = 1;
  while (s.version < STATE_VERSION) {
    const step = MIGRATIONS[s.version];
    if (!step) break; // unknown gap — keep data as-is rather than destroy it
    s = step(s);
    s.version += 1;
  }
  // Defensive top-level defaults (never overwrite user data)
  s.settings = { ...DEFAULT_STATE.settings, ...s.settings };
  s.ui = { ...DEFAULT_STATE.ui, ...s.ui };
  s.extraLogs ??= [];
  return s;
}

let state = null;

export function loadState() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = migrate(JSON.parse(raw));
      saveState(); // persist any migration immediately
    } else {
      state = structuredClone(DEFAULT_STATE);
    }
  } catch {
    state = structuredClone(DEFAULT_STATE);
  }
  return state;
}

export function saveState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
  }
}

export function resetState() {
  state = structuredClone(DEFAULT_STATE);
  localStorage.removeItem(KEY);
}

export function exportState() {
  return JSON.stringify(loadState(), null, 2);
}

export function importState(json) {
  const parsed = JSON.parse(json); // throws on invalid JSON
  if (!parsed || typeof parsed !== 'object' || !parsed.version || parsed.version > STATE_VERSION) {
    throw new Error('Not a valid Stride backup file');
  }
  state = migrate(parsed);
  saveState();
  return state;
}
