// Substack / Content · idea inbox · pipeline · draft editor · research locker ·
// video-blog fields · content calendar · swipe file · repurpose tracker.

import { el, clear, openSheet, closeSheet, toast } from '../utils/dom.js';
import { getState, update, subscribe, uid } from '../state.js';
import { todayKey, relative, fmtDate } from '../utils/format.js';

const STAGES = ['Idea', 'Researching', 'Outlining', 'Drafting', 'Editing', 'Ready', 'Published'];

let mode = 'pipeline'; // pipeline | ideas | calendar | swipe | drafts
let activePieceId = null;
let activePieceTab = 'body'; // body | outline | research | video | publish | versions

export function renderSubstack(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(build()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function build() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('div', { class: 'row row--between', style: { alignItems: 'baseline' } }, [
    el('h1', null, ['substack ', el('i', { class: 'ph-duotone ph-pen-nib', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]),
    el('button', { class: 'btn', onClick: () => createPiece('post') }, [el('i', { class: 'ph-fill ph-plus' }), ' new']),
  ]));

  // Mode pills
  wrap.appendChild(el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
    pill('pipeline', 'pipeline', 'ph-kanban'),
    pill('ideas',    'idea inbox', 'ph-lightbulb'),
    pill('drafts',   'drafts', 'ph-files'),
    pill('calendar', 'calendar', 'ph-calendar'),
    pill('swipe',    'swipe file', 'ph-bookmarks'),
  ]));

  if (activePieceId) {
    wrap.appendChild(pieceEditor(s, activePieceId));
    return wrap;
  }

  switch (mode) {
    case 'pipeline': wrap.appendChild(pipelineView(s)); break;
    case 'ideas':    wrap.appendChild(ideasView(s));    break;
    case 'drafts':   wrap.appendChild(draftsView(s));   break;
    case 'calendar': wrap.appendChild(calendarView(s)); break;
    case 'swipe':    wrap.appendChild(swipeView(s));    break;
  }

  return wrap;
}

function pill(id, label, icon) {
  return el('button', {
    class: mode === id ? 'chip chip--primary' : 'chip',
    type: 'button', style: { cursor: 'pointer' },
    onClick: () => { mode = id; activePieceId = null; rePaint(); }
  }, [el('i', { class: `ph ${icon}` }), ' ', label]);
}

function rePaint() { update((d) => { d.substack._uiTick = (d.substack._uiTick || 0) + 1; }); }

// ─── Pipeline view ───
function pipelineView(s) {
  const pieces = s.substack.pieces || [];
  const byStage = {};
  STAGES.forEach((st) => byStage[st] = pieces.filter((p) => p.stage === st));

  const wrap = el('div', { class: 'stack' });
  STAGES.forEach((stage) => {
    const list = byStage[stage] || [];
    wrap.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [
        el('i', { class: 'ph-duotone ph-flag' }), stage,
        el('small', null, `${list.length}`)
      ]),
      list.length === 0
        ? el('p', { class: 'muted', style: { margin: 0, fontSize: '0.75rem' } }, '·')
        : el('div', { class: 'stack' }, list.map((p) => pieceRow(p)))
    ]));
  });
  return wrap;
}

function pieceRow(p) {
  return el('div', { class: 'row row--between', style: { padding: '6px 0', borderTop: '1px dashed var(--line)' } }, [
    el('button', {
      style: { background: 'none', border: 'none', textAlign: 'left', flex: 1, cursor: 'pointer' },
      onClick: () => { activePieceId = p.id; rePaint(); }
    }, [
      el('div', { style: { fontWeight: 500 } }, [
        p.type === 'video' ? el('span', { class: 'chip', style: { fontSize: '0.65rem', marginRight: '6px' } }, [el('i', { class: 'ph ph-video' }), ' v']) : null,
        p.title || 'untitled',
      ]),
      el('div', { class: 'muted', style: { fontSize: '0.7rem' } },
        `${(p.body || '').split(/\s+/).filter(Boolean).length} words · ${(p.research || []).length} research · ${(p.versions || []).length} versions`),
    ]),
    el('select', {
      class: 'select', style: { width: '120px', padding: '4px 8px', fontSize: '0.7rem' },
      onChange: (e) => moveStage(p.id, e.target.value),
    }, STAGES.map((s) => el('option', { value: s, selected: p.stage === s }, s))),
  ]);
}

