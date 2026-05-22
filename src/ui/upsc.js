// UPSC · full module: syllabus tree · sources · spaced revisions · PYQ ·
// mocks · answer-writing · current affairs · topic notes · essay bank · planner.
// First-timer roadmap surfaces when there's no data yet.

import { el, clear, openSheet, closeSheet, toast, viewOnlyBanner } from '../utils/dom.js';
import { getState, update, subscribe, uid } from '../state.js';
import { todayKey, fmtMinutes, fmtDate, relative } from '../utils/format.js';
import { defaultSyllabusTree, STATUS_LABELS, DEFAULT_SOURCES } from '../data/upsc-syllabus.js';
import { isCopilot, writeGate, isOwner } from '../auth.js';

const SECTIONS = [
  { id: 'dashboard', label: 'today',      icon: 'ph-flower' },
  { id: 'syllabus',  label: 'syllabus',   icon: 'ph-tree-structure' },
  { id: 'revisions', label: 'revisions',  icon: 'ph-arrows-clockwise' },
  { id: 'sources',   label: 'booklist',   icon: 'ph-books' },
  { id: 'pyq',       label: 'PYQs',       icon: 'ph-list-numbers' },
  { id: 'mocks',     label: 'mocks',      icon: 'ph-exam' },
  { id: 'answers',   label: 'answers',    icon: 'ph-pen-nib' },
  { id: 'ca',        label: 'CA',         icon: 'ph-newspaper' },
  { id: 'essays',    label: 'essays',     icon: 'ph-feather' },
  { id: 'planner',   label: 'planner',    icon: 'ph-calendar-heart' },
];

let active = 'dashboard';

