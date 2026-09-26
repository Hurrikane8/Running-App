// iCalendar export: every upcoming planned session as an all-day event, with
// the structure and today's pace targets in the description. Opening the
// .ics on iPhone offers "Add All" to Calendar.

import { targetLine, structureText } from './wkfmt.js';
import { addDays, todayStr } from './util.js';

const icsEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stripTags = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const compact = (d) => d.replace(/-/g, '');

// Lines longer than 75 octets must be folded (RFC 5545 §3.1).
function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 73) { out.push(rest.slice(0, 73)); rest = ' ' + rest.slice(73); }
  out.push(rest);
  return out.join('\r\n');
}

export function buildIcs(state) {
  const { plan, profile, settings } = state;
  const evidence = { plan, extraLogs: state.extraLogs };
  const today = todayStr();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stride//Running Coach//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Stride training plan'];
  for (const w of plan.weeks) {
    for (const x of w.workouts) {
      if (x.date < today || x.status !== 'planned') continue;
      const target = stripTags(targetLine(x, profile, settings, evidence));
      const desc = [target, '', structureText(x, profile, settings, evidence), '', x.tip || '',
        'Paces as of export. Open Stride for live targets.'].join('\n');
      lines.push('BEGIN:VEVENT',
        `UID:${x.id}@stride`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(x.date)}`,
        `DTEND;VALUE=DATE:${compact(addDays(x.date, 1))}`,
        fold(`SUMMARY:${icsEscape(`${x.title}${x.distKm ? ` · ${target.split(' · ')[0]}` : ''}`)}`),
        fold(`DESCRIPTION:${icsEscape(desc)}`),
        'TRANSP:TRANSPARENT',
        'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
