// Local notifications scaffolding.
// Android PWA (post-install) supports full notifications via the Notification API.
// Desktop browsers also support them. iOS Safari requires the PWA to be added
// to the home screen (iOS 16.4+) — see README.
//
// Strategy:
//  - On app open, schedule today's reminders via setTimeout (in-session).
//  - When the SW lands push, future versions can persist these in the SW.
//  - Notification permission is asked on-demand (when user wants reminders),
//    never on cold open.

import { getState, subscribe } from '../state.js';
import { todayKey, inQuietHours } from './format.js';

const HANDLES = new Map(); // key → timeout id

export async function ensurePermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch { return 'denied'; }
}

export function notify(title, options = {}) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const s = getState();
  if (s?.mino?.quietHours && inQuietHours(new Date(), s.mino.quietHours.from, s.mino.quietHours.to)) return;
  try {
    new Notification(title, {
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      ...options,
    });
  } catch (e) { console.warn('notify failed', e); }
}

// Schedule today's med + skincare reminders + "plan tomorrow?" + Mino late-night
export function scheduleDailyReminders() {
  clearAll();
  const s = getState();
  if (!s) return;

  // Meds: derive a 'when' from the schedule string
  for (const m of s.health.meds || []) {
    const when = scheduleToTime(m.schedule);
    if (!when) continue;
    scheduleOnce(`med-${m.id}`, when, () => {
      const taken = (s = getState()).health.medLog.some((l) => l.date === todayKey() && l.medId === m.id && l.taken);
      if (!taken) notify('meds time ♡', { body: `${m.name}${m.dose ? ` · ${m.dose}` : ''}`, tag: `med-${m.id}` });
    });
  }

  // Skincare AM/PM
  if ((s.health.skincare.am || []).length) scheduleOnce('sk-am', '07:30', () => notify('AM skincare ✨'));
  if ((s.health.skincare.pm || []).length) scheduleOnce('sk-pm', '22:00', () => notify('PM skincare ✨'));

  // Plan-tomorrow prompt
  scheduleOnce('plan-tomorrow', '21:30', () => notify('plan tomorrow? ✿', { body: 'just 3 things — kal-me will thank tonight-you' }));

  // Sleep nudge
  const bedHour = (s.mino.quietHours?.from || '22:30');
  scheduleOnce('sleep', bedHour, () => notify('soja kanna 🌙'));
}

function scheduleOnce(key, hhmm, fn) {
  const [h, m] = (hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h)) return;
  const now = new Date();
  const at = new Date(); at.setHours(h, m, 0, 0);
  const delay = at.getTime() - now.getTime();
  if (delay < 0) return;
  const id = setTimeout(fn, delay);
  HANDLES.set(key, id);
}

function clearAll() {
  for (const id of HANDLES.values()) clearTimeout(id);
  HANDLES.clear();
}

function scheduleToTime(schedule) {
  switch ((schedule || '').toLowerCase()) {
    case 'morning':       return '08:30';
    case 'afternoon':     return '14:00';
    case 'evening':       return '19:30';
    case 'night':         return '22:00';
    case 'morning+night': return '08:30'; // primary; secondary handled below
    case 'asneeded':      return null;
    default:              return null;
  }
}

// Reschedule whenever the user changes meds or skincare
let subscribed = false;
export function mountNotifications() {
  if (subscribed) return;
  subscribed = true;
  scheduleDailyReminders();
  subscribe(() => scheduleDailyReminders());
  // Reschedule at midnight
  const msUntilMidnight = (() => {
    const d = new Date(); d.setHours(24, 0, 0, 0);
    return d.getTime() - Date.now();
  })();
  setTimeout(() => { scheduleDailyReminders(); setInterval(scheduleDailyReminders, 24 * 3600_000); }, msUntilMidnight);
}
