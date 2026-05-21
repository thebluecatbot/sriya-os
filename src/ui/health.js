// Health hub — meds, skincare, meditation, workouts, sleep, mood, meals.
// Sub-section toggle keeps the page light; each section paginates its own log.

import { el, clear, openSheet, closeSheet, toast, bloomAt, haptic } from '../utils/dom.js';
import { getState, update, subscribe, uid } from '../state.js';
import { fmtMinutes, todayKey, fmtClock, fmtDate } from '../utils/format.js';

const SECTIONS = [
  { id: 'meds',       label: 'meds',       icon: 'ph-pill' },
  { id: 'skincare',   label: 'skincare',   icon: 'ph-sparkle' },
  { id: 'meditation', label: 'meditation', icon: 'ph-yin-yang' },
  { id: 'workouts',   label: 'workouts',   icon: 'ph-barbell' },
  { id: 'sleep',      label: 'sleep',      icon: 'ph-moon-stars' },
  { id: 'mood',       label: 'mood',       icon: 'ph-smiley' },
  { id: 'meals',      label: 'meals',      icon: 'ph-bowl-food' },
];

let activeSection = 'meds';

export function renderHealth(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(buildHealth()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function buildHealth() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('h1', null, ['health ', el('i', { class: 'ph-duotone ph-flower-tulip', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]));

  // Section pills
  wrap.appendChild(el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
    SECTIONS.map((sec) => el('button', {
      class: activeSection === sec.id ? 'chip chip--primary' : 'chip',
      type: 'button', style: { cursor: 'pointer' },
      onClick: () => { activeSection = sec.id; update((d) => { d.health._uiTick = (d.health._uiTick || 0) + 1; }); }
    }, [el('i', { class: `ph ${sec.icon}` }), ' ', sec.label]))
  ));

  switch (activeSection) {
    case 'meds':       wrap.appendChild(medsSection(s));       break;
    case 'skincare':   wrap.appendChild(skincareSection(s));   break;
    case 'meditation': wrap.appendChild(meditationSection(s)); break;
    case 'workouts':   wrap.appendChild(workoutsSection(s));   break;
    case 'sleep':      wrap.appendChild(sleepSection(s));      break;
    case 'mood':       wrap.appendChild(moodSection(s));       break;
    case 'meals':      wrap.appendChild(mealsSection(s));      break;
  }

  return wrap;
}

// ─── 9.1 MEDS ────────────────────────────────────────────────
function medsSection(s) {
  const day = todayKey();
  const taken = new Set(s.health.medLog.filter((l) => l.date === day && l.taken).map((l) => l.medId));

  return el('div', { class: 'stack' }, [
    // Today's checklist
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-pill' }), 'today', el('small', null, `${taken.size}/${s.health.meds.length}`)]),
      s.health.meds.length === 0
        ? el('p', { class: 'muted', style: { margin: 0 } }, 'no medicines yet — add one below.')
        : el('div', { class: 'stack' }, s.health.meds.map((m) => {
            const isDone = taken.has(m.id);
            const row = el('label', { class: 'check', dataset: { done: String(isDone) } }, [
              el('span', { class: 'check__box', 'aria-hidden': 'true' }),
              el('span', { class: 'check__label' }, [
                el('strong', null, m.name),
                m.dose ? el('span', { class: 'muted' }, ` · ${m.dose}`) : null,
              ]),
              el('span', { class: 'check__meta' }, [
                m.schedule || '',
                m.withFood ? el('span', { class: 'chip', style: { marginLeft: '6px' } }, '🍽 w/food') : null,
              ]),
            ]);
            row.addEventListener('click', (e) => {
              e.preventDefault();
              const rect = row.querySelector('.check__box').getBoundingClientRect();
              update((d) => {
                // Clear today's prior entries for this med, then add fresh one if taking.
                d.health.medLog = d.health.medLog.filter((l) => !(l.date === day && l.medId === m.id));
                d.doneJar.byDate[day] = d.doneJar.byDate[day] || [];
                if (!isDone) {
                  d.health.medLog.push({
                    id: uid('ml'), medId: m.id, date: day,
                    time: new Date().toISOString(), taken: true, skipReason: null,
                  });
                  const med = d.health.meds.find((x) => x.id === m.id);
                  if (med && Number.isFinite(med.stockCount) && med.stockCount > 0) med.stockCount -= 1;
                  d.doneJar.byDate[day].push({ kind: 'med', id: m.id, label: m.name, at: new Date().toISOString() });
                } else {
                  // Untick — refund stock if we'd decremented earlier
                  const med = d.health.meds.find((x) => x.id === m.id);
                  if (med && Number.isFinite(med.stockCount)) med.stockCount += 1;
                  d.doneJar.byDate[day] = d.doneJar.byDate[day].filter((j) => !(j.kind === 'med' && j.id === m.id));
                }
              });
              if (!isDone) { bloomAt(rect.left + rect.width / 2, rect.top + rect.height / 2); haptic(8); }
            });
            // Skip-reason chip (if missed)
            if (!isDone && m.schedule && isPastTodayWindow(m.schedule)) {
              row.appendChild(el('button', {
                class: 'btn btn--soft', style: { padding: '4px 10px', fontSize: '0.7rem' },
                onClick: (e) => {
                  e.preventDefault();
                  const reason = prompt('skip reason (no shame, just data)');
                  if (reason == null) return;
                  update((d) => d.health.medLog.push({
                    id: uid('ml'), medId: m.id, date: day,
                    time: new Date().toISOString(), taken: false, skipReason: reason,
                  }));
                }
              }, 'skipped'));
            }
            return row;
          })),
    ]),

    // Adherence + refill summary
    adherenceCard(s),

    // Med list management
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-list-checks' }), 'medicines']),
      el('div', { class: 'stack' }, s.health.meds.map((m) => el('div', { class: 'row row--between' }, [
        el('div', null, [
          el('div', null, [el('strong', null, m.name), m.type ? el('span', { class: 'muted' }, ` · ${m.type}`) : null]),
          el('div', { class: 'muted', style: { fontSize: '0.75rem' } },
            [m.dose, m.schedule, Number.isFinite(m.stockCount) ? `${m.stockCount} left` : null].filter(Boolean).join(' · ')),
        ]),
        el('button', { class: 'btn btn--soft', onClick: () => openMedEdit(m) }, 'edit'),
      ]))),
      el('button', { class: 'btn btn--ghost', style: { marginTop: '8px' }, onClick: () => openMedEdit(null) }, '+ add medicine'),
    ]),
  ]);
}