function moveStage(id, stage) {
  update((d) => {
    const p = d.substack.pieces.find((x) => x.id === id);
    if (!p) return;
    p.stage = stage;
    if (stage === 'Published') p.publishedAt = new Date().toISOString();
  });
  toast(`→ ${stage}`);
}

// ─── Ideas view ───
function ideasView(s) {
  const ideas = s.substack.ideas || [];
  const inp = el('input', { class: 'input', placeholder: 'one-line idea · voice or type', 'aria-label': 'Idea' });
  const voiceBtn = el('button', { class: 'btn btn--soft', onClick: () => startVoice(inp) }, [el('i', { class: 'ph-fill ph-microphone' }), ' voice']);
  function doAdd() {
    const v = inp.value.trim();
    if (!v) return;
    update((d) => d.substack.ideas.unshift({ id: uid('i'), text: v, createdAt: new Date().toISOString(), tags: [] }));
    inp.value = '';
  }
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });

  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-lightbulb' }), 'idea inbox']),
      el('div', { class: 'row', style: { gap: '6px' } }, [inp, voiceBtn, el('button', { class: 'btn', onClick: doAdd }, '+')]),
    ]),
    ideas.length === 0
      ? el('div', { class: 'card empty' }, [el('div', { class: 'empty__art' }, [el('i', { class: 'ph-duotone ph-lightbulb' })]), el('p', null, 'no ideas yet · drop anything ✿')])
      : el('div', { class: 'stack' }, ideas.slice(0, 50).map((i) => el('div', { class: 'card', style: { padding: '10px' } }, [
          el('div', { style: { whiteSpace: 'pre-wrap' } }, i.text),
          el('div', { class: 'muted', style: { fontSize: '0.7rem', marginTop: '4px' } }, relative(Date.parse(i.createdAt))),
          el('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, [
            el('button', { class: 'btn btn--soft', onClick: () => promoteIdea(i) }, [el('i', { class: 'ph ph-arrow-up' }), ' → draft']),
            el('button', { class: 'btn btn--ghost', onClick: () => {
              if (!confirm('delete idea?')) return;
              update((d) => { d.substack.ideas = d.substack.ideas.filter((x) => x.id !== i.id); });
            } }, [el('i', { class: 'ph ph-trash' })]),
          ]),
        ]))),
  ]);
}

function promoteIdea(i) {
  const id = uid('pc');
  update((d) => {
    d.substack.pieces.unshift({
      id, type: 'post', title: i.text.split('\n')[0].slice(0, 80), stage: 'Researching',
      body: '', versions: [], research: [], outline: '', videoFields: {},
      publishChecklist: {}, performance: {}, createdAt: new Date().toISOString(),
    });
    d.substack.ideas = d.substack.ideas.filter((x) => x.id !== i.id);
  });
  activePieceId = id;
  rePaint();
}

// ─── Drafts (list of all non-published pieces) ───
function draftsView(s) {
  const drafts = (s.substack.pieces || []).filter((p) => p.stage !== 'Published');
  if (drafts.length === 0) {
    return el('div', { class: 'card empty' }, [
      el('div', { class: 'empty__art' }, [el('i', { class: 'ph-duotone ph-files' })]),
      el('p', null, 'no drafts yet · start one ✿'),
      el('button', { class: 'btn', onClick: () => createPiece('post') }, '+ new draft'),
    ]);
  }
  return el('div', { class: 'stack' }, drafts.map((p) => pieceRow(p)));
}

function createPiece(type) {
  const id = uid('pc');
  update((d) => d.substack.pieces.unshift({
    id, type, title: 'untitled', stage: 'Drafting',
    body: '', versions: [], research: [], outline: '', videoFields: {},
    publishChecklist: {}, performance: {}, createdAt: new Date().toISOString(),
  }));
  activePieceId = id;
  rePaint();
}

