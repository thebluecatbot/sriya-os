// Bestie playbook · spiral exits with Mino as the steady voice.
// 17 scenarios, each a dialogue. Some branch, some end in a single action.
// Voice rule: Mino is warm + blunt. Short lines, concrete. Never sends Sriya
// running to Prakhar in an emotional state · only after the spiral has been
// diminished and she's logical again.

import { el, clear, toast } from '../utils/dom.js';
import { update, uid, TODAY } from '../state.js';
import { todayKey } from '../utils/format.js';

// Each scenario can have:
//   lines: [{ who: 'you'|'m', text: '...' }]  · default linear dialogue
//   branches: { key, options: [{ label, lines, ...nested }] }  · tap-to-choose forks
//   ending: { kind: 'action'|'feel-better', text: '...' }
//   icon
// (No automatic "text Prakhar" steps · the principle is independence from his okay.)

const SCENARIOS = [
  {
    id: 'dont-deserve-to-eat',
    n: 1,
    title: "i don't deserve to eat",
    icon: 'ph-bowl-food',
    lines: [
      { who: 'you', text: "i don't deserve to eat." },
      { who: 'm', text: "stop. that's not a fact · that's the bad day talking." },
      { who: 'm', text: "food isn't a reward you earn. it's the floor. it's how you stay here." },
      { who: 'm', text: "go drink a full glass of water first. right now, before anything else." },
      { who: 'm', text: "and listen · sitting here sad isn't noble. it's wasting the mess money you already paid, and hours you won't get back." },
      { who: 'm', text: "go eat. small is fine if a full plate feels like too much. just put something in." },
    ],
    ending: { kind: 'action', text: 'go eat now, then come back and tell me you did it.' },
  },

  {
    id: 'night-binge',
    n: 2,
    title: 'night binge starting',
    icon: 'ph-moon',
    lines: [
      { who: 'you', text: 'night binge is starting.' },
      { who: 'm', text: "okay. look at what you're about to eat · actually look at it." },
      { who: 'm', text: 'first question, answer honest: did you eat dinner?' },
    ],
    branches: {
      key: 'dinner?',
      options: [
        {
          label: "no, skipped dinner",
          lines: [
            { who: 'm', text: "that's the real problem then. this is hunger wearing a binge costume." },
            { who: 'm', text: "start with dates or dry fruits · they kill the sugar pull without the crash." },
            { who: 'm', text: 'give it 10 minutes. then tell me · still hungry?' },
          ],
          branches: {
            key: 'still-hungry?',
            options: [
              {
                label: 'yes, still hungry',
                lines: [{ who: 'm', text: 'then go eat properly. walk to H12 or H18 and get a real meal.' }],
                ending: { kind: 'action', text: 'go, eat a proper meal, text me what you got.' },
              },
              {
                label: "hungry but tired, can't go",
                lines: [{ who: 'm', text: 'okay · biscuits and peanut butter. enough to sleep on, not a feast.' }],
                ending: { kind: 'action', text: 'eat that, brush, lights off.' },
              },
            ],
          },
        },
        {
          label: 'yes, i ate dinner',
          lines: [
            { who: 'm', text: "then this isn't hunger. it's a craving riding on top of something else." },
            { who: 'm', text: 'dates if you really must, then a big glass of water, then brush your teeth so your mouth knows the kitchen is closed.' },
          ],
          ending: { kind: 'action', text: "water, brush, lights off. you're done for tonight." },
        },
      ],
    },
  },

  {
    id: 'called-dramatic',
    n: 3,
    title: 'called "nakhre" / "drama"',
    icon: 'ph-x-circle',
    lines: [
      { who: 'you', text: 'someone called me nakhre / dramatic.' },
      { who: 'm', text: "you're not. okay · maybe you are, sometimes. but it's YOU, and that's allowed." },
      { who: 'm', text: 'who said it?' },
    ],
    branches: {
      key: 'who?',
      options: [
        {
          label: 'prakhar',
          lines: [
            { who: 'm', text: "then don't fold into sad · that's the wrong move here." },
            { who: 'm', text: "get angry at him instead. that's the fairer fight." },
            { who: 'm', text: 'calling your feelings "nakhre" isn\'t a counter-argument. tell him that.' },
          ],
          ending: { kind: 'action', text: 'say it to him plainly, then go for a walk.' },
        },
        {
          label: 'someone else',
          lines: [
            { who: 'm', text: "their opinion doesn't get a vote on you." },
            { who: 'm', text: 'say the names of the people who love you FOR the nakhre · out loud: tutu, moki, prakhar, amma, nanna, tata, ammamma, shikha.' },
          ],
          ending: { kind: 'action', text: 'now get up and walk. moving beats sitting in it.' },
        },
      ],
    },
  },

  {
    id: 'friend-cold',
    n: 4,
    title: 'friend went cold',
    icon: 'ph-snowflake',
    lines: [
      { who: 'you', text: 'my friend went cold on me.' },
      { who: 'm', text: "okay · first, don't write the whole story in your head. you don't have the facts." },
      { who: 'm', text: 'text them. plainly. "hey, are we okay?" that\'s the whole message.' },
      { who: 'm', text: 'while you wait · you are not friendless. say two other names. people who pick up.' },
      { who: 'm', text: 'do something with your hands so the brain stops spinning · mehindi, nails.' },
    ],
    ending: { kind: 'action', text: 'send the text, then put your shoes on and walk ten minutes.' },
  },

  {
    id: 'spiral',
    n: 5,
    title: 'the spiral',
    icon: 'ph-spiral',
    lines: [
      { who: 'you', text: "i'm spiralling." },
      { who: 'm', text: 'okay. we slow it with the body first, head later.' },
      { who: 'm', text: 'go pee. drink water · loads, more than you think you need.' },
      { who: 'm', text: "if you're crying, cry. don't suppress it. but we're not soaking in it · we're moving it through fast." },
      { who: 'm', text: 'now get up and walk. too tired to walk? put on youtube · something easy.' },
      { who: 'm', text: "then squats, a plank. let the body burn what the head can't think away." },
    ],
    ending: { kind: 'feel-better', text: "you don't have to feel fine. you just have to be moving. that's enough." },
  },

  {
    id: 'dissociation',
    n: 6,
    title: 'dissociation',
    icon: 'ph-clock-counter-clockwise',
    lines: [
      { who: 'you', text: 'i lost hours again.' },
      { who: 'm', text: "first thing · do NOT start crying about the time you lost. that's just more lost time." },
      { who: 'm', text: 'pee. drink water. look at the clock · actually look at it.' },
      { who: 'm', text: 'now do the thing you meant to do. imperfectly. badly, even. just start it.' },
      { who: 'm', text: "if you're late, you're late · reschedule it, re-rank what matters, and move." },
      { who: 'm', text: "and notice this: you come back from these faster than you used to. that's real." },
    ],
    ending: { kind: 'action', text: 'do a plank right now. body back online, then the day.' },
  },

  {
    id: 'peer-sting',
    n: 7,
    title: 'peer achievement sting',
    icon: 'ph-trophy',
    lines: [
      { who: 'you', text: 'someone i know just did something big and it stings.' },
      { who: 'm', text: "feel the sting for a second · okay. now: you've done things too. name one out loud." },
      { who: 'm', text: "their win isn't proof you're behind. it's proof the thing is possible." },
      { who: 'm', text: "so use it. don't let it rot into envy · point it at what YOU want." },
    ],
    ending: { kind: 'action', text: 'one little step toward your version. today, not tomorrow. name it, do it.' },
  },

  {
    id: 'prakhar-hurt',
    n: 8,
    title: 'prakhar hurt me',
    icon: 'ph-heart-break',
    lines: [
      { who: 'you', text: 'prakhar hurt me.' },
      { who: 'm', text: "okay. you're allowed to be angry. anger is cleaner than sad here · use it." },
      { who: 'm', text: "don't go quiet and punish. communicate. ask him straight: \"aisa kyu kiya bc.\"" },
      { who: 'm', text: "and say the real line: \"i'm not gonna put up with your bullshit just because i love you.\"" },
      { who: 'm', text: "loving him doesn't mean swallowing it." },
    ],
    ending: { kind: 'action', text: 'go talk to HIM. not Mino · him. the actual conversation.' },
  },

  {
    id: 'validation',
    n: 9,
    title: 'needing validation',
    icon: 'ph-sparkle',
    lines: [
      { who: 'you', text: 'i need validation.' },
      { who: 'm', text: "okay. you're reaching for someone to tell you you're okay. let's do it properly, not by refreshing a chat." },
      { who: 'm', text: 'honest question · can you give yourself the validation right now, or do you need it handed to you?' },
    ],
    branches: {
      key: 'how?',
      options: [
        {
          label: 'i can try myself',
          lines: [
            { who: 'm', text: 'good. then do it: name three real things you did this week. not "i exist" · actual things. say them out loud.' },
            { who: 'm', text: "now the honest half · you ARE a little egoistic. that's fine, but don't let this puff it up. you're good. not better-than. just good." },
          ],
          ending: { kind: 'feel-better', text: "you don't need to be the best. \"enough\" is the goal, and you're enough." },
        },
        {
          label: 'hand it to me',
          lines: [
            { who: 'm', text: "fine. here it is, and i'm only saying what's true:" },
            { who: 'm', text: "you're capable. you've survived things that would flatten most people. you show up for the people you love. that's real." },
            { who: 'm', text: "but i'm not going to inflate you · you don't need more ego, you need to believe the base. you're enough. you're not above anyone. enough is the goal." },
          ],
          ending: { kind: 'action', text: 'now look around your room · you built that life. and if you want a warm voice, call amma. one call.' },
        },
        {
          label: 'i just want amma',
          lines: [
            { who: 'm', text: "then call her. that's allowed · it's not weakness, it's using a real thing." },
          ],
          ending: { kind: 'action', text: 'one call to amma. her voice is the medicine here.' },
        },
      ],
    },
  },

  {
    id: 'unexplained-crying',
    n: 10,
    title: 'unexplained crying',
    icon: 'ph-drop',
    lines: [
      { who: 'you', text: "i'm crying and i don't know why." },
      { who: 'm', text: "you don't need a reason. let it out · it can just be a release." },
      { who: 'm', text: 'drink water · crying dehydrates you. eat one square of chocolate.' },
      { who: 'm', text: 'put on something good and soft · cartoons. let your brain rest on something kind.' },
    ],
    ending: { kind: 'action', text: "then step outside. air on your face, five minutes. that's the whole task." },
  },

  {
    id: 'abandoned-project',
    n: 11,
    title: 'abandoned another project',
    icon: 'ph-arrow-u-up-left',
    lines: [
      { who: 'you', text: 'i abandoned another project.' },
      { who: 'm', text: 'okay · not a character flaw. a pattern. and patterns are workable.' },
      { who: 'm', text: "don't sit in the guilt. pick up another thing right now and just touch it." },
      { who: 'm', text: "the abandoned one isn't dead. tomorrow you can come back to it. it'll wait." },
    ],
    ending: { kind: 'feel-better', text: 'moving on something beats mourning everything. go start the next thing.' },
  },

  {
    id: 'amma-hurt',
    n: 12,
    title: 'amma said something that hurts',
    icon: 'ph-house-line',
    lines: [
      { who: 'you', text: 'amma said something and it hurt.' },
      { who: 'm', text: 'okay · first, get it out of your own head. tell Prakhar what she said.' },
      { who: 'm', text: 'then go to amma. confront it · calm, not cruel. tell her how it landed.' },
      { who: 'm', text: 'and be honest with yourself: if she was right, the sting is just the truth arriving. say sorry for that part.' },
    ],
    ending: { kind: 'action', text: 'you can be hurt by her AND owe her a sorry. both. go say both.' },
  },

  {
    id: 'call-ended',
    n: 13,
    title: 'call/visit ended · sadness',
    icon: 'ph-phone-disconnect',
    lines: [
      { who: 'you', text: 'the call ended and the room feels empty.' },
      { who: 'm', text: "yeah. that drop is real. we move it, we don't sit in it." },
      { who: 'm', text: 'exercise · HIIT. hard enough that your body has somewhere to put the feeling.' },
      { who: 'm', text: 'then planks. burn it down the physical way.' },
    ],
    ending: { kind: 'feel-better', text: "the sadness can't keep up with you if you keep moving. go." },
  },

  {
    id: 'guilt-nice',
    n: 14,
    title: 'guilt when doing something nice for myself',
    icon: 'ph-gift',
    lines: [
      { who: 'you', text: 'i feel guilty doing something nice for myself.' },
      { who: 'm', text: "no. we're not running that loop today." },
      { who: 'm', text: "you have been through actual shit. the nice thing isn't indulgence · it's overdue." },
      { who: 'm', text: 'do it fully. no flinching, no apologising to yourself halfway through.' },
    ],
    ending: { kind: 'feel-better', text: "enjoy it like you'd want someone you love to enjoy it. that's the instruction." },
  },

  {
    id: 'burden',
    n: 15,
    title: 'feeling like a burden',
    icon: 'ph-weight',
    lines: [
      { who: 'you', text: 'i feel like a burden.' },
      { who: 'm', text: "truth first: you DO take up space, time, energy. so does every single person. the question isn't whether · it's HOW, and whether you're being honest right now." },
      { who: 'm', text: "and before anything · we are NOT running to Prakhar with this. you want to need his \"okay\" less, not more. this stays with you and me first." },
      { who: 'm', text: "my job here is to tell you straight: is this actually serious, or is it bullshit? answer me honestly, no softening." },
      { who: 'm', text: 'have you eaten and slept in the last day or so?' },
    ],
    branches: {
      key: 'fed+slept?',
      options: [
        { label: 'yes', branches: nextBurdenLevel('fed') },
        { label: 'no',  branches: nextBurdenLevel('not-fed') },
      ],
    },
  },

  {
    id: 'compliment',
    n: 16,
    title: 'received a compliment',
    icon: 'ph-flower',
    lines: [
      { who: 'you', text: 'someone complimented me.' },
      { who: 'm', text: "okay · don't deflect it. no \"oh it's nothing.\"" },
      { who: 'm', text: 'let it land. say thank you, and actually keep it.' },
    ],
    ending: { kind: 'feel-better', text: "say it with me · hehe, i'm gud. good. now carry that all day." },
  },

  {
    id: 'childish',
    n: 17,
    title: "i'm just childish, i can't adult",
    icon: 'ph-baby',
    lines: [
      { who: 'you', text: "i'm just childish, i can't adult." },
      { who: 'm', text: "you're 22, surrounded by 25-year-olds. of course the gap feels big · it's a gap in years, not in worth." },
      { who: 'm', text: 'and look at what you\'ve already done: you came out two years ago. that took more adult than most people ever manage.' },
      { who: 'm', text: "one watch-out though · don't repeat the old thing just because it's familiar. you know which one i mean." },
    ],
    ending: { kind: 'action', text: "pick ONE small adult thing and do it today. just one. that's how it's built · not all at once." },
  },
];