function isPastTodayWindow(schedule) {
  // Crude: if schedule contains "morning", past 12; "evening"/"night", past 22
  const h = new Date().getHours();
  const s = (schedule || '').toLowerCase();
  if (/morning|am|breakfast/.test(s)) return h >= 12;
  if (/afternoon|lunch/.test(s))      return h >= 16;
  if (/evening|dinner|night|pm/.test(s)) return h >= 22;
  return false;
}

function adherenceCard(s) {
  const meds = s.health.meds;
  if (meds.length === 0) return el('div');
  const days = 7;
  let scheduled = 0, taken = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = todayKey(d);
    for (const m of meds) {
      if (!m.schedule || m.schedule === 'asneeded') continue;
      scheduled += 1;
      if (s.health.medLog.some((l) => l.date === key && l.medId === m.id && l.taken)) taken += 1;
    }
  }
  const pct = scheduled ? Math.round((taken / scheduled) * 100) : 0;
  const refills = meds.filter((m) => Number.isFinite(m.stockCount) && m.stockCount <= 14)
    .map((m) => ({ name: m.name, daysLeft: m.stockCount }));
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-chart-line' }), 'adherence', el('small', null, '7d')]),
    el('div', { class: 'row row--between' }, [
      el('span', null, [el('strong', null, `${pct}%`), el('span', { class: 'muted' }, ` · ${taken}/${scheduled}`)]),
      el('span', { class: 'muted', style: { fontSize: '0.75rem' } }, pct >= 80 ? 'strong week ✿' : 'we shrink, not skip'),
    ]),
    refills.length ? el('div', { style: { marginTop: '8px' } }, [
      el('div', { class: 'field__label' }, 'refill soon'),
      el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } },
        refills.map((r) => el('span', { class: 'chip' }, `${r.name} · ~${r.daysLeft}d`)))
    ]) : null,
  ]);
}