// ─── Calendar view (publish dates) ───
function calendarView(s) {
  const scheduled = (s.substack.pieces || []).filter((p) => p.scheduledPublishDate);
  const published = (s.substack.pieces || []).filter((p) => p.stage === 'Published');
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-calendar' }), 'upcoming']),
      scheduled.length === 0 ? el('p', { class: 'muted', style: { margin: 0 } }, 'nothing scheduled.') :
        el('div', { class: 'stack' }, scheduled.sort((a, b) => a.scheduledPublishDate.localeCompare(b.scheduledPublishDate)).map((p) =>
          el('div', { class: 'row row--between' }, [
            el('span', null, p.title),
            el('span', { class: 'chip chip--primary' }, p.scheduledPublishDate),
          ]))),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-check-circle' }), 'published', el('small', null, `${published.length}`)]),
      el('p', { class: 'muted', style: { fontSize: '0.7rem', margin: 0 } }, 'shipped this period · a soft count, not a target.'),
      el('div', { class: 'stack', style: { marginTop: '8px' } }, published.slice(0, 20).map((p) => el('div', { class: 'row row--between' }, [
        el('span', null, p.title),
        el('span', { class: 'muted', style: { fontSize: '0.7rem' } }, (p.publishedAt || '').slice(0, 10)),
      ]))),
    ]),
  ]);
}

// ─── Swipe file ───
function swipeView(s) {
  const swipes = s.substack.swipeFile || [];
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-bookmarks' }), 'swipe file']),
      el('p', { class: 'muted', style: { margin: 0, fontSize: '0.75rem' } }, 'saved headlines, hooks, structures.'),
      el('button', { class: 'btn btn--ghost', style: { marginTop: '8px' }, onClick: () => addSwipe() }, '+ add'),
    ]),
    swipes.length === 0 ? el('p', { class: 'muted', style: { textAlign: 'center' } }, 'empty · paste a great headline or hook.') :
      el('div', { class: 'stack' }, swipes.map((sw) => el('div', { class: 'card', style: { padding: '10px' } }, [
        el('div', { style: { whiteSpace: 'pre-wrap', fontStyle: 'italic' } }, `"${sw.text}"`),
        el('div', { class: 'muted', style: { fontSize: '0.7rem', marginTop: '4px' } }, sw.source || ''),
      ]))),
  ]);
}

function addSwipe() {
  const text = prompt('paste the headline / hook / structure');
  if (!text) return;
  const source = prompt('source (optional)', '') || '';
  update((d) => { d.substack.swipeFile = d.substack.swipeFile || []; d.substack.swipeFile.unshift({ id: uid('sw'), text, source, date: todayKey() }); });
}

// ─── Piece editor ───
let autosaveTimer = null;

function pieceEditor(s, id) {
  const p = (s.substack.pieces || []).find((x) => x.id === id);
  if (!p) { activePieceId = null; rePaint(); return el('div'); }

  const wrap = el('div', { class: 'stack' });

  // Toolbar
  wrap.appendChild(el('div', { class: 'card', style: { background: 'var(--surface-2)' } }, [
    el('div', { class: 'row row--between', style: { alignItems: 'baseline' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => { activePieceId = null; rePaint(); } }, [el('i', { class: 'ph ph-arrow-left' }), ' back']),
      el('select', {
        class: 'select', style: { width: '120px', padding: '4px 8px', fontSize: '0.75rem' },
        onChange: (e) => moveStage(p.id, e.target.value),
      }, STAGES.map((st) => el('option', { value: st, selected: p.stage === st }, st))),
    ]),
    el('input', {
      class: 'input', value: p.title, style: { fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontStyle: 'italic', marginTop: '8px' },
      onInput: (e) => update((d) => {
        const x = d.substack.pieces.find((y) => y.id === p.id);
        if (x) x.title = e.target.value;
      }),
    }),
  ]));

  // Sub-tabs
  const tabs = p.type === 'video'
    ? ['body','outline','research','video','publish','versions']
    : ['body','outline','research','publish','versions'];

  wrap.appendChild(el('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } },
    tabs.map((t) => el('button', {
      class: activePieceTab === t ? 'chip chip--primary' : 'chip',
      type: 'button', style: { cursor: 'pointer' },
      onClick: () => { activePieceTab = t; rePaint(); }
    }, t))
  ));

  if (activePieceTab === 'body')     wrap.appendChild(bodyTab(p));
  if (activePieceTab === 'outline')  wrap.appendChild(outlineTab(p));
  if (activePieceTab === 'research') wrap.appendChild(researchTab(p));
  if (activePieceTab === 'video')    wrap.appendChild(videoTab(p));
  if (activePieceTab === 'publish')  wrap.appendChild(publishTab(p));
  if (activePieceTab === 'versions') wrap.appendChild(versionsTab(p));

  return wrap;
}