export function renderUPSC(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(build()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function build() {
  const s = getState();
  // First-run: seed syllabus if empty · only sriya can seed.
  if (isOwner() && !s.upsc.syllabusTree) {
    update((d) => { d.upsc.syllabusTree = defaultSyllabusTree(); });
  }
  if (isOwner() && (s.upsc.sources || []).length === 0) {
    update((d) => { d.upsc.sources = DEFAULT_SOURCES.map((x) => ({ ...x, pctDone: 0, stage: '1st-read', completed: false })); });
  }

  const wrap = el('div', { class: 'stack' });
  wrap.appendChild(el('h1', null, ['UPSC ', el('i', { class: 'ph-duotone ph-books', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]));
  if (isCopilot()) wrap.appendChild(viewOnlyBanner('view-only · sriya\'s UPSC prep'));
  wrap.appendChild(el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
    SECTIONS.map((sec) => el('button', {
      class: active === sec.id ? 'chip chip--primary' : 'chip',
      type: 'button', style: { cursor: 'pointer' },
      onClick: () => { active = sec.id; update((d) => { d.upsc._uiTick = (d.upsc._uiTick || 0) + 1; }); }
    }, [el('i', { class: `ph ${sec.icon}` }), ' ', sec.label]))
  ));

  switch (active) {
    case 'dashboard': wrap.appendChild(dashboardSection(getState())); break;
    case 'syllabus':  wrap.appendChild(syllabusSection(getState()));  break;
    case 'revisions': wrap.appendChild(revisionsSection(getState())); break;
    case 'sources':   wrap.appendChild(sourcesSection(getState()));   break;
    case 'pyq':       wrap.appendChild(pyqSection(getState()));       break;
    case 'mocks':     wrap.appendChild(mocksSection(getState()));     break;
    case 'answers':   wrap.appendChild(answersSection(getState()));   break;
    case 'ca':        wrap.appendChild(caSection(getState()));        break;
    case 'essays':    wrap.appendChild(essaysSection(getState()));    break;
    case 'planner':   wrap.appendChild(plannerSection(getState()));   break;
  }
  return wrap;
}

// ─── DASHBOARD ───────────────────────────────────────────────
function dashboardSection(s) {
  const today = todayKey();
  const dueRevs = (s.upsc.revisions || []).filter((r) => !r.done && r.dueDate <= today);
  const upscMins = s.timer.log.filter((e) => e.categoryId === 'upsc').reduce((n, e) => n + (e.mins || 0), 0);
  const planner = s.upsc.plannerConfig || {};
  const examDate = planner.examDate ? new Date(planner.examDate) : null;
  const daysToExam = examDate ? Math.ceil((examDate - new Date()) / 86_400_000) : null;

  return el('div', { class: 'stack' }, [
    el('div', { class: 'card card--hero' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-flower' }), 'today, slowly']),
      el('p', { class: 'muted', style: { margin: 0 } }, planner.stage
        ? `target: ${planner.stage}${planner.year ? ` ${planner.year}` : ''}${daysToExam != null ? ` · ${daysToExam}d to go` : ''}`
        : 'set your target in planner · Prelims/Mains + year.'),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-arrows-clockwise' }), 'due today', el('small', null, `${dueRevs.length}`)]),
      dueRevs.length === 0
        ? el('p', { class: 'muted', style: { margin: 0 } }, 'no revisions due · set status "reading" on a topic to start the cycle.')
        : el('div', { class: 'stack' }, dueRevs.slice(0, 8).map((r) => el('div', { class: 'row row--between' }, [
            el('span', null, [el('span', { class: 'chip', style: { marginRight: '6px' } }, r.stage || 'R1'), r.topic]),
            el('button', { class: 'btn btn--soft', onClick: () => completeRevision(r) }, 'done'),
          ]))),
      dueRevs.length > 8 ? el('button', { class: 'btn btn--ghost', style: { marginTop: '8px' }, onClick: () => { active = 'revisions'; update((d) => { d.upsc._uiTick++; }); } }, 'all due') : null,
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-timer' }), 'time on UPSC']),
      el('p', { style: { margin: 0 } }, fmtMinutes(upscMins)),
      el('p', { class: 'muted', style: { fontSize: '0.7rem', margin: '4px 0 0' } }, 'pulled from the Timer category "UPSC".'),
    ]),

    weakAreasCard(s),
    roadmapCard(s),
  ]);
}

function weakAreasCard(s) {
  // Weak = revisions repeatedly marked "reading" but never "confident"
  const counts = {};
  for (const r of s.upsc.revisions || []) {
    if (!r.topic) continue;
    counts[r.topic] = (counts[r.topic] || 0) + 1;
  }
  const weak = Object.entries(counts).filter(([, n]) => n >= 3).slice(0, 5);
  if (weak.length === 0) return el('div');
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-warning-circle' }), 'weak areas', el('small', null, 'surface, not shame')]),
    el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
      weak.map(([t]) => el('span', { class: 'chip' }, t))),
  ]);
}

function roadmapCard(s) {
  if ((s.upsc.sources || []).some((x) => x.pctDone > 0)) return el('div'); // hide once started
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-compass' }), 'first-timer roadmap']),
    el('ol', { style: { paddingLeft: '20px', margin: 0 } }, [
      el('li', null, 'one source per subject · guardrail. resist the collector\'s instinct.'),
      el('li', null, 'set status "reading" on 2–3 topics in syllabus → they auto-schedule R1/R2/R3 revisions.'),
      el('li', null, 'pick a stage in planner (Prelims/Mains) + exam year · the calendar gets a countdown.'),
      el('li', null, 'PYQs mapped to topics show what\'s high-yield.'),
      el('li', null, 'one mock test per week. score trend > absolute score.'),
      el('li', null, 'current affairs = 30 min/day, tagged by GS paper.'),
    ]),
  ]);
}

// ─── SYLLABUS ────────────────────────────────────────────────
function syllabusSection(s) {
  const tree = s.upsc.syllabusTree || {};
  const wrap = el('div', { class: 'stack' });
  Object.entries(tree).forEach(([key, node]) => {
    const done = node.topics.filter((t) => t.status === 'confident').length;
    const partial = node.topics.filter((t) => t.status === 'reading' || t.status === 'revised').length;
    const card = el('details', { class: 'card', style: { padding: '12px 14px' } }, [
      el('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, [
        node.label, ' ',
        el('span', { class: 'muted', style: { fontSize: '0.75rem' } }, `${done}/${node.topics.length} · ${partial} active`),
      ]),
      el('div', { class: 'stack', style: { marginTop: '8px' } },
        node.topics.map((t) => topicRow(key, t))),
    ]);
    wrap.appendChild(card);
  });
  return wrap;
}