function openMedEdit(existing) {
  const m = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: uid('m'), name: '', type: '', dose: '', schedule: 'morning', withFood: false, stockCount: null,
  };
  const fName = el('input', { class: 'input', value: m.name, placeholder: 'e.g. iron' });
  const fType = el('input', { class: 'input', value: m.type, placeholder: 'tablet / drop / serum' });
  const fDose = el('input', { class: 'input', value: m.dose, placeholder: '1 tab' });
  const fSched = el('select', { class: 'select' },
    ['morning','afternoon','evening','night','morning+night','asneeded'].map((v) =>
      el('option', { value: v, selected: m.schedule === v }, v)));
  const fFood = el('input', { type: 'checkbox', checked: m.withFood });
  const fStock = el('input', { class: 'input', type: 'number', min: 0, value: m.stockCount ?? '', placeholder: 'pieces left' });
  openSheet(el('div', { class: 'stack' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'name'), fName]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'type'), fType]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'dose'), fDose]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'schedule'), fSched]),
    el('label', { class: 'row' }, [fFood, el('span', null, ' take with food')]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'stock count (optional)'), fStock]),
    el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', { class: 'btn btn--block', onClick: () => {
        m.name = fName.value.trim();
        m.type = fType.value;
        m.dose = fDose.value;
        m.schedule = fSched.value;
        m.withFood = fFood.checked;
        const sc = parseInt(fStock.value, 10);
        m.stockCount = Number.isFinite(sc) ? sc : null;
        if (!m.name) { toast('needs a name'); return; }
        update((d) => {
          const i = d.health.meds.findIndex((x) => x.id === m.id);
          if (i === -1) d.health.meds.push(m); else d.health.meds[i] = m;
        });
        closeSheet(); toast(existing ? 'saved ✓' : 'added ✓');
      } }, 'save'),
      existing ? el('button', { class: 'btn btn--ghost', onClick: () => {
        if (!confirm(`delete ${m.name}?`)) return;
        update((d) => { d.health.meds = d.health.meds.filter((x) => x.id !== m.id); });
        closeSheet();
      } }, [el('i', { class: 'ph ph-trash' })]) : null,
    ]),
  ]), { title: existing ? 'edit medicine' : 'new medicine' });
}

// ─── 9.2 SKINCARE ────────────────────────────────────────────
function skincareSection(s) {
  const day = todayKey();
  const log = (s.health.skincare.log || []).filter((l) => l.date === day);
  const lastExfo = (s.health.skincare.log || []).filter((l) => l.exfoliated).slice(0, 1)[0];
  const daysSinceExfo = lastExfo ? Math.max(0, Math.floor((Date.now() - Date.parse(lastExfo.date + 'T00:00:00')) / 86_400_000)) : null;

  return el('div', { class: 'stack' }, [
    // AM / PM checklists
    routineCard(s, 'am'),
    routineCard(s, 'pm'),
    // Exfoliation tracker
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-sun-horizon' }), 'exfoliation']),
      daysSinceExfo == null ? el('p', { class: 'muted', style: { margin: 0 } }, 'never logged — that\'s fine.') :
        el('p', { class: 'muted', style: { margin: 0 } }, `${daysSinceExfo} day${daysSinceExfo === 1 ? '' : 's'} since last exfoliation`),
      el('button', { class: 'btn btn--ghost', style: { marginTop: '8px' }, onClick: () => {
        update((d) => (d.health.skincare.log ||= []).unshift({ id: uid('sk'), date: day, exfoliated: true, time: new Date().toISOString() }));
        toast('logged ✓');
      } }, 'log exfoliation today'),
    ]),
    // Product inventory
    productsCard(s),
  ]);
}