// Body · main editor with autosave + word count + reading time + copy markdown
function bodyTab(p) {
  const ta = el('textarea', {
    class: 'input', rows: 18, value: p.body || '', spellcheck: 'true', 'aria-label': 'Draft body',
    style: { fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: '1.6' },
  });

  const wordsEl = el('span', { class: 'muted', style: { fontSize: '0.75rem' } }, '0 words · 0 min read');

  function updateWords() {
    const w = (ta.value || '').trim().split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.ceil(w / 250));
    wordsEl.textContent = `${w} words · ${mins} min read`;
  }
  updateWords();

  ta.addEventListener('input', () => {
    updateWords();
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      update((d) => {
        const x = d.substack.pieces.find((y) => y.id === p.id);
        if (x) x.body = ta.value;
      });
    }, 600);
  });

  function snapshot() {
    update((d) => {
      const x = d.substack.pieces.find((y) => y.id === p.id);
      if (!x) return;
      x.body = ta.value;
      x.versions = x.versions || [];
      x.versions.unshift({ id: uid('v'), body: x.body, at: new Date().toISOString(), label: `v${x.versions.length + 1}` });
      if (x.versions.length > 50) x.versions = x.versions.slice(0, 50);
    });
    toast(`snapshot saved ✓`);
  }

  function copyMarkdown() {
    const md = `# ${p.title}\n\n${ta.value || ''}`;
    navigator.clipboard?.writeText(md).then(() => toast('markdown copied ✓'));
  }

  function focusWrite() {
    document.body.dataset.focus = 'on';
    ta.style.minHeight = '70vh';
    toast('distraction-free · tap any nav to exit');
  }

  return el('div', { class: 'card' }, [
    el('div', { class: 'row row--between', style: { marginBottom: '8px' } }, [
      wordsEl,
      el('div', { class: 'row', style: { gap: '6px' } }, [
        el('button', { class: 'btn btn--soft', onClick: focusWrite, 'aria-label': 'Focus' }, [el('i', { class: 'ph ph-eye' })]),
        el('button', { class: 'btn btn--soft', onClick: snapshot }, [el('i', { class: 'ph ph-camera' }), ' snapshot']),
        el('button', { class: 'btn', onClick: copyMarkdown }, [el('i', { class: 'ph ph-copy' }), ' copy MD']),
      ]),
    ]),
    ta,
    el('p', { class: 'muted', style: { fontSize: '0.7rem', marginTop: '4px' } }, 'autosaves while you type · "snapshot" stores a version you can revert to.'),
  ]);
}

function outlineTab(p) {
  const ta = el('textarea', { class: 'input', rows: 10, value: p.outline || '',
    placeholder: '- hook\n- 3 main beats\n- close\n- CTA' });
  ta.addEventListener('input', () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => update((d) => {
      const x = d.substack.pieces.find((y) => y.id === p.id);
      if (x) x.outline = ta.value;
    }), 400);
  });
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-list-numbers' }), 'outline']),
    ta,
    el('button', { class: 'btn btn--block', style: { marginTop: '8px' }, onClick: () => {
      update((d) => {
        const x = d.substack.pieces.find((y) => y.id === p.id);
        if (!x) return;
        x.body = (x.body ? x.body + '\n\n' : '') + (x.outline || '');
      });
      toast('expanded into body ✓');
      activePieceTab = 'body'; rePaint();
    } }, [el('i', { class: 'ph ph-arrow-right' }), ' expand into body']),
  ]);
}