// Helper to compose the burden #15 branching ladder
function nextBurdenLevel(track) {
  // Ask: real outside thing OR just the feeling
  return {
    key: 'real or feeling?',
    options: [
      { label: 'a real thing', branches: burdenTried(track, 'real') },
      { label: 'just the feeling', branches: burdenTried(track, 'feeling') },
    ],
  };
}
function burdenTried(track, kind) {
  return {
    key: 'tried alone?',
    options: [
      { label: "tried, it didn't work", branches: burdenRunning(track, kind, 'tried') },
      { label: "haven't really tried", branches: burdenRunning(track, kind, 'untried') },
    ],
  };
}
function burdenRunning(track, kind, effort) {
  return {
    key: 'about to run to someone?',
    options: [
      { label: 'yes',
        lines: [],
        ending: burdenVerdict(track, kind, effort, 'running') },
      { label: 'no',
        lines: [],
        ending: burdenVerdict(track, kind, effort, 'sitting') },
    ],
  };
}
function burdenVerdict(track, kind, effort, run) {
  // Bullshit verdict: fed+slept, "just the feeling", untried, running
  const bullshit = track === 'fed' && kind === 'feeling' && effort === 'untried' && run === 'running';
  const serious  = track === 'not-fed' || kind === 'real' || effort === 'tried';
  if (bullshit) {
    return { kind: 'action',
      text: 'verdict: bullshit. NOT serious. this goes to NO ONE. get up, one task, move your body ten minutes. spiral diminished. you handled it yourself · that is the whole point.' };
  }
  if (serious) {
    return { kind: 'action',
      text: 'verdict: serious. and serious does NOT mean run to Prakhar right now. one: diminish the spiral · water, move, breathe. two: SIT with it 20 min. only logical-you, calm, then talks to him · as a clear conversation, not an emotional dump.' };
  }
  return { kind: 'action',
    text: 'mixed · here\'s the test: do the spiral reset · water, ten minutes of movement · then sit 20 min. fades = bullshit version, handled. still heavy = serious, earned a calm conversation. not before, not emotional.' };
}