function topicRow(subjectKey, topic) {
  const status = topic.status || 'not-started';
  return el('div', { class: 'row row--between', style: { padding: '4px 0', borderTop: '1px dashed var(--line)' } }, [
    el('span', { style: { flex: 1, fontSize: '0.875rem' } }, topic.label),
    el('select', {
      class: 'select', style: { width: '130px', padding: '4px 8px', fontSize: '0.75rem' },
      onChange: (e) => setStatus(subjectKey, topic.id, e.target.value),
    }, Object.entries(STATUS_LABELS).map(([v, info]) =>
      el('option', { value: v, selected: status === v }, info.label))),
  ]);
}

function setStatus(subjectKey, topicId, newStatus) {
  update((d) => {
    const topic = d.upsc.syllabusTree[subjectKey].topics.find((t) => t.id === topicId);
    if (!topic) return;
    const wasNotStarted = !topic.status || topic.status === 'not-started';
    topic.status = newStatus;
    // If moving to "reading" for the first time, spawn R1/R2/R3 revisions
    if (wasNotStarted && newStatus === 'reading') {
      const today = new Date();
      const stages = [
        { stage: 'R1', offsetDays: 1 },
        { stage: 'R2', offsetDays: 7 },
        { stage: 'R3', offsetDays: 30 },
      ];
      for (const { stage, offsetDays } of stages) {
        const due = new Date(today); due.setDate(due.getDate() + offsetDays);
        d.upsc.revisions.push({
          id: uid('rv'), topic: topic.label, topicId: topic.id, subject: subjectKey,
          stage, dueDate: due.toISOString().slice(0, 10), createdAt: today.toISOString(), done: false,
        });
      }
    }
  });
  toast('saved ✓');
}

// ─── REVISIONS ───────────────────────────────────────────────
function revisionsSection(s) {
  const today = todayKey();
  const due = (s.upsc.revisions || []).filter((r) => !r.done && r.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcoming = (s.upsc.revisions || []).filter((r) => !r.done && r.dueDate > today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 15);
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-arrows-clockwise' }), 'due now', el('small', null, `${due.length}`)]),
      due.length === 0
        ? el('p', { class: 'muted', style: { margin: 0 } }, 'all caught up ✿')
        : el('div', { class: 'stack' }, due.map((r) => el('div', { class: 'row row--between' }, [
            el('span', null, [
              el('span', { class: 'chip', style: { marginRight: '6px' } }, r.stage),
              r.topic,
            ]),
            el('div', { class: 'row', style: { gap: '6px' } }, [
              el('span', { class: 'chip muted', style: { fontSize: '0.7rem' } }, r.dueDate),
              el('button', { class: 'btn btn--soft', onClick: () => completeRevision(r) }, 'done'),
            ]),
          ]))),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-calendar-blank' }), 'upcoming', el('small', null, `${upcoming.length}`)]),
      upcoming.length === 0
        ? el('p', { class: 'muted', style: { margin: 0 } }, 'set "reading" status on syllabus topics to spawn revisions.')
        : el('div', { class: 'stack' }, upcoming.map((r) => el('div', { class: 'row row--between' }, [
            el('span', null, [el('span', { class: 'chip', style: { marginRight: '6px' } }, r.stage), r.topic]),
            el('span', { class: 'muted', style: { fontSize: '0.75rem' } }, r.dueDate),
          ]))),
    ]),
  ]);
}

