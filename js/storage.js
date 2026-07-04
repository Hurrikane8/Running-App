// Single-key localStorage persistence with a version field for future migrations.

const KEY = 'stride.state.v1';

const DEFAULT_STATE = {
  version: 1,
  settings: { units: 'km' },
  profile: null,      // set by onboarding
  plan: null,         // { createdAt, startDate, goal, raceDate, weeks: [...] }
  extraLogs: [],      // ad-hoc runs logged outside the plan
  ui: { reshuffleDismissed: null },
};

let state = null;

export function loadState() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) } : structuredClone(DEFAULT_STATE);
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
  if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
    throw new Error('Not a valid Stride backup file');
  }
  state = { ...structuredClone(DEFAULT_STATE), ...parsed };
  saveState();
  return state;
}