// ──────────────────────────────────────────────────────────────
// Renderer
// ──────────────────────────────────────────────────────────────

export function renderPlaybook(_params, host) {
  clear(host);
  host.appendChild(build());
}

function build() {
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('h1', null, ['playbook ', el('i', { class: 'ph-duotone ph-magic-wand', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]));

  wrap.appendChild(el('div', { class: 'card card--hero' }, [
    el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.5rem' } }, 'we move slow. one step ✿'),
    el('p', { class: 'muted', style: { margin: '6px 0 0' } },
      'mino is the steady voice here. tap a scenario, walk through the dialogue. independence from prakhar\'s "okay" is the rule.'),
  ]));

  SCENARIOS.forEach((sc) => wrap.appendChild(scenarioCard(sc)));

  wrap.appendChild(el('div', { class: 'card', style: { background: 'var(--surface-2)' } }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-info' }), 'design principle']),
    el('ol', { style: { paddingLeft: '20px', margin: 0, fontSize: '0.85rem' } }, [
      el('li', null, "mino says plainly whether it's serious or bullshit · no hedging."),
      el('li', null, 'bullshit · you handle it yourself, it goes to no one.'),
      el('li', null, 'serious · diminish the spiral first, then sit with it at least 20 minutes to get from emotional to logical.'),
      el('li', null, 'only logical-sriya, calm, may then take it to prakhar · as a clear conversation, never an emotional dump.'),
      el('li', null, 'the goal is to need his reassurance less, not more. self-handling is the win condition.'),
    ]),
  ]));

  // Log this visit
  update((d) => {
    d.mino.playbookVisits = d.mino.playbookVisits || [];
    d.mino.playbookVisits.unshift({ at: new Date().toISOString(), date: todayKey() });
    if (d.mino.playbookVisits.length > 200) d.mino.playbookVisits.length = 200;
  }, { silent: true });

  return wrap;
}

