// Calendar tab · day / week / month views.
// Pulls in events from calendar.events plus derived blocks from scheduled tasks,
// UPSC revisions (when wave 4 lands), Substack publish dates, planned outings.

import { el, clear, openSheet, closeSheet, toast } from '../utils/dom.js';
import { getState, update, subscribe, uid } from '../state.js';
import { fmtMinutes, todayKey, fmtClock, fmtDate } from '../utils/format.js';

let viewMode = 'week';     // day | week | month
let cursorDate = todayKey();

// Format a Date as YYYY-MM-DD in *local* time. Using toISOString() returns UTC,
// which breaks day navigation for users in non-UTC zones (e.g. IST is UTC+5:30,
// so forward arrow looked stuck and backward jumped 2 days).
function localISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function renderCalendar(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(buildCalendar()); };
  paint();
  // Reset scroll to top each time the calendar opens (mobile was landing mid-page).
  try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); host.scrollIntoView({ block: 'start' }); } catch {}
  unsub = subscribe(paint);
  // Tick once a minute so the 'now' line and completion-timer badges refresh.
  const t = setInterval(() => {
    const line = host.querySelector('[data-now-line]');
    if (line) updateNowLine(line);
    // If any task's completion timer is active, repaint blocks (badges tick down).
    if (getState().tasks.negotiable.some((x) => x.timerStartedAt && x.completionTimerMins)) paint();
  }, 60_000);
  host.addEventListener('beforerouted', () => { unsub && unsub(); clearInterval(t); }, { once: true });
}

function buildCalendar() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('div', { class: 'row row--between', style: { alignItems: 'baseline' } }, [
    el('h1', null, ['calendar ', el('i', { class: 'ph-duotone ph-calendar-heart', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]),
    el('div', { class: 'row', style: { gap: '4px' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => shift(-1) }, [el('i', { class: 'ph ph-caret-left' })]),
      el('button', { class: 'btn btn--soft', onClick: () => { cursorDate = todayKey(); paintNow(); } }, 'today'),
      el('button', { class: 'btn btn--soft', onClick: () => shift(+1) }, [el('i', { class: 'ph ph-caret-right' })]),
    ])
  ]));

  // Mode tabs
  wrap.appendChild(el('div', { class: 'row', style: { gap: '6px' } }, ['day','week','month'].map((m) =>
    el('button', {
      class: viewMode === m ? 'chip chip--primary' : 'chip',
      type: 'button', style: { cursor: 'pointer' },
      onClick: () => { viewMode = m; paintNow(); }
    }, m))));

  if (viewMode === 'day')   wrap.appendChild(dayView(s));
  if (viewMode === 'week')  wrap.appendChild(weekView(s));
  if (viewMode === 'month') wrap.appendChild(monthView(s));

  // Unscheduled tasks tray (for drag-to-schedule, drop alt: tap to schedule)
  wrap.appendChild(unscheduledTray(s));

  // Add event button
  wrap.appendChild(el('button', { class: 'btn btn--block', onClick: () => openEventEdit(null) }, '+ new event'));

  return wrap;
}

function paintNow() { update((d) => { d.calendar._uiTick = (d.calendar._uiTick || 0) + 1; }); }

function shift(dir) {
  const d = new Date(cursorDate + 'T00:00:00');
  if (viewMode === 'day')   d.setDate(d.getDate() + dir);
  if (viewMode === 'week')  d.setDate(d.getDate() + 7 * dir);
  if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
  cursorDate = localISODate(d);
  paintNow();
}

// All events at a given date (calendar.events + derived from tasks)
function eventsOn(s, date) {
  const out = [...(s.calendar.events || []).filter((e) => e.date === date)];
  // Derive from negotiable tasks · TWO inclusion paths:
  //   1. scheduledAt has a time on this date  → place at that time
  //   2. due === date (no scheduledAt)         → place at 09:00 as a soft default
  //   3. priority === 'today' and date === today and no due → today fallback
  const tToday = todayKey();
  for (const t of s.tasks.negotiable) {
    if (t.status === 'done') continue;
    let start = null, end = null;
    if (t.scheduledAt && t.scheduledAt.slice(0, 10) === date) {
      start = t.scheduledAt.slice(11, 16);
      end = addMinutes(start, t.completionTimerMins || t.estMins || 30);
    } else if (!t.scheduledAt && t.due === date) {
      start = '09:00';
      end = addMinutes(start, t.completionTimerMins || t.estMins || 30);
    } else if (!t.scheduledAt && !t.due && t.priority === 'today' && date === tToday) {
      start = '09:00';
      end = addMinutes(start, t.estMins || 30);
    }
    if (!start) continue;
    out.push({
      id: `task-${t.id}`,
      title: t.title,
      date, start, end,
      sourceModule: 'task', sourceId: t.id,
      color: 'var(--primary)',
    });
  }
  return out.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
}

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function minutesFromTop(hhmm) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return (h * 60 + m) * (60 / 60); // 60 px per hour
}

