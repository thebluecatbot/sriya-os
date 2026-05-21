// Bestie playbook · concrete spiral exits.
// Scenario cards, each with 1-2-3 actions. Mino routes here from her panel's panic.

import { el, clear, toast } from '../utils/dom.js';
import { update, uid, TODAY } from '../state.js';
import { todayKey } from '../utils/format.js';

const SCENARIOS = [
  {
    id: 'overwhelm',
    title: 'overwhelmed',
    blurb: 'too much in the head. brain skipping. body tight.',
    icon: 'ph-cloud-lightning',
    steps: [
      { label: 'park 3 thoughts (dump anything looping)', href: '#/thought' },
      { label: 'one tiny task only', href: '#/tasks' },
      { label: 'water + 4-7-8 breathing × 3', action: () => toast('4 in · hold 7 · out 8 ✿') },
    ],
  },
  {
    id: 'spiral',
    title: 'spiraling',
    blurb: 'thoughts loop. worst case keeps replaying.',
    icon: 'ph-spiral',
    steps: [
      { label: 'name 5 things you can see', action: () => toast('look around · name 5 ✿') },
      { label: 'park the loop to thought-park', href: '#/thought' },
      { label: 'text Prakhar or Amma', href: '#/people' },
    ],
  },
  {
    id: 'cantsleep',
    title: "can't sleep",
    blurb: '3 am brain. tomorrow looks scarier.',
    icon: 'ph-moon-stars',
    steps: [
      { label: 'put the phone in the other room (yes, now)', action: () => toast('phone away · room dark ✿') },
      { label: 'park whatever is whirring', href: '#/thought' },
      { label: 'gentle body scan · toes up, slowly', action: () => toast('toes · ankles · calves · slow ✿') },
    ],
  },
  {
    id: 'lonely',
    title: 'lonely',
    blurb: 'a particular quiet kind of ache.',
    icon: 'ph-heart-break',
    steps: [
      { label: 'send any sticker to Amma (no agenda)', href: '#/people' },
      { label: 'voice note to Prakhar · even nothing-words', href: '#/people' },
      { label: 'a book or a comfort show · chosen, not numbing', href: '#/reading' },
    ],
  },
  {
    id: 'freeze',
    title: 'frozen / can\'t start',
    blurb: 'task too big. body stuck. tabs everywhere.',
    icon: 'ph-snowflake',
    steps: [
      { label: 'set a 5-minute timer for any one task', action: async () => {
          const m = await import('./timer.js');
          m.startTimer({ label: 'just 5 min', categoryId: 'other', person: 'sriya', note: 'freeze-break' });
          toast('5 min only · the rest is bonus ✿');
        } },
      { label: 'shrink the task · what\'s the 2-line version?', href: '#/tasks' },
      { label: 'one stretch + one glass of water', action: () => toast('stretch · water · then 5 min ✿') },
    ],
  },
  {
    id: 'urge',
    title: 'scroll urge',
    blurb: 'the pull to open Instagram is loud.',
    icon: 'ph-shield-check',
    steps: [
      { label: 'urge button → log the trigger', action: async () => {
          const m = await import('./doomscroll.js');
          m.openUrgeSheet();
        } },
      { label: 'dump it to thought-park (the saves swap)', href: '#/thought' },
      { label: 'open Today instead · what was the real thing?', href: '#/today' },
    ],
  },
];

export function renderPlaybook(_params, host) {
  clear(host);
  host.appendChild(build());
}

function build() {
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('h1', null, ['playbook ', el('i', { class: 'ph-duotone ph-magic-wand', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]));

  wrap.appendChild(el('div', { class: 'card card--hero' }, [
    el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.5rem' } },
      'we move slow. one step ✿'),
    el('p', { class: 'muted', style: { margin: '6px 0 0' } },
      'pick the scenario closest. don\'t aim for "fixed" · aim for "next breath."'),
  ]));

  SCENARIOS.forEach((sc) => wrap.appendChild(scenarioCard(sc)));

  // Log this visit (so we can spot patterns later)
  update((d) => {
    d.mino.playbookVisits = d.mino.playbookVisits || [];
    d.mino.playbookVisits.unshift({ at: new Date().toISOString(), date: todayKey() });
    if (d.mino.playbookVisits.length > 200) d.mino.playbookVisits.length = 200;
  }, { silent: true });

  return wrap;
}

function scenarioCard(sc) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: `ph-duotone ${sc.icon}` }), sc.title]),
    el('p', { class: 'muted', style: { margin: '0 0 10px' } }, sc.blurb),
    el('ol', { style: { paddingLeft: '20px', margin: 0 } }, sc.steps.map((step, i) => el('li', { style: { padding: '4px 0' } }, [
      step.href
        ? el('a', { href: step.href, class: 'btn btn--soft', style: { textAlign: 'left' } }, step.label)
        : el('button', { class: 'btn btn--soft', style: { textAlign: 'left' }, onClick: step.action }, step.label),
    ]))),
  ]);
}