function scenarioCard(sc) {
  const body = el('div', { class: 'stack', style: { display: 'none', marginTop: '12px' } });
  let opened = false;

  const head = el('button', {
    class: 'row', type: 'button',
    style: { width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '10px', padding: 0 },
    onClick: () => {
      opened = !opened;
      body.style.display = opened ? '' : 'none';
      if (opened) renderDialogue(body, sc);
      else body.innerHTML = '';
    }
  }, [
    el('i', { class: `ph-duotone ${sc.icon}`, style: { color: 'var(--primary)', fontSize: '1.5rem' } }),
    el('div', { style: { flex: 1 } }, [
      el('div', { style: { fontWeight: 600 } }, [
        el('span', { class: 'muted', style: { fontSize: '0.7rem', marginRight: '6px' } }, `#${String(sc.n).padStart(2, '0')}`),
        sc.title,
      ]),
    ]),
    el('i', { class: 'ph ph-caret-right', style: { color: 'var(--ink-mute)' } }),
  ]);

  return el('div', { class: 'card' }, [head, body]);
}

function renderDialogue(host, scenarioOrBranch) {
  host.innerHTML = '';
  walkNode(host, scenarioOrBranch);
}

function walkNode(host, node) {
  // 1) Render any "lines" the node carries
  for (const line of (node.lines || [])) host.appendChild(lineRow(line));
  // 2) If the node has an inline branches block, render its options
  if (node.branches) host.appendChild(branchBlock(node.branches, host));
  // 3) If the node has an ending, render it
  if (node.ending) host.appendChild(endingRow(node.ending));
}