function completeRevision(r) {
  update((d) => {
    const x = d.upsc.revisions.find((y) => y.id === r.id);
    if (!x) return;
    x.done = true;
    x.completedAt = new Date().toISOString();
    // Bump topic status (reading → revised → confident)
    const subj = d.upsc.syllabusTree?.[x.subject];
    if (subj) {
      const topic = subj.topics.find((t) => t.id === x.topicId);
      if (topic) {
        if (topic.status === 'reading')  topic.status = 'revised';
        else if (topic.status === 'revised' && x.stage === 'R3') topic.status = 'confident';
      }
    }
    d.doneJar.byDate[todayKey()] = d.doneJar.byDate[todayKey()] || [];
    d.doneJar.byDate[todayKey()].push({ kind: 'revision', id: x.id, label: `${x.stage} · ${x.topic}`, at: new Date().toISOString() });
  });
  toast('revised ✓');
}

// ─── SOURCES / BOOKLIST ──────────────────────────────────────
function sourcesSection(s) {
  const list = s.upsc.sources || [];
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-books' }), 'booklist', el('small', null, `${list.filter((x) => x.completed).length}/${list.length}`)]),
      el('p', { class: 'muted', style: { margin: 0, fontSize: '0.75rem' } }, 'one source per subject. avoid the collector trap.'),
      el('div', { class: 'stack', style: { marginTop: '8px' } }, list.map((src, i) => sourceRow(src, i))),
      el('button', { class: 'btn btn--ghost', style: { marginTop: '8px' }, onClick: addSource }, '+ add source'),
    ]),
  ]);
}

function sourceRow(src, i) {
  const pct = src.pctDone || 0;
  return el('div', { class: 'card', style: { padding: '10px' } }, [
    el('div', { class: 'row row--between' }, [
      el('div', null, [
        el('div', null, [el('strong', null, src.label)]),
        el('div', { class: 'muted', style: { fontSize: '0.7rem' } }, `${src.subject} · ${src.stage || '1st-read'}`),
      ]),
      el('button', { class: 'btn btn--soft', onClick: () => {
        if (!confirm(`remove ${src.label}?`)) return;
        update((d) => d.upsc.sources.splice(i, 1));
      } }, [el('i', { class: 'ph ph-trash' })]),
    ]),
    el('div', { style: { marginTop: '8px' } }, [
      el('input', {
        type: 'range', min: 0, max: 100, value: pct, style: { width: '100%' },
        onInput: (e) => update((d) => { d.upsc.sources[i].pctDone = parseInt(e.target.value, 10); }),
      }),
      el('div', { class: 'row row--between', style: { fontSize: '0.7rem' } }, [
        el('span', { class: 'muted' }, `${pct}%`),
        el('div', { class: 'row', style: { gap: '4px' } }, [
          el('button', { class: src.stage === '1st-read' ? 'chip chip--primary' : 'chip', onClick: () => update((d) => { d.upsc.sources[i].stage = '1st-read'; }) }, '1st'),
          el('button', { class: src.stage === 'revision' ? 'chip chip--primary' : 'chip', onClick: () => update((d) => { d.upsc.sources[i].stage = 'revision'; }) }, 'rev'),
          el('button', { class: src.completed ? 'chip chip--primary' : 'chip', onClick: () => update((d) => { d.upsc.sources[i].completed = !d.upsc.sources[i].completed; }) }, '✓'),
        ]),
      ]),
    ]),
  ]);
}

function addSource() {
  const label = prompt('source name (e.g. "Indian Polity (Laxmikanth)")');
  if (!label) return;
  const subject = prompt('subject tag (GS1 / GS2 / GS3 / GS4 / Essay / CSAT / CA)', 'GS2');
  if (!subject) return;
  update((d) => d.upsc.sources.push({ id: uid('src'), label, subject, pctDone: 0, stage: '1st-read', completed: false }));
}

