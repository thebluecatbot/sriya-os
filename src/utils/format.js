// Small formatters / time helpers used everywhere.

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function timeOfDay(d = new Date()) {
  const h = d.getHours();
  if (h < 5)  return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

export function dayPart(d = new Date()) {
  // Used by Mino's day-part check-ins.
  const h = d.getHours();
  if (h >= 7  && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'late';
}

export function fmtClock(d = new Date()) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const am = h < 12;
  h = h % 12 || 12;
  return `${h}:${m} ${am ? 'am' : 'pm'}`;
}

export function fmtDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function fmtDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function inQuietHours(now, fromStr, toStr) {
  // "HH:MM" 24h ranges; wrap across midnight allowed.
  const t = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = fromStr.split(':').map(Number);
  const [th, tm] = toStr.split(':').map(Number);
  const f = fh * 60 + fm;
  const e = th * 60 + tm;
  if (f === e) return false;
  return f < e ? (t >= f && t < e) : (t >= f || t < e);
}

export function relative(ms) {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1)   return 'just now';
  if (min < 60)  return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)     return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}