function routineCard(s, kind) {
  const day = todayKey();
  const steps = s.health.skincare[kind] || [];
  const doneList = (s.health.skincare.log || []).filter((l) => l.date === day && l.kind === kind);
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: kind === 'am' ? 'ph-duotone ph-sun' : 'ph-duotone ph-moon' }),
      `routine — ${kind.toUpperCase()}`,
      el('small', null, `${doneList.length}/${steps.length}`),
    ]),
    steps.length === 0
      ? el('p', { class: 'muted', style: { margin: 0 } }, `set up your ${kind.toUpperCase()} routine below.`)
      : el('ol', { style: { paddingLeft: '20px', margin: 0 } }, steps.map((step) => {
          const isDone = doneList.some((l) => l.step === step);
          const row = el('label', { class: 'check', dataset: { done: String(isDone) }, style: { padding: 0 } }, [
            el('span', { class: 'check__box', 'aria-hidden': 'true' }),
            el('span', { class: 'check__label' }, step),
          ]);
          row.addEventListener('click', (e) => {
            e.preventDefault();
            update((d) => {
              d.health.skincare.log ||= [];
              // toggle: if any entry today for this kind+step exists, remove it;
              // otherwise add a fresh one.
              const has = d.health.skincare.log.some((l) => l.date === day && l.kind === kind && l.step === step);
              if (has) {
                d.health.skincare.log = d.health.skincare.log.filter((l) => !(l.date === day && l.kind === kind && l.step === step));
              } else {
                d.health.skincare.log.push({ id: uid('sk'), date: day, kind, step, time: new Date().toISOString() });
              }
            });
          });
          return el('li', { style: { padding: '2px 0' } }, [row]);
        })),
    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => editRoutine(kind) }, [el('i', { class: 'ph ph-pencil-simple' }), ' edit']),
      el('button', { class: 'btn btn--ghost', onClick: () => {
        update((d) => {
          (d.health.skincare.log ||= []).push({ id: uid('sk'), date: day, kind, step: 'whole routine', time: new Date().toISOString() });
        });
        toast(`${kind.toUpperCase()} routine done ✿`);
      } }, 'mark whole routine done'),
    ]),
  ]);
}

function editRoutine(kind) {
  const s = getState();
  const steps = [...(s.health.skincare[kind] || [])];
  const wrap = el('div', { class: 'stack' });
  function paintIt() {
    wrap.innerHTML = '';
    steps.forEach((step, i) => {
      const inp = el('input', { class: 'input', value: step, style: { flex: '1' } });
      const up  = el('button', { class: 'btn btn--soft', onClick: () => { if (i > 0) { [steps[i-1], steps[i]] = [steps[i], steps[i-1]]; paintIt(); } } }, [el('i', { class: 'ph ph-arrow-up' })]);
      const dn  = el('button', { class: 'btn btn--soft', onClick: () => { if (i < steps.length-1) { [steps[i+1], steps[i]] = [steps[i], steps[i+1]]; paintIt(); } } }, [el('i', { class: 'ph ph-arrow-down' })]);
      const rm  = el('button', { class: 'btn btn--soft', onClick: () => { steps.splice(i, 1); paintIt(); } }, [el('i', { class: 'ph ph-trash' })]);
      inp.addEventListener('change', () => { steps[i] = inp.value; });
      wrap.appendChild(el('div', { class: 'row', style: { gap: '4px' } }, [inp, up, dn, rm]));
    });
    wrap.appendChild(el('button', { class: 'btn btn--soft btn--block', onClick: () => { steps.push('new step'); paintIt(); } }, '+ step'));
    wrap.appendChild(el('button', { class: 'btn btn--block', onClick: () => {
      update((d) => { d.health.skincare[kind] = steps.filter(Boolean); });
      closeSheet(); toast('saved ✓');
    } }, 'save'));
  }
  paintIt();
  openSheet(wrap, { title: `${kind.toUpperCase()} routine` });
}