function researchTab(p) {
  const items = p.research || [];
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-folder-open' }), 'research locker', el('small', null, `${items.length}`)]),
    el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => addResearch(p.id, 'link') },   '+ link'),
      el('button', { class: 'btn btn--soft', onClick: () => addResearch(p.id, 'quote') },  '+ quote'),
      el('button', { class: 'btn btn--soft', onClick: () => addResearch(p.id, 'stat') },   '+ stat'),
      el('button', { class: 'btn btn--soft', onClick: () => addResearch(p.id, 'screen') }, '+ screenshot'),
      el('button', { class: 'btn btn--soft', onClick: () => addResearch(p.id, 'voice') },  '+ voice note'),
    ]),
    items.length === 0 ? el('p', { class: 'muted', style: { margin: '8px 0 0' } }, 'empty · drop quotes from Reading, links from anywhere.') :
      el('div', { class: 'stack', style: { marginTop: '8px' } }, items.map((r, i) => el('div', { class: 'card', style: { padding: '8px' } }, [
        el('div', null, [el('span', { class: 'chip', style: { fontSize: '0.65rem', marginRight: '6px' } }, r.kind), r.text || r.url]),
        r.source ? el('div', { class: 'muted', style: { fontSize: '0.7rem' } }, r.source) : null,
        el('button', { class: 'btn btn--soft', style: { marginTop: '4px' }, onClick: () => {
          update((d) => {
            const x = d.substack.pieces.find((y) => y.id === p.id);
            if (x) x.research.splice(i, 1);
          });
        } }, [el('i', { class: 'ph ph-x' })]),
      ]))),
  ]);
}

function addResearch(pieceId, kind) {
  const text = prompt(kind === 'link' ? 'paste URL' : kind === 'quote' ? 'paste quote' : kind === 'stat' ? 'paste stat' : 'note text');
  if (!text) return;
  const source = kind !== 'link' ? prompt('source (optional)', '') : '';
  update((d) => {
    const x = d.substack.pieces.find((y) => y.id === pieceId);
    if (!x) return;
    x.research = x.research || [];
    x.research.push({ kind, text, source, addedAt: new Date().toISOString() });
  });
}

function videoTab(p) {
  const vf = p.videoFields || {};
  const fields = [
    ['script',    'script (hook / body / CTA)', 'textarea'],
    ['shotList',  'shot list',                  'textarea'],
    ['broll',     'B-roll notes',                'textarea'],
    ['thumbnail', 'thumbnail idea',              'input'],
    ['status',    'recording / editing / upload status', 'input'],
    ['equipment', 'equipment checklist',         'textarea'],
  ];
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-video' }), 'video']),
    el('div', { class: 'stack' }, fields.map(([key, label, type]) => {
      const ctrl = type === 'textarea'
        ? el('textarea', { class: 'input', rows: 4, value: vf[key] || '' })
        : el('input',    { class: 'input', value: vf[key] || '' });
      ctrl.addEventListener('input', () => {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => update((d) => {
          const x = d.substack.pieces.find((y) => y.id === p.id);
          if (!x) return;
          x.videoFields = x.videoFields || {};
          x.videoFields[key] = ctrl.value;
        }), 400);
      });
      return el('label', { class: 'field' }, [el('span', { class: 'field__label' }, label), ctrl]);
    })),
  ]);
}