// ─── PYQ ─────────────────────────────────────────────────────
function pyqSection(s) {
  const list = s.upsc.pyq || [];
  const bySubject = {};
  list.forEach((p) => (bySubject[p.subject] = bySubject[p.subject] || []).push(p));
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-list-numbers' }), 'previous-year questions', el('small', null, `${list.length}`)]),
      el('p', { class: 'muted', style: { margin: 0, fontSize: '0.75rem' } }, 'high-yield topics get visible once you map a few PYQs.'),
      el('button', { class: 'btn btn--ghost', style: { marginTop: '8px' }, onClick: addPYQ }, '+ add PYQ'),
    ]),
    ...Object.keys(bySubject).sort().map((subj) => el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph ph-tag' }), subj, el('small', null, `${bySubject[subj].length}`)]),
      el('div', { class: 'stack' }, bySubject[subj].slice(0, 10).map((p) => {
        const cb = el('label', { class: 'check', style: { padding: 0 }, dataset: { done: String(p.attempted) } }, [
          el('span', { class: 'check__box', 'aria-hidden': 'true' }),
        ]);
        cb.addEventListener('click', (e) => {
          e.preventDefault();
          update((d) => {
            const x = d.upsc.pyq.find((y) => y.id === p.id);
            if (x) x.attempted = !x.attempted;
          });
        });
        return el('div', { class: 'row row--between' }, [
          el('span', { style: { flex: 1 } }, [el('span', { class: 'chip', style: { marginRight: '6px' } }, p.year), p.q]),
          cb,
        ]);
      })),
    ])),
  ]);
}

function addPYQ() {
  const q = prompt('question text');
  if (!q) return;
  const year = prompt('year (e.g. 2023)');
  if (!year) return;
  const subject = prompt('subject (GS1/2/3/4/Essay/CSAT)', 'GS2');
  if (!subject) return;
  const topic = prompt('mapped topic (free text · e.g. "Federalism")', '');
  update((d) => d.upsc.pyq.push({ id: uid('pyq'), q, year, subject, topic, attempted: false }));
}

// ─── MOCKS ───────────────────────────────────────────────────
function mocksSection(s) {
  const list = s.upsc.mockTests || [];
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-exam' }), 'mock tests', el('small', null, `${list.length}`)]),
      el('button', { class: 'btn', onClick: addMock }, '+ log a mock'),
    ]),
    list.length > 0 ? el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-chart-line-up' }), 'score trend']),
      el('div', { class: 'row', style: { gap: '4px', alignItems: 'flex-end', height: '80px' } },
        list.slice(0, 20).reverse().map((m) => {
          const h = Math.max(4, (m.score / (m.maxScore || 200)) * 70);
          return el('div', { style: {
            flex: 1, height: `${h}px`,
            background: m.score >= (m.maxScore || 200) * 0.5 ? 'var(--primary)' : 'var(--primary-soft)',
            borderRadius: '4px 4px 0 0',
          }, title: `${m.name}: ${m.score}/${m.maxScore || '·'}` });
        })),
    ]) : null,
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-list-bullets' }), 'mocks log']),
      list.length === 0 ? el('p', { class: 'muted', style: { margin: 0 } }, 'no mocks yet.') :
        el('div', { class: 'stack' }, list.map((m) => el('div', { class: 'row row--between' }, [
          el('div', null, [
            el('div', null, m.name),
            el('div', { class: 'muted', style: { fontSize: '0.7rem' } }, `${m.date} · ${m.type || 'Prelims'}${m.accuracyPct != null ? ` · ${m.accuracyPct}%` : ''}${m.negatives ? ` · -${m.negatives} neg` : ''}`),
          ]),
          el('span', { class: 'chip chip--primary' }, `${m.score}/${m.maxScore || 200}`),
        ]))),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-warning-octagon' }), 'silly mistakes log']),
      el('button', { class: 'btn btn--soft', onClick: addSilly }, '+ log a mistake'),
      el('div', { class: 'stack', style: { marginTop: '8px' } }, (s.upsc.sillyMistakes || []).slice(0, 10).map((m) => el('div', { class: 'card', style: { padding: '8px' } }, [
        el('div', null, m.text),
        el('div', { class: 'muted', style: { fontSize: '0.7rem' } }, m.date),
      ]))),
    ]),
  ]);
}