function productsCard(s) {
  const products = s.health.skincare.products || [];
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-test-tube' }), 'products', el('small', null, `${products.length}`)]),
    products.length === 0 ? el('p', { class: 'muted', style: { margin: 0 } }, 'no products tracked.') :
      el('div', { class: 'stack' }, products.map((p) => {
        const opened = p.openedAt ? new Date(p.openedAt) : null;
        const daysOpen = opened ? Math.floor((Date.now() - opened.getTime()) / 86_400_000) : null;
        const expiring = p.lifeMonths && daysOpen != null && daysOpen > p.lifeMonths * 30 - 14;
        return el('div', { class: 'row row--between' }, [
          el('div', null, [
            el('div', null, p.name),
            el('div', { class: 'muted', style: { fontSize: '0.75rem' } },
              opened ? `opened ${opened.toLocaleDateString()}${daysOpen != null ? ` · ${daysOpen}d` : ''}` : 'not opened yet'),
          ]),
          expiring ? el('span', { class: 'chip', style: { color: 'var(--primary-deep)' } }, 'expiring soon') : null,
        ]);
      })),
    el('button', { class: 'btn btn--ghost', style: { marginTop: '8px' }, onClick: () => openProductEdit() }, '+ add product'),
  ]);
}

function openProductEdit() {
  const fName = el('input', { class: 'input', placeholder: 'product name' });
  const fOpened = el('input', { class: 'input', type: 'date', value: new Date().toISOString().slice(0, 10) });
  const fLife = el('input', { class: 'input', type: 'number', min: 1, max: 36, value: 6, placeholder: 'months' });
  openSheet(el('div', { class: 'stack' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'name'), fName]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'date opened'), fOpened]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'shelf life (months)'), fLife]),
    el('button', { class: 'btn btn--block', onClick: () => {
      if (!fName.value.trim()) { toast('needs a name'); return; }
      update((d) => (d.health.skincare.products ||= []).push({
        id: uid('p'), name: fName.value.trim(),
        openedAt: fOpened.value || null, lifeMonths: parseInt(fLife.value, 10) || 6,
      }));
      closeSheet(); toast('added ✓');
    } }, 'add'),
  ]), { title: 'add product' });
}

// ─── 9.3 MEDITATION ──────────────────────────────────────────
function meditationSection(s) {
  const log = s.health.meditationLog || [];
  const streak = streakDays(log.map((l) => l.date));
  const totalMins = log.reduce((n, l) => n + (l.mins || 0), 0);
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card card--hero' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-yin-yang' }), 'meditation']),
      el('div', { class: 'row', style: { gap: '16px', alignItems: 'baseline' } }, [
        el('div', null, [el('div', { style: { fontSize: '1.5rem', fontFamily: 'var(--font-display)', fontStyle: 'italic' } }, streak), el('div', { class: 'muted', style: { fontSize: '0.7rem' } }, 'day showing-up')]),
        el('div', null, [el('div', { style: { fontSize: '1.5rem', fontFamily: 'var(--font-display)', fontStyle: 'italic' } }, fmtMinutes(totalMins)), el('div', { class: 'muted', style: { fontSize: '0.7rem' } }, 'total minutes')]),
      ]),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-plus-circle' }), 'log a session']),
      logQuickAdder('meditation', ['5','10','15','20','30','45'], (mins, mood) => {
        update((d) => (d.health.meditationLog ||= []).unshift({
          id: uid('md'), date: todayKey(), mins, moodAfter: mood,
          time: new Date().toISOString(),
        }));
      }),
    ]),
    recentList(log, 'meditation', (l) => `${fmtMinutes(l.mins)} · ${l.date}${l.moodAfter ? ` · felt ${l.moodAfter}` : ''}`),
  ]);
}

function logQuickAdder(kind, presets, onPick) {
  const row = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } });
  presets.forEach((m) => row.appendChild(el('button', {
    class: 'chip', type: 'button', style: { cursor: 'pointer' },
    onClick: () => { onPick(parseInt(m, 10), null); toast(`${kind} · ${m}m logged ✓`); }
  }, `${m}m`)));
  return row;
}

function recentList(log, label, fmt) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-list-bullets' }), 'recent']),
    log.length === 0
      ? el('p', { class: 'muted', style: { margin: 0 } }, 'no entries yet.')
      : el('div', { class: 'stack' }, log.slice(0, 20).map((l) => el('div', { class: 'row row--between' }, [
          el('span', null, fmt(l)),
          el('span', { class: 'muted', style: { fontSize: '0.75rem' } }, ''),
        ]))),
  ]);
}

