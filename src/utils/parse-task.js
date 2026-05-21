// Shared lightweight parser — text → task fields.
// Understands English / Hindi-roman / Telugu-roman date words.
// Used by quick-capture and the brain-dump box.

export function parseTask(s) {
  const out = {
    title: s,
    category: 'Today',
    due: '',
    estMins: null,
    priority: 'soon',
    energy: null,
    emoji: '',
  };

  const lower = s.toLowerCase();

  if (/\b(today|aaj|ee\s?roju)\b/.test(lower))         { out.due = todayISO(0); out.category = 'Today'; out.priority = 'today'; }
  else if (/\b(tomorrow|kal|repu)\b/.test(lower))       { out.due = todayISO(1); out.category = 'Soon'; }
  else if (/\b(day after|parson|ellundi)\b/.test(lower)){ out.due = todayISO(2); out.category = 'Soon'; }
  else if (/\b(next week|agle hafte|next vaaram)\b/.test(lower)) { out.due = todayISO(7); out.category = 'Soon'; }
  else if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|som|mangal|budh|guru|shukra|shani|raviv)\b/.test(lower)) {
    out.due = nextWeekdayISO(lower);
    out.category = 'Soon';
  }

  const m1 = lower.match(/(\d+)\s*(min|m|minute)/);
  if (m1) out.estMins = parseInt(m1[1], 10);
  const m2 = lower.match(/(\d+)\s*(h|hr|hour)/);
  if (m2) out.estMins = (out.estMins || 0) + parseInt(m2[1], 10) * 60;

  if (/\b(urgent|asap|abhi|imm)\b/.test(lower))          out.priority = 'today';
  else if (/\b(someday|kabhi|whenever|maybe)\b/.test(lower)) { out.priority = 'someday'; out.category = 'Someday'; }

  if (/\b(heavy|deep|focus|hard|tough|mushkil)\b/.test(lower)) out.energy = 'heavy';
  else if (/\b(light|quick|easy|chhota|chinna)\b/.test(lower))  out.energy = 'light';

  // Tag detection — single-line categories like #upsc, #substack
  const tagged = lower.match(/#(upsc|mtp|substack|reading|exercise|class|lab|social|rest|other)\b/);
  if (tagged) {
    out.linkedModule = { kind: tagged[1], id: null };
  }

  // Strip time/date directives from title for cleanliness
  out.title = s
    .replace(/^(do|finish|complete)\s+/i, '')
    .replace(/\b(today|tomorrow|kal|aaj|repu|parson|ellundi|ee\s?roju|next week|agle\s?hafte)\b/gi, '')
    .replace(/\b\d+\s*(min|m|hr|h|hour|minute)s?\b/gi, '')
    .replace(/\b(urgent|asap|abhi|someday|heavy|light|deep)\b/gi, '')
    .replace(/#[a-z]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || s;

  return out;
}

// Parse a multi-line brain dump → array of task fields, one per line.
export function parseBrainDump(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .map(parseTask);
}

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const DOW = {
  sunday: 0, raviv: 0,
  monday: 1, som: 1,
  tuesday: 2, mangal: 2,
  wednesday: 3, budh: 3,
  thursday: 4, guru: 4,
  friday: 5, shukra: 5,
  saturday: 6, shani: 6,
};

function nextWeekdayISO(lower) {
  for (const [k, v] of Object.entries(DOW)) {
    if (lower.includes(k)) {
      const d = new Date();
      const today = d.getDay();
      let off = (v - today + 7) % 7;
      if (off === 0) off = 7;
      d.setDate(d.getDate() + off);
      return d.toISOString().slice(0, 10);
    }
  }
  return '';
}
