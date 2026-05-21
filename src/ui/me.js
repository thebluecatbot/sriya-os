// Me / settings tab — theme variant, a11y, backup, language, reset.

import { $, el, clear, toast } from '../utils/dom.js';
import { getState, update, subscribe, exportAll, importAll, resetAll, IS_GUEST, GUEST_NAME } from '../state.js';

const THEMES = [
  { id: 'blush',    label: 'Blush ✿',    swatch: '#FFD2E0' },
  { id: 'lavender', label: 'Lavender ◇', swatch: '#E0CDF8' },
  { id: 'peachy',   label: 'Peachy 🍑',  swatch: '#FFCDB2' },
  { id: 'sakura',   label: 'Sakura 🌸',  swatch: '#FFC9DE' },
];

export function renderMe(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(buildMe()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function buildMe() {
  const s = getState();

  return el('div', { class: 'stack' }, [
    el('h1', { style: { marginBottom: '8px' } }, IS_GUEST ? `hello, ${GUEST_NAME} ♡` : 'me ✿'),
    IS_GUEST ? el('div', { class: 'install-hint' }, [
      el('span', null, '👋'),
      el('span', null, 'you are in guest mode — Journal, Playbook, and Mino check-ins stay private.')
    ]) : null,

    // Themes
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, ['theme', el('small', null, 'palette swap, instant')]),
      el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } },
        THEMES.map((t) =>
          el('button', {
            class: s.settings.theme === t.id ? 'chip chip--primary' : 'chip',
            type: 'button',
            style: { cursor: 'pointer', padding: '6px 12px' },
            onClick: () => {
              update((d) => { d.settings.theme = t.id; });
              document.body.dataset.theme = t.id;
            }
          }, [
            el('span', { style: { display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%',
              background: t.swatch, marginRight: '6px', verticalAlign: 'middle' } }),
            t.label
          ])
        )
      )
    ]),

    // Mode (auto/light/dark)
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, ['light/dark', el('small', null, 'plum at night')]),
      el('div', { class: 'row', style: { gap: '8px' } },
        ['auto', 'light', 'dark'].map((m) =>
          el('button', {
            class: s.settings.mode === m ? 'chip chip--primary' : 'chip',
            type: 'button',
            style: { cursor: 'pointer' },
            onClick: () => {
              update((d) => { d.settings.mode = m; });
              applyMode(m);
            }
          }, m)
        )
      )
    ]),

    // Petals + motion
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, ['ambience']),
      toggleRow('petals', s.settings.petalsOn,
        (v) => { update((d) => { d.settings.petalsOn = v; }); document.body.dataset.petals = v ? 'on' : 'off'; }),
      toggleRow('reduced motion', s.settings.motion === 'reduce',
        (v) => { update((d) => { d.settings.motion = v ? 'reduce' : 'auto'; }); document.body.dataset.motion = v ? 'reduce' : ''; }),
    ]),

    // A11y
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, ['reading prefs', el('small', null, 'a11y')]),
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label' }, 'font size'),
        el('select', {
          class: 'select',
          onChange: (e) => {
            update((d) => { d.settings.fontSize = e.target.value; });
            document.documentElement.dataset.fontSize = e.target.value;
          }
        }, ['md', 'lg', 'xl'].map((v) =>
          el('option', { value: v, selected: s.settings.fontSize === v }, v)
        ))
      ]),
      toggleRow('high contrast', s.settings.contrast === 'high',
        (v) => { update((d) => { d.settings.contrast = v ? 'high' : 'normal'; }); document.documentElement.dataset.contrast = v ? 'high' : ''; }),
      toggleRow('dyslexia-friendly font', s.settings.dyslexiaFont,
        (v) => { update((d) => { d.settings.dyslexiaFont = v; }); document.documentElement.dataset.dyslexic = v ? 'on' : ''; }),
    ]),

    // Language (Mino's voice still mixes; this nudges the default)
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, ['language', el('small', null, 'Mino still mixes')]),
      el('div', { class: 'row', style: { gap: '8px' } },
        [['en','English'], ['hi','Hindi (roman)'], ['te','Telugu (roman)']].map(([v, label]) =>
          el('button', {
            class: s.settings.language === v ? 'chip chip--primary' : 'chip',
            type: 'button',
            style: { cursor: 'pointer' },
            onClick: () => update((d) => { d.settings.language = v; })
          }, label)
        )
      )
    ]),

    // Backup & data
    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, ['backup', el('small', null, 'data loss = unacceptable')]),
      el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [
        el('button', { class: 'btn', onClick: doExport }, 'export JSON'),
        el('label', { class: 'btn btn--soft', style: { cursor: 'pointer' } }, [
          'import JSON',
          el('input', { type: 'file', accept: 'application/json', style: { display: 'none' }, onChange: doImport })
        ]),
        el('button', { class: 'btn btn--ghost', onClick: () => {
          if (confirm('reset all local data? (your Neon copy is untouched)')) { resetAll(); toast('reset done'); }
        } }, 'reset'),
      ]),
      el('p', { class: 'muted', style: { marginTop: '8px', fontSize: '0.75rem' } },
        IS_GUEST ? 'guests do not sync to Neon.' : 'auto-syncs to Neon a few seconds after every change.')
    ]),

    // About / version
    el('div', { class: 'card', style: { textAlign: 'center' } }, [
      el('p', { class: 'muted', style: { margin: 0 } }, 'sriya · v1 · made with petals ♡')
    ]),
  ]);
}

function toggleRow(label, value, onChange) {
  const sw = el('button', {
    class: value ? 'chip chip--primary' : 'chip',
    type: 'button',
    style: { cursor: 'pointer', minWidth: '64px' },
    onClick: () => { onChange(!value); sw.className = !value ? 'chip chip--primary' : 'chip'; sw.textContent = !value ? 'on' : 'off'; }
  }, value ? 'on' : 'off');
  return el('div', { class: 'row row--between', style: { padding: '6px 0' } }, [
    el('span', null, label),
    sw,
  ]);
}

export function applyMode(m) {
  if (m === 'auto') document.body.removeAttribute('data-mode');
  else document.body.dataset.mode = m;
}

function doExport() {
  const payload = exportAll();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = URL.createObjectURL(blob);
  a.download = `sriya-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('exported ✓');
}

function doImport(ev) {
  const file = ev.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!confirm('this replaces your current data. continue?')) return;
      importAll(data);
      toast('imported ✓');
    } catch (e) {
      toast('bad file — could not import');
    }
  };
  reader.readAsText(file);
}
