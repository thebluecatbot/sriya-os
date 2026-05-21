// Reviews · Friday weekly, monthly, consistency, insights.
// All factual, never ranked. No streaks.

import { el, clear } from '../utils/dom.js';
import { getState, subscribe } from '../state.js';
import { todayKey, fmtMinutes, fmtDate } from '../utils/format.js';

let mode = 'week'; // week | month | consistency | insights

export function renderReviews(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(build()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function build() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('h1', null, ['reviews ', el('i', { class: 'ph-duotone ph-chart-line-up', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]));

  // Mode pills
  wrap.appendChild(el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
    ['week','month','consistency','insights'].map((m) => el('button', {
      class: mode === m ? 'chip chip--primary' : 'chip',
      type: 'button', style: { cursor: 'pointer' },
      onClick: () => { mode = m; rePaint(); }
    }, m))
  ));

  if (mode === 'week')        wrap.appendChild(weekReview(s));
  if (mode === 'month')       wrap.appendChild(monthReview(s));
  if (mode === 'consistency') wrap.appendChild(consistencyView(s));
  if (mode === 'insights')    wrap.appendChild(insightsView(s));

  return wrap;
}

function rePaint() {
  // tiny non-persistent state bump
  const ev = new Event('hashchange');
  window.dispatchEvent(ev);
}

// ─── WEEK ────────────────────────────────────────────────────
function weekReview(s) {
  const days = lastNDays(7);
  const timeByCat = {};
  let totalMins = 0;
  for (const d of days) {
    for (const e of s.timer.log) if (e.date === d) {
      timeByCat[e.categoryId] = (timeByCat[e.categoryId] || 0) + (e.mins || 0);
      totalMins += e.mins || 0;
    }
  }
  const cats = s.timer.categories.map((c) => ({ c, m: timeByCat[c.id] || 0 })).filter((x) => x.m > 0).sort((a, b) => b.m - a.m);

  // Tasks done this week
  const tasksDone = s.tasks.negotiable.filter((t) => t.status === 'done' && days.includes((t.completedAt || '').slice(0, 10)));

  // Scroll-light days = days under budget
  const budget = s.doomscroll.budgetMins ?? 30;
  const scrollLight = days.filter((d) => (s.doomscroll.dailyLog?.[d]?.mins ?? 0) <= budget).length;

  // Journal days
  const journalDays = new Set((s.journal.entries || []).map((j) => j.date));
  const journaled = days.filter((d) => journalDays.has(d)).length;

  return el('div', { class: 'stack' }, [
    el('div', { class: 'card card--hero' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-flower-tulip' }), 'this week, gently']),
      el('p', { class: 'muted', style: { margin: 0 } }, 'reflective, not ranked. nothing was failed.'),
    ]),

    // Time split
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-chart-pie-slice' }), 'time split', el('small', null, fmtMinutes(totalMins))]),
      cats.length === 0
        ? el('p', { class: 'muted', style: { margin: 0 } }, 'no time tracked this week.')
        : el('div', { class: 'stack' }, cats.map(({ c, m }) => el('div', null, [
            el('div', { class: 'row row--between', style: { fontSize: '0.875rem', marginBottom: '2px' } }, [
              el('span', null, `${c.emoji} ${c.label}`),
              el('span', { class: 'muted' }, fmtMinutes(m)),
            ]),
            el('div', { style: { height: '6px', background: 'var(--surface-2)', borderRadius: '999px', overflow: 'hidden' } }, [
              el('div', { style: { height: '100%', width: `${(m / totalMins) * 100}%`, background: c.color || 'var(--primary)' } })
            ]),
          ]))),
    ]),

    // Wins
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-confetti' }), 'wins this week']),
      el('ul', { style: { paddingLeft: '20px', margin: 0 } }, [
        el('li', null, `${tasksDone.length} tasks completed`),
        el('li', null, `${journaled}/7 days journaled`),
        el('li', null, `${scrollLight}/7 scroll-light days (under ${budget}m)`),
        el('li', null, `${(s.health.workoutLog || []).filter((w) => days.includes(w.date)).length} workouts logged`),
        el('li', null, `${days.filter((d) => (s.health.medLog || []).some((l) => l.date === d && l.taken)).length} days you took meds`),
      ]),
    ]),

    // Specific praise
    tasksDone.length > 0 ? el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-star' }), 'things you actually did']),
      el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
        tasksDone.slice(0, 12).map((t) => el('span', { class: 'chip chip--primary' }, t.title))),
    ]) : null,
  ]);
}