function streakDays(dates) {
  const set = new Set(dates);
  let n = 0;
  const d = new Date();
  while (set.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return `${n} day${n === 1 ? '' : 's'}`;
}

// ─── 9.4 WORKOUTS ────────────────────────────────────────────
function workoutsSection(s) {
  const log = s.health.workoutLog || [];
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-barbell' }), 'log a workout']),
      el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
        ['hiit','cardio','strength','yoga','walk','dance'].map((t) =>
          el('button', { class: 'chip', type: 'button', style: { cursor: 'pointer' }, onClick: () => quickLogWorkout(t) }, t))),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-drop' }), 'water & steps']),
      waterRow(s),
      stepsRow(s),
    ]),
    recentList(log, 'workout', (l) => `${l.type} · ${fmtMinutes(l.mins || 0)} · ${l.date}`),
  ]);
}

function quickLogWorkout(type) {
  const mins = parseInt(prompt(`${type} — how many minutes?`, '30'), 10);
  if (!Number.isFinite(mins) || mins <= 0) return;
  update((d) => (d.health.workoutLog ||= []).unshift({
    id: uid('w'), type, mins, date: todayKey(), time: new Date().toISOString(),
  }));
  toast('workout logged ✿');
}

function waterRow(s) {
  const day = todayKey();
  const water = s.health.water?.byDate?.[day] || 0;
  const goal = 8;
  return el('div', { style: { marginBottom: '10px' } }, [
    el('div', { class: 'row row--between', style: { marginBottom: '4px' } }, [
      el('span', null, [el('i', { class: 'ph-duotone ph-drop', style: { color: 'var(--primary)' } }), ' water']),
      el('span', { class: 'muted' }, `${water}/${goal} cups`),
    ]),
    el('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } },
      Array.from({ length: goal }, (_, i) => el('button', {
        class: 'chip', type: 'button', style: { cursor: 'pointer', padding: '4px 8px',
          background: i < water ? 'var(--primary-soft)' : 'var(--surface-2)' },
        onClick: () => update((d) => {
          d.health.water = d.health.water || { byDate: {} };
          d.health.water.byDate[day] = i < water ? i : i + 1;
        })
      }, i < water ? '💧' : '·'))),
  ]);
}

function stepsRow(s) {
  const day = todayKey();
  const steps = s.health.steps?.byDate?.[day] || 0;
  return el('div', { class: 'row row--between' }, [
    el('span', null, [el('i', { class: 'ph-duotone ph-sneaker-move', style: { color: 'var(--primary)' } }), ' steps']),
    el('div', { class: 'row', style: { gap: '6px' } }, [
      el('span', { class: 'muted' }, `${steps.toLocaleString()}/10,000`),
      el('button', { class: 'btn btn--soft', onClick: () => {
        const v = parseInt(prompt('steps today?', steps || '0'), 10);
        if (!Number.isFinite(v) || v < 0) return;
        update((d) => { d.health.steps = d.health.steps || { byDate: {} }; d.health.steps.byDate[day] = v; });
      } }, 'set'),
    ]),
  ]);
}

// ─── 9.5 SLEEP ───────────────────────────────────────────────
function sleepSection(s) {
  const log = s.health.sleepLog || [];
  const last = log[0];
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card card--hero' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-moon-stars' }), 'last night']),
      last ? el('div', null, [
        el('div', { style: { fontSize: '1.5rem', fontFamily: 'var(--font-display)', fontStyle: 'italic' } },
          `${last.hours || '—'} hours`),
        el('div', { class: 'muted', style: { fontSize: '0.75rem' } },
          `${last.bedtime || '—'} → ${last.wake || '—'} · quality ${last.quality || '—'}/5`),
      ]) : el('p', { class: 'muted', style: { margin: 0 } }, 'no sleep logs yet.'),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-plus-circle' }), 'log sleep']),
      sleepEntryForm(),
    ]),
    recentList(log, 'sleep', (l) => `${l.date} · ${l.hours || '—'}h · quality ${l.quality || '—'}/5`),
  ]);
}