function publishTab(p) {
  const ck = p.publishChecklist || {};
  const items = ['title polished', 'subtitle written', 'cover image', 'tags chosen', 'cross-post planned'];
  return el('div', { class: 'stack' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-rocket-launch' }), 'publish checklist']),
      el('div', { class: 'stack' }, items.map((label) => {
        const checked = !!ck[label];
        const cb = el('label', { class: 'check', dataset: { done: String(checked) }, style: { padding: '4px 0' } }, [
          el('span', { class: 'check__box', 'aria-hidden': 'true' }),
          el('span', { class: 'check__label' }, label),
        ]);
        cb.addEventListener('click', (e) => {
          e.preventDefault();
          update((d) => {
            const x = d.substack.pieces.find((y) => y.id === p.id);
            if (!x) return;
            x.publishChecklist = x.publishChecklist || {};
            x.publishChecklist[label] = !x.publishChecklist[label];
          });
        });
        return cb;
      })),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-calendar' }), 'schedule publish']),
      el('div', { class: 'row', style: { gap: '6px' } }, [
        el('input', { class: 'input', type: 'date', value: p.scheduledPublishDate || '',
          onChange: (e) => update((d) => {
            const x = d.substack.pieces.find((y) => y.id === p.id);
            if (x) x.scheduledPublishDate = e.target.value;
          }) }),
      ]),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-chart-line-up' }), 'performance (after publish)']),
      el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
        perfField(p, 'views',  'views'),
        perfField(p, 'subs',   '+ subs'),
        perfField(p, 'likes',  'likes'),
      ]),
    ]),
  ]);
}

function perfField(p, key, label) {
  return el('label', { class: 'field', style: { flex: '1 1 90px', margin: 0 } }, [
    el('span', { class: 'field__label' }, label),
    el('input', { class: 'input', type: 'number', value: p.performance?.[key] || '',
      onInput: (e) => update((d) => {
        const x = d.substack.pieces.find((y) => y.id === p.id);
        if (!x) return;
        x.performance = x.performance || {};
        x.performance[key] = parseInt(e.target.value, 10) || 0;
      }) }),
  ]);
}

function versionsTab(p) {
  const versions = p.versions || [];
  if (versions.length === 0) {
    return el('div', { class: 'card empty' }, [
      el('div', { class: 'empty__art' }, [el('i', { class: 'ph-duotone ph-clock-counter-clockwise' })]),
      el('p', null, 'no snapshots yet · hit "snapshot" in the body tab to save one.'),
    ]);
  }
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-clock-counter-clockwise' }), 'versions', el('small', null, `${versions.length}`)]),
    el('div', { class: 'stack' }, versions.map((v) => el('div', { class: 'row row--between' }, [
      el('span', null, [el('strong', null, v.label), el('span', { class: 'muted', style: { fontSize: '0.7rem' } }, ` · ${relative(Date.parse(v.at))}`)]),
      el('div', { class: 'row', style: { gap: '6px' } }, [
        el('button', { class: 'btn btn--soft', onClick: () => {
          openSheet(el('div', { class: 'stack' }, [
            el('p', { class: 'muted' }, `preview of ${v.label}`),
            el('pre', { style: { whiteSpace: 'pre-wrap', fontFamily: 'inherit' } }, v.body),
          ]), { title: v.label });
        } }, 'preview'),
        el('button', { class: 'btn btn--soft', onClick: () => {
          if (!confirm(`revert body to ${v.label}? current body becomes a new snapshot first.`)) return;
          update((d) => {
            const x = d.substack.pieces.find((y) => y.id === p.id);
            if (!x) return;
            // Snapshot current
            x.versions.unshift({ id: uid('v'), body: x.body, at: new Date().toISOString(), label: `v${x.versions.length + 1} (pre-revert)` });
            x.body = v.body;
          });
          toast('reverted ✓');
          activePieceTab = 'body'; rePaint();
        } }, 'revert'),
      ]),
    ]))),
  ]);
}

function startVoice(target) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('voice not available'); return; }
  const rec = new SR(); rec.lang = navigator.language || 'en-IN';
  rec.continuous = false; rec.interimResults = true;
  rec.onresult = (e) => { let txt = ''; for (const r of e.results) txt += r[0].transcript; target.value = txt; };
  rec.onend = () => toast('listening done');
  rec.start(); toast('listening… ✿');
}