// ─── MONTH ───────────────────────────────────────────────────
function monthReview(s) {
  const days = lastNDays(30);
  const totalMins = s.timer.log.filter((e) => days.includes(e.date)).reduce((n, e) => n + (e.mins || 0), 0);
  const tasksDone = s.tasks.negotiable.filter((t) => t.status === 'done' && days.includes((t.completedAt || '').slice(0, 10))).length;
  const moods = (s.health.moodLog || []).filter((l) => days.includes(l.date));
  const avgMood = moods.length ? (moods.reduce((n, m) => n + (m.score || 0), 0) / moods.length).toFixed(1) : '·';
  const journaled = days.filter((d) => (s.journal.entries || []).some((j) => j.date === d)).length;

  return el('div', { class: 'stack' }, [
    el('div', { class: 'card card--hero' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-calendar' }), 'this month']),
      el('p', { class: 'muted', style: { margin: 0 } }, 'thirty days · trends, no judgments.'),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-trend-up' }), 'numbers']),
      el('ul', { style: { paddingLeft: '20px', margin: 0 } }, [
        el('li', null, `${fmtMinutes(totalMins)} tracked across all activities`),
        el('li', null, `${tasksDone} tasks completed`),
        el('li', null, `${journaled}/30 days journaled`),
        el('li', null, `average mood ${avgMood}/5`),
        el('li', null, `${days.filter((d) => (s.doomscroll.dailyLog?.[d]?.mins ?? 0) <= (s.doomscroll.budgetMins ?? 30)).length}/30 scroll-light days`),
      ]),
    ]),
  ]);
}

// ─── CONSISTENCY (no streaks) ────────────────────────────────
function consistencyView(s) {
  const days = lastNDays(7);
  const rows = [
    { label: 'morning meds',    check: (d) => (s.health.medLog || []).some((l) => l.date === d && l.taken) },
    { label: 'breakfast',       check: (d) => (s.health.mealLog || []).some((l) => l.date === d && l.breakfast) },
    { label: 'journaled',       check: (d) => (s.journal.entries || []).some((j) => j.date === d) },
    { label: 'moved (workout)', check: (d) => (s.health.workoutLog || []).some((w) => w.date === d) },
    { label: 'mood logged',     check: (d) => (s.health.moodLog || []).some((m) => m.date === d) },
  ];
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card card--hero' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-flower' }), 'you showed up']),
      el('p', { class: 'muted', style: { margin: 0 } }, 'never "streak broken." just days you showed up.'),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-calendar-dots' }), 'last 7 days']),
      el('div', { style: { overflowX: 'auto' } }, [
        el('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' } }, [
          el('thead', null, [
            el('tr', null, [el('th', { style: thStyle }, ''),
              ...days.map((d) => el('th', { style: thStyle }, d.slice(8)))]),
          ]),
          el('tbody', null, rows.map((row) => el('tr', null, [
            el('td', { style: { ...tdStyle, fontWeight: 500 } }, row.label),
            ...days.map((d) => {
              const ok = row.check(d);
              return el('td', { style: { ...tdStyle, textAlign: 'center' } },
                ok ? el('span', { style: { color: 'var(--primary)' } }, '✿') : el('span', { class: 'muted' }, '·'));
            }),
          ]))),
        ]),
      ]),
      el('p', { class: 'muted', style: { fontSize: '0.7rem', marginTop: '8px' } }, 'flowers are showed-up days. dots are not failures · they\'re just days.'),
    ]),
  ]);
}

const thStyle = { textAlign: 'left', padding: '6px 4px', color: 'var(--ink-mute)', fontSize: '0.7rem', fontWeight: 500 };
const tdStyle = { padding: '6px 4px', borderTop: '1px solid var(--line)' };

// ─── INSIGHTS (factual monthly stats, no judgement) ──────────
function insightsView(s) {
  const days = lastNDays(30);
  // Journaling × exercise correlation (very simple Pearson on yes/no per day)
  let bothDays = 0, journalDays = 0, exerciseDays = 0;
  for (const d of days) {
    const j = (s.journal.entries || []).some((x) => x.date === d);
    const w = (s.health.workoutLog || []).some((x) => x.date === d);
    if (j) journalDays++;
    if (w) exerciseDays++;
    if (j && w) bothDays++;
  }
  const correlation = (journalDays + exerciseDays === 0) ? null : Math.round((bothDays / Math.max(journalDays, exerciseDays)) * 100);

  // Meds adherence
  const meds = s.health.meds || [];
  let scheduled = 0, taken = 0;
  for (const d of days) for (const m of meds) {
    if (!m.schedule || m.schedule === 'asneeded') continue;
    scheduled++;
    if ((s.health.medLog || []).some((l) => l.date === d && l.medId === m.id && l.taken)) taken++;
  }
  const adherence = scheduled ? Math.round((taken / scheduled) * 100) : 0;

  return el('div', { class: 'stack' }, [
    el('div', { class: 'card card--hero' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-eye' }), 'insights']),
      el('p', { class: 'muted', style: { margin: 0 } }, 'plain facts. used to plan, not to punish.'),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-pill' }), 'meds adherence (30d)']),
      el('p', { style: { margin: 0 } }, `${adherence}% · ${taken}/${scheduled}`),
    ]),
    correlation != null ? el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-link' }), 'journal × exercise']),
      el('p', { style: { margin: 0 } }, `${correlation}% of journaling-or-exercise days had both. ${correlation > 60 ? 'they travel together for you.' : 'they\'re mostly independent.'}`),
    ]) : null,
  ]);
}

// ─── helpers ─────────────────────────────────────────────────
function lastNDays(n) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