function sleepEntryForm() {
  const fBed = el('input', { class: 'input', type: 'time', value: '23:00' });
  const fWake = el('input', { class: 'input', type: 'time', value: '07:00' });
  const fQual = el('select', { class: 'select' }, [1,2,3,4,5].map((n) => el('option', { value: n, selected: n === 3 }, `${n}/5`)));
  return el('div', { class: 'stack' }, [
    el('div', { class: 'row', style: { gap: '6px' } }, [
      el('label', { class: 'field', style: { flex: 1, margin: 0 } }, [el('span', { class: 'field__label' }, 'bedtime'), fBed]),
      el('label', { class: 'field', style: { flex: 1, margin: 0 } }, [el('span', { class: 'field__label' }, 'wake'), fWake]),
    ]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'quality'), fQual]),
    el('button', { class: 'btn btn--block', onClick: () => {
      const [bh, bm] = fBed.value.split(':').map(Number);
      const [wh, wm] = fWake.value.split(':').map(Number);
      let hours = ((wh*60 + wm) - (bh*60 + bm)) / 60;
      if (hours <= 0) hours += 24;
      update((d) => (d.health.sleepLog ||= []).unshift({
        id: uid('sl'), date: todayKey(), bedtime: fBed.value, wake: fWake.value,
        hours: Math.round(hours * 10) / 10, quality: parseInt(fQual.value, 10), time: new Date().toISOString(),
      }));
      toast('sleep logged ✿');
    } }, 'log'),
  ]);
}

// ─── 9.6 MOOD ────────────────────────────────────────────────
function moodSection(s) {
  const log = s.health.moodLog || [];
  const today = log.find((l) => l.date === todayKey());
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card card--hero' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-smiley' }), 'today']),
      el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
        [['🌧','low'], ['🌫','meh'], ['☁️','okay'], ['⛅','good'], ['🌞','great']].map(([emoji, label], i) => {
          const score = i + 1;
          const active = today?.score === score;
          return el('button', {
            class: active ? 'chip chip--primary' : 'chip', type: 'button',
            style: { cursor: 'pointer', padding: '10px 14px', fontSize: '1rem' },
            onClick: () => update((d) => {
              d.health.moodLog ||= [];
              const i2 = d.health.moodLog.findIndex((l) => l.date === todayKey());
              const entry = { id: today?.id || uid('mo'), date: todayKey(), score, label, time: new Date().toISOString() };
              if (i2 >= 0) d.health.moodLog[i2] = entry; else d.health.moodLog.unshift(entry);
            })
          }, [el('span', { style: { marginRight: '4px' } }, emoji), label]);
        })
      ),
    ]),
    recentList(log, 'mood', (l) => `${l.date} · ${l.label || ''} (${l.score}/5)`),
  ]);
}

// ─── 9.7 MEALS — yes/no only (anti-goal §18: no numbers) ────
function mealsSection(s) {
  const log = s.health.mealLog || [];
  const day = todayKey();
  const today = log.find((l) => l.date === day) || { breakfast: false, lunch: false, dinner: false, snack: false };
  function setMeal(key) {
    update((d) => {
      d.health.mealLog ||= [];
      const i = d.health.mealLog.findIndex((l) => l.date === day);
      const next = { ...(today || {}), date: day, [key]: !today[key], time: new Date().toISOString() };
      if (i >= 0) d.health.mealLog[i] = next; else d.health.mealLog.unshift(next);
    });
  }
  const m = (key, label, emoji) => {
    const isDone = today[key];
    const row = el('label', { class: 'check', dataset: { done: String(!!isDone) } }, [
      el('span', { class: 'check__box', 'aria-hidden': 'true' }),
      el('span', { class: 'check__label' }, `${emoji} ${label}`),
    ]);
    row.addEventListener('click', (e) => { e.preventDefault(); setMeal(key); });
    return row;
  };
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-bowl-food' }), 'meals — yes/no only', el('small', null, 'no numbers')]),
      m('breakfast', 'breakfast', '🥣'),
      m('lunch', 'lunch', '🍲'),
      m('dinner', 'dinner', '🍛'),
      m('snack', 'snack', '🍎'),
      el('p', { class: 'muted', style: { fontSize: '0.75rem', marginTop: '8px' } },
        'regularity > anything. no calorie / weight / restriction.'),
    ]),
    recentList(log, 'meals', (l) => `${l.date} · ${['breakfast','lunch','dinner','snack'].filter((k) => l[k]).join(' / ') || 'none'}`),
  ]);
}