function addMock() {
  const name = prompt('mock name (e.g. "Vision IAS PT-1")');
  if (!name) return;
  const date = prompt('date (YYYY-MM-DD)', todayKey()) || todayKey();
  const score = parseFloat(prompt('score', '0'));
  const maxScore = parseFloat(prompt('max score', '200'));
  const accuracyPct = parseFloat(prompt('accuracy %', '0'));
  const negatives = parseFloat(prompt('negatives count (-)', '0'));
  if (!Number.isFinite(score)) return;
  update((d) => d.upsc.mockTests.unshift({ id: uid('m'), name, date, score, maxScore, accuracyPct, negatives, type: 'Prelims' }));
  toast('mock logged ✓');
}

function addSilly() {
  const text = prompt('what was the silly mistake?');
  if (!text) return;
  update((d) => {
    d.upsc.sillyMistakes = d.upsc.sillyMistakes || [];
    d.upsc.sillyMistakes.unshift({ id: uid('sm'), text, date: todayKey() });
  });
}

// ─── ANSWER WRITING ──────────────────────────────────────────
function answersSection(s) {
  const list = s.upsc.answerWriting || [];
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-pen-nib' }), 'answer writing', el('small', null, `${list.length}`)]),
      el('button', { class: 'btn', onClick: addAnswer }, '+ log an answer'),
      el('p', { class: 'muted', style: { margin: '8px 0 0', fontSize: '0.7rem' } }, 'daily target: 1 question, 250 words, 7 minutes.'),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-list-bullets' }), 'recent']),
      list.length === 0 ? el('p', { class: 'muted', style: { margin: 0 } }, 'nothing yet.') :
        el('div', { class: 'stack' }, list.slice(0, 15).map((a) => el('div', { class: 'card', style: { padding: '10px' } }, [
          el('div', null, [el('strong', null, a.question)]),
          el('div', { class: 'muted', style: { fontSize: '0.75rem' } },
            `${a.date} · ${a.words || '·'}w · ${a.minutes || '·'}m · self ${a.selfScore || '·'}/10${a.mentorFeedback ? ' · mentor ✓' : ''}`),
        ]))),
    ]),
  ]);
}

function addAnswer() {
  const question = prompt('question prompt');
  if (!question) return;
  const words = parseInt(prompt('word count', '250'), 10);
  const minutes = parseInt(prompt('time taken (min)', '7'), 10);
  const selfScore = parseInt(prompt('self-score / 10', '7'), 10);
  update((d) => d.upsc.answerWriting.unshift({
    id: uid('aw'), question, words, minutes, selfScore,
    date: todayKey(), time: new Date().toISOString(),
  }));
  toast('answer logged ✓');
}

// ─── CURRENT AFFAIRS ─────────────────────────────────────────
function caSection(s) {
  const list = s.upsc.currentAffairs || [];
  const byMonth = {};
  list.forEach((c) => {
    const m = (c.date || '').slice(0, 7);
    (byMonth[m] = byMonth[m] || []).push(c);
  });
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-newspaper' }), 'current affairs', el('small', null, `${list.length}`)]),
      el('button', { class: 'btn', onClick: addCA }, '+ add note'),
    ]),
    ...Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).slice(0, 6).map((m) => el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph ph-calendar' }), m, el('small', null, `${byMonth[m].length}`)]),
      el('div', { class: 'stack' }, byMonth[m].slice(0, 8).map((c) => el('div', { class: 'card', style: { padding: '8px' } }, [
        el('div', null, [el('strong', null, c.title)]),
        el('div', { class: 'muted', style: { fontSize: '0.7rem' } }, `${c.date} · ${(c.tags || []).join(', ')}`),
        c.note ? el('p', { style: { margin: '4px 0 0', fontSize: '0.875rem' } }, c.note) : null,
      ]))),
    ])),
  ]);
}

function addCA() {
  const title = prompt('headline / topic');
  if (!title) return;
  const note = prompt('2-line note (optional)') || '';
  const tagsRaw = prompt('tags (comma-separated: GS2, polity)', '') || '';
  const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
  update((d) => d.upsc.currentAffairs.unshift({ id: uid('ca'), title, note, tags, date: todayKey() }));
}