function lineRow(line) {
  const isYou = line.who === 'you';
  return el('div', {
    style: {
      display: 'flex',
      justifyContent: isYou ? 'flex-end' : 'flex-start',
      margin: '4px 0',
    }
  }, [
    el('div', {
      style: {
        maxWidth: '85%',
        padding: '8px 12px',
        borderRadius: '14px',
        background: isYou ? 'var(--surface-2)' : 'var(--primary-soft)',
        color: isYou ? 'var(--ink)' : 'var(--primary-deep)',
        fontSize: '0.875rem',
        lineHeight: '1.4',
        whiteSpace: 'pre-wrap',
      }
    }, [
      el('div', { style: { fontSize: '0.65rem', fontWeight: 600, opacity: 0.75, marginBottom: '2px' } },
        isYou ? 'you' : 'mino ✿'),
      el('div', null, line.text),
    ])
  ]);
}

function branchBlock(branches, hostForNextStep) {
  const wrap = el('div', { class: 'stack', style: { marginTop: '6px' } });
  wrap.appendChild(el('div', { class: 'muted', style: { fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }, branches.key || 'pick one'));
  const buttons = el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } });
  for (const opt of (branches.options || [])) {
    buttons.appendChild(el('button', {
      class: 'chip', type: 'button', style: { cursor: 'pointer' },
      onClick: () => {
        // Disable other buttons; reveal the chosen path inline beneath the card.
        [...buttons.querySelectorAll('button')].forEach((b) => b.disabled = true);
        // mark which option was picked
        wrap.appendChild(el('div', { class: 'chip chip--primary', style: { marginTop: '6px', alignSelf: 'flex-start' } }, opt.label));
        walkNode(hostForNextStep, opt);
      }
    }, opt.label));
  }
  wrap.appendChild(buttons);
  return wrap;
}

function endingRow(ending) {
  const isAction = ending.kind === 'action';
  return el('div', {
    class: 'card', style: {
      marginTop: '10px',
      background: isAction ? 'var(--gradient-hero)' : 'var(--primary-soft)',
      borderColor: 'var(--primary)',
    }
  }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: isAction ? 'ph-fill ph-arrow-right' : 'ph-fill ph-heart', style: { color: 'var(--primary)' } }),
      isAction ? 'action' : 'feel better',
    ]),
    el('p', { style: { margin: 0 } }, ending.text),
  ]);
}