// ─── DAY VIEW ────────────────────────────────────────────────
function dayView(s) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-sun' }), fmtDate(new Date(cursorDate + 'T00:00:00'))]),
    timeGrid(s, [cursorDate]),
  ]);
}

// ─── WEEK VIEW ───────────────────────────────────────────────
function weekView(s) {
  const startOfWeek = startOfWeekDate(cursorDate);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    days.push(localISODate(d));
  }
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-calendar-blank' }),
      `${fmtDay(days[0])} – ${fmtDay(days[6])}`,
    ]),
    el('div', { class: 'calendar-week-scroll' }, [
      el('div', null, [
        el('div', { class: 'row', style: { gap: '2px' } },
          days.map((d) => el('div', { style: { flex: 1, minWidth: 0 } }, [
            el('div', {
              style: {
                textAlign: 'center', fontSize: '0.75rem',
                fontWeight: d === todayKey() ? 700 : 500,
                color: d === todayKey() ? 'var(--primary-deep)' : 'var(--ink-mute)',
                padding: '6px 0',
              }
            }, fmtDay(d)),
          ]))
        ),
        timeGrid(s, days, { compact: false }),
      ]),
    ]),
  ]);
}

function fmtDay(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

function startOfWeekDate(date) {
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  return localISODate(d);
}

// Render a 24-hour grid with event blocks across one or more days.
function timeGrid(s, days, { compact = false } = {}) {
  const HOUR_HEIGHT = compact ? 28 : 44;
  const grid = el('div', { style: {
    position: 'relative', display: 'grid',
    gridTemplateColumns: `40px repeat(${days.length}, 1fr)`,
    rowGap: '0', columnGap: '2px', marginTop: '6px',
  } });
  // Hour labels
  for (let h = 0; h < 24; h++) {
    grid.appendChild(el('div', {
      style: {
        gridColumn: '1', gridRow: `${h + 1}`,
        fontSize: '0.65rem', color: 'var(--ink-mute)',
        height: `${HOUR_HEIGHT}px`, textAlign: 'right', paddingRight: '4px',
      }
    }, h === 0 ? '' : `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`));
  }
  // Day columns
  days.forEach((day, di) => {
    const col = el('div', {
      style: {
        gridColumn: `${di + 2}`, gridRow: '1 / 25',
        position: 'relative', borderLeft: '1px solid var(--line)',
        height: `${HOUR_HEIGHT * 24}px`,
        background: day === todayKey() ? 'var(--surface-2)' : 'transparent',
      }
    });
    // Hour grid lines
    for (let h = 1; h < 24; h++) col.appendChild(el('div', {
      style: {
        position: 'absolute', top: `${h * HOUR_HEIGHT}px`, left: 0, right: 0,
        borderTop: '1px dashed var(--line)', opacity: 0.5,
      }
    }));
    // Now line
    if (day === todayKey()) {
      const line = el('div', { dataset: { nowLine: '' }, style: {
        position: 'absolute', left: 0, right: 0, height: '2px',
        background: 'var(--primary)', boxShadow: '0 0 8px var(--primary-soft)',
        zIndex: 2,
      } });
      updateNowLine(line, HOUR_HEIGHT);
      col.appendChild(line);
    }
    // Events
    const evs = eventsOn(s, day);
    for (const e of evs) {
      const top = minutesFromTop(e.start || '00:00') * (HOUR_HEIGHT / 60);
      const minutes = Math.max(20, minutesBetween(e.start, e.end));
      const height = minutes * (HOUR_HEIGHT / 60);
      const block = el('button', {
        class: 'card', style: {
          position: 'absolute', top: `${top}px`, left: '2px', right: '2px',
          height: `${height}px`, padding: '4px 6px', margin: 0,
          background: e.color || 'var(--primary-soft)',
          color: 'var(--ink)', textAlign: 'left',
          overflow: 'hidden', cursor: 'pointer',
          border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
          borderRadius: '8px', fontSize: compact ? '0.65rem' : '0.75rem',
        },
        onClick: () => openEventEdit(e),
      }, [
        el('div', { style: { fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, e.title),
        compact ? null : el('div', { class: 'muted', style: { fontSize: '0.65rem' } }, `${e.start} – ${e.end || '·'}`),
      ]);

      // Completion timer remaining · task.timerStartedAt is set when user taps "start now"
      if (e.sourceModule === 'task') {
        const t = s.tasks.negotiable.find((x) => x.id === e.sourceId);
        if (t?.completionTimerMins && t?.timerStartedAt) {
          const remaining = Math.max(0, t.completionTimerMins * 60_000 - (Date.now() - Date.parse(t.timerStartedAt)));
          if (remaining > 0) {
            block.appendChild(el('div', { class: 'chip chip--primary', style: { fontSize: '0.6rem', marginTop: '2px' } }, `${Math.ceil(remaining / 60_000)}m left`));
          } else {
            block.appendChild(el('div', { class: 'chip', style: { fontSize: '0.6rem', marginTop: '2px', color: 'var(--primary-deep)' } }, 'time up · gently'));
          }
        }
      }
      col.appendChild(block);
    }
    // Tap empty area to add an event
    col.addEventListener('click', (e) => {
      if (e.target !== col) return; // ignore clicks on existing blocks
      const rect = col.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const minutes = Math.floor(y / (HOUR_HEIGHT / 60) / 15) * 15;
      const h = Math.floor(minutes / 60), m = minutes % 60;
      openEventEdit({
        id: uid('ev'), date: day, start: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        end: `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      });
    });
    grid.appendChild(col);
  });
  return grid;
}

function updateNowLine(line, hourHeight = 44) {
  const now = new Date();
  const top = (now.getHours() * 60 + now.getMinutes()) * (hourHeight / 60);
  line.style.top = `${top}px`;
}

function minutesBetween(start, end) {
  if (!start || !end) return 30;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

// ─── MONTH VIEW ──────────────────────────────────────────────
function monthView(s) {
  const d = new Date(cursorDate + 'T00:00:00');
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start); dt.setDate(start.getDate() + i);
    cells.push(dt);
  }
  const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-calendar' }), monthLabel]),
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', fontSize: '0.7rem' } }, [
      ...['s','m','t','w','t','f','s'].map((l) => el('div', { class: 'muted', style: { textAlign: 'center', padding: '4px 0' } }, l)),
      ...cells.map((dt) => {
        const key = localISODate(dt);
        const inMonth = dt.getMonth() === d.getMonth();
        const isToday = key === todayKey();
        const evs = eventsOn(s, key);
        return el('button', {
          style: {
            background: isToday ? 'var(--primary-soft)' : 'var(--surface-2)',
            border: '1px solid var(--line)',
            borderRadius: '8px', padding: '4px',
            minHeight: '54px', textAlign: 'left',
            opacity: inMonth ? 1 : 0.4, cursor: 'pointer',
          },
          onClick: () => { cursorDate = key; viewMode = 'day'; paintNow(); }
        }, [
          el('div', { style: { fontWeight: 600, fontSize: '0.7rem' } }, dt.getDate()),
          ...evs.slice(0, 3).map((e) => el('div', {
            style: {
              fontSize: '0.6rem', background: e.color || 'var(--primary-soft)',
              borderRadius: '4px', padding: '1px 4px', marginTop: '2px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }
          }, e.title)),
          evs.length > 3 ? el('div', { class: 'muted', style: { fontSize: '0.6rem' } }, `+${evs.length - 3}`) : null,
        ]);
      }),
    ]),
  ]);
}

// ─── UNSCHEDULED TASKS TRAY ──────────────────────────────────
function unscheduledTray(s) {
  const list = s.tasks.negotiable.filter((t) => t.status !== 'done' && !t.scheduledAt).slice(0, 8);
  if (list.length === 0) return el('div');
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-tray' }), 'unscheduled', el('small', null, `${list.length}`)]),
    el('p', { class: 'muted', style: { margin: 0, fontSize: '0.75rem' } }, 'tap to schedule. defaults to today.'),
    el('div', { class: 'stack' }, list.map((t) => el('div', { class: 'row row--between' }, [
      el('div', null, [
        el('div', null, t.title),
        el('div', { class: 'muted', style: { fontSize: '0.7rem' } },
          [t.due, t.estMins ? fmtMinutes(t.estMins) : null].filter(Boolean).join(' · ')),
      ]),
      el('button', { class: 'btn btn--soft', onClick: () => scheduleTask(t) }, 'schedule'),
    ]))),
  ]);
}

function scheduleTask(t) {
  const fDate = el('input', { class: 'input', type: 'date', value: t.due || todayKey() });
  const fTime = el('input', { class: 'input', type: 'time', value: '09:00' });
  const fMins = el('input', { class: 'input', type: 'number', min: 5, value: t.estMins || 30 });
  const fCompletion = el('input', { class: 'input', type: 'number', min: 5, value: t.completionTimerMins || '', placeholder: 'optional' });
  openSheet(el('div', { class: 'stack' }, [
    el('p', { class: 'muted', style: { margin: 0 } }, `scheduling: ${t.title}`),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'date'), fDate]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'start time'), fTime]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'duration (min)'), fMins]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, '"finish by" timer (min, optional)'), fCompletion]),
    el('button', { class: 'btn btn--block', onClick: () => {
      const iso = `${fDate.value}T${fTime.value}:00`;
      update((d) => {
        const x = d.tasks.negotiable.find((y) => y.id === t.id);
        if (!x) return;
        x.scheduledAt = iso;
        x.estMins = parseInt(fMins.value, 10) || x.estMins;
        const ct = parseInt(fCompletion.value, 10);
        x.completionTimerMins = Number.isFinite(ct) && ct > 0 ? ct : null;
      });
      closeSheet(); toast('scheduled ✓');
    } }, 'schedule'),
  ]), { title: 'schedule task' });
}

// ─── EVENT EDIT SHEET ────────────────────────────────────────
function openEventEdit(existing) {
  // For task-derived events, route to the task's edit sheet
  if (existing?.sourceModule === 'task') {
    const s = getState();
    const task = s.tasks.negotiable.find((x) => x.id === existing.sourceId);
    if (task) {
      import('./tasks.js').then((m) => m.openEditSheet(task));
    } else {
      toast('task gone · refresh');
    }
    return;
  }
  const e = existing ? { ...existing } : {
    id: uid('ev'), title: '', date: todayKey(), start: '09:00', end: '10:00',
    color: 'var(--primary-soft)', sourceModule: 'manual',
  };
  const fTitle = el('input', { class: 'input', value: e.title, placeholder: 'event title' });
  const fDate = el('input', { class: 'input', type: 'date', value: e.date });
  const fStart = el('input', { class: 'input', type: 'time', value: e.start });
  const fEnd = el('input', { class: 'input', type: 'time', value: e.end });

  openSheet(el('div', { class: 'stack' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'title'), fTitle]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'date'), fDate]),
    el('div', { class: 'row', style: { gap: '6px' } }, [
      el('label', { class: 'field', style: { flex: 1, margin: 0 } }, [el('span', { class: 'field__label' }, 'start'), fStart]),
      el('label', { class: 'field', style: { flex: 1, margin: 0 } }, [el('span', { class: 'field__label' }, 'end'), fEnd]),
    ]),
    el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', { class: 'btn btn--block', onClick: () => {
        e.title = fTitle.value.trim() || 'untitled';
        e.date = fDate.value;
        e.start = fStart.value;
        e.end = fEnd.value;
        update((d) => {
          d.calendar.events ||= [];
          const i = d.calendar.events.findIndex((x) => x.id === e.id);
          if (i === -1) d.calendar.events.push(e);
          else d.calendar.events[i] = e;
        });
        closeSheet(); toast(existing?.title ? 'saved ✓' : 'added ✓');
      } }, 'save'),
      existing?.title ? el('button', { class: 'btn btn--ghost', onClick: () => {
        if (!confirm('delete event?')) return;
        update((d) => { d.calendar.events = (d.calendar.events || []).filter((x) => x.id !== e.id); });
        closeSheet();
      } }, [el('i', { class: 'ph ph-trash' })]) : null,
    ]),
  ]), { title: existing?.title ? 'edit event' : 'new event' });
}