// ─── ESSAYS ──────────────────────────────────────────────────
function essaysSection(s) {
  const bank = s.upsc.essayBank || [];
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-feather' }), 'essay bank', el('small', null, `${bank.length}`)]),
      el('p', { class: 'muted', style: { margin: 0, fontSize: '0.75rem' } }, 'quotes, anecdotes, case studies · tagged by theme.'),
      el('button', { class: 'btn', style: { marginTop: '8px' }, onClick: addEssayItem }, '+ add to bank'),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-list-bullets' }), 'recent']),
      bank.length === 0 ? el('p', { class: 'muted', style: { margin: 0 } }, 'empty · drop quotes & cases here as you read.') :
        el('div', { class: 'stack' }, bank.slice(0, 15).map((b) => el('div', { class: 'card', style: { padding: '8px' } }, [
          el('div', null, [el('span', { class: 'chip', style: { marginRight: '6px' } }, b.kind || 'note'), b.text]),
          (b.tags || []).length ? el('div', { class: 'muted', style: { fontSize: '0.7rem', marginTop: '4px' } }, b.tags.join(' · ')) : null,
        ]))),
    ]),
  ]);
}

function addEssayItem() {
  const text = prompt('quote / anecdote / case study');
  if (!text) return;
  const kind = prompt('kind: quote / anecdote / case / stat', 'quote');
  const tagsRaw = prompt('tags (comma-separated)', '');
  const tags = (tagsRaw || '').split(',').map((t) => t.trim()).filter(Boolean);
  update((d) => d.upsc.essayBank.unshift({ id: uid('eb'), text, kind, tags, date: todayKey() }));
}

// ─── PLANNER ─────────────────────────────────────────────────
function plannerSection(s) {
  const p = s.upsc.plannerConfig || {};
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-target' }), 'target']),
      el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
        el('label', { class: 'field', style: { flex: '1 1 140px', margin: 0 } }, [
          el('span', { class: 'field__label' }, 'stage'),
          el('select', {
            class: 'select',
            onChange: (e) => update((d) => { d.upsc.plannerConfig = { ...d.upsc.plannerConfig, stage: e.target.value }; })
          }, ['Prelims', 'Mains', 'Interview'].map((v) =>
            el('option', { value: v, selected: p.stage === v }, v))),
        ]),
        el('label', { class: 'field', style: { flex: '1 1 100px', margin: 0 } }, [
          el('span', { class: 'field__label' }, 'year'),
          el('input', { class: 'input', type: 'number', min: 2025, max: 2035, value: p.year || 2027,
            onChange: (e) => update((d) => { d.upsc.plannerConfig = { ...d.upsc.plannerConfig, year: parseInt(e.target.value, 10) }; }) }),
        ]),
        el('label', { class: 'field', style: { flex: '1 1 140px', margin: 0 } }, [
          el('span', { class: 'field__label' }, 'exam date'),
          el('input', { class: 'input', type: 'date', value: p.examDate || '',
            onChange: (e) => update((d) => { d.upsc.plannerConfig = { ...d.upsc.plannerConfig, examDate: e.target.value }; }) }),
        ]),
      ]),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-calendar' }), 'weekly subject rotation']),
      el('p', { class: 'muted', style: { margin: 0, fontSize: '0.75rem' } }, 'a soft rotation · set or skip.'),
      el('div', { class: 'stack', style: { marginTop: '8px' } },
        ['Mon GS1', 'Tue GS2', 'Wed GS3', 'Thu GS4 + Essay', 'Fri CSAT', 'Sat mock', 'Sun review'].map((row) =>
          el('div', { class: 'row' }, [
            el('i', { class: 'ph ph-flower', style: { color: 'var(--primary)' } }),
            el('span', { style: { marginLeft: '8px' } }, row),
          ]))
      ),
    ]),
  ]);
}
