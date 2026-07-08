// Shared helpers: dates, formatting, units. Distances are km internally.

export const KM_PER_MI = 1.609344;

export function todayStr() {
  return dateToStr(new Date());
}

export function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function strToDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr, n) {
  const d = strToDate(dateStr);
  d.setDate(d.getDate() + n);
  return dateToStr(d);
}

export function diffDays(a, b) {
  // whole days from a to b
  return Math.round((strToDate(b) - strToDate(a)) / 86400000);
}

// Monday of the week containing dateStr
export function mondayOf(dateStr) {
  const d = strToDate(dateStr);
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  return addDays(dateStr, -dow);
}

export function dayIndex(dateStr) {
  return (strToDate(dateStr).getDay() + 6) % 7; // Mon=0..Sun=6
}

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDateShort(dateStr) {
  const d = strToDate(dateStr);
  return `${DAY_ABBR[dayIndex(dateStr)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtDateLong(dateStr) {
  const d = strToDate(dateStr);
  return `${DAY_NAMES[dayIndex(dateStr)]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ---- units ----

export function kmToUnit(km, units) {
  return units === 'mi' ? km / KM_PER_MI : km;
}

export function unitToKm(v, units) {
  return units === 'mi' ? v * KM_PER_MI : v;
}

export function fmtDist(km, units, decimals = 1) {
  const v = kmToUnit(km, units);
  const s = v.toFixed(decimals).replace(/\.0$/, '');
  return `${s} ${units}`;
}

// seconds → "h:mm:ss" or "mm:ss"
export function fmtTime(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// pace stored as sec/km → "m:ss /km" or "/mi"
export function fmtPace(secPerKm, units) {
  const spu = units === 'mi' ? secPerKm * KM_PER_MI : secPerKm;
  const m = Math.floor(spu / 60);
  const s = Math.round(spu % 60);
  const ss = s === 60 ? 0 : s;
  const mm = s === 60 ? m + 1 : m;
  return `${mm}:${String(ss).padStart(2, '0')} /${units}`;
}

// treadmill speed: mph = 3600 / (sec/km · km/mi); 5:00 /km → 7.5 mph
export function paceToMph(secPerKm) {
  return 3600 / (secPerKm * KM_PER_MI);
}

export function fmtSpeedMph(secPerKm) {
  return `${paceToMph(secPerKm).toFixed(1)} mph`;
}

// Display-mode-aware pace formatting: outdoor pace in the user's units, or
// treadmill speed (always mph — treadmill consoles are conventionally mph).
export function fmtPaceDisplay(secPerKm, settings) {
  if (settings.paceDisplay === 'treadmill') return fmtSpeedMph(secPerKm);
  return fmtPace(secPerKm, settings.units);
}

export function roundHalf(x) {
  return Math.round(x * 2) / 2;
}

export function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
