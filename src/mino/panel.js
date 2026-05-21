// Mino's panel · chat + suggestions + check-in + panic button + controls.

import { $, el, clear, openSheet, closeSheet, toast } from '../utils/dom.js';
import { getState, update, TODAY } from '../state.js';
import { say } from './voice.js';
import { snoozeMino, nextAction } from './mascot.js';
import { todayKey, dayPart } from '../utils/format.js';
import { pushSupported, getStatus, subscribeMino, unsubscribeMino, showLocalTest } from '../utils/push.js';

export function openMinoPanel() {
  const sheet = openSheet(renderPanel, { title: 'Mino ♡' });
  // Focus input if we render one (chat field).
  setTimeout(() => {
    const i = sheet?.querySelector?.('input, textarea');
    if (i) i.focus();
  }, 320);
}

function renderPanel() {
  const s = getState();
  const part = dayPart();

  // One next action · never a list.
  const action = nextAction(s);

  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('div', { class: 'card card--hero' }, [
    el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.25rem' } },
      say(`greet_${part === 'late' ? 'night' : part}`)),
    el('p', { class: 'muted', style: { margin: '6px 0 12px' } }, 'one thing at a time, kanna ✿'),
    el('div', { class: 'card', style: { margin: 0, background: 'var(--surface)' } }, [
      el('div', { class: 'card__title' }, [
        el('i', { class: 'ph-fill ph-arrow-right', 'aria-hidden': 'true', style: { color: 'var(--primary)' } }),
        'next', el('small', null, 'just one')
      ]),
      el('p', { style: { margin: 0 } }, action),
    ]),
  ]));

  // Quick check-in row
  wrap.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-hand-heart', 'aria-hidden': 'true' }),
      'check in', el('small', null, 'no shame, ever')
    ]),
    quickToggleRow('mn-2', '💊 morning meds'),
    quickToggleRow('mn-3', '🥣 breakfast'),
    quickToggleRow('mn-4', '💧 water'),
    quickToggleRow('nt-1', '💊 evening meds'),
    quickToggleRow('nt-4', '📓 journaled'),
  ]));

  // Panic button → playbook  +  Urge button → log + swap
  wrap.appendChild(el('div', { class: 'card', style: { borderColor: 'var(--primary-soft)' } }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-lifebuoy', 'aria-hidden': 'true' }),
      'spiraling?', el('small', null, 'gentle exit')
    ]),
    el('p', { class: 'muted' }, say('spiral_panic')),
    el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', {
        class: 'btn btn--block', type: 'button',
        onClick: () => { closeSheet(); location.hash = '/playbook'; }
      }, [
        el('i', { class: 'ph-fill ph-magic-wand', 'aria-hidden': 'true', style: { marginRight: '6px' } }),
        'playbook'
      ]),
      el('button', {
        class: 'btn btn--soft', type: 'button',
        onClick: async () => { closeSheet(); const m = await import('../ui/doomscroll.js'); m.openUrgeSheet(); }
      }, [el('i', { class: 'ph-fill ph-shield-check' }), ' urge']),
    ]),
  ]));

  // Chat (Gemini-backed via /api/mino-chat; falls back to pattern phrases if offline)
  wrap.appendChild(chatBlock());

  // Real check-ins (6x/day Web Push)
  wrap.appendChild(checkinsBlock());

  // Wardrobe (reward unlocks)
  wrap.appendChild(wardrobeBlock());

  // Controls
  wrap.appendChild(controlsBlock());

  return wrap;
}

function checkinsBlock() {
  const card = el('div', { class: 'card' });
  const statusLine = el('p', { class: 'muted', style: { margin: '0 0 8px' } }, 'checking…');

  const enableBtn = el('button', { class: 'btn btn--block', type: 'button' }, [
    el('i', { class: 'ph-fill ph-bell-ringing', 'aria-hidden': 'true', style: { marginRight: '6px' } }),
    'turn on check-ins (6 a day)'
  ]);

  const disableBtn = el('button', { class: 'btn btn--soft', type: 'button' }, 'turn off');
  const testBtn    = el('button', { class: 'btn btn--soft', type: 'button' }, 'send test ping');

  const row = el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', marginTop: '8px' } });

  async function refresh() {
    if (!pushSupported()) {
      statusLine.textContent = 'this browser does not support push · install the PWA on Android for best results';
      enableBtn.disabled = true; disableBtn.disabled = true; testBtn.disabled = true;
      return;
    }
    try {
      const st = await getStatus();
      const onShelf = st.subscribed && st.permission === 'granted';
      statusLine.textContent = onShelf
        ? 'on ♡ · Mino pings you 6 times a day (every 4 hours, IST)'
        : (st.permission === 'denied'
            ? 'permission was denied in browser settings · open browser site-settings to allow'
            : 'off · tap below to let Mino check in on you');
      row.innerHTML = '';
      if (onShelf) {
        row.appendChild(testBtn);
        row.appendChild(disableBtn);
      } else {
        row.appendChild(enableBtn);
        row.appendChild(testBtn);
      }
    } catch (e) {
      statusLine.textContent = 'could not check status · ' + (e.message || 'error');
    }
  }

  enableBtn.addEventListener('click', async () => {
    enableBtn.disabled = true; enableBtn.textContent = 'asking permission…';
    try {
      await subscribeMino();
      toast('check-ins on ♡');
      try { await showLocalTest('hi ✿ check-ins are on. i will say hi every 4 hours.'); } catch {}
    } catch (e) {
      toast('couldn\'t turn on · ' + (e.message || 'error'));
    } finally {
      enableBtn.disabled = false; enableBtn.textContent = 'turn on check-ins (6 a day)';
      refresh();
    }
  });

  disableBtn.addEventListener('click', async () => {
    disableBtn.disabled = true;
    try { await unsubscribeMino(); toast('check-ins off'); }
    catch (e) { toast('couldn\'t turn off · ' + (e.message || 'error')); }
    finally { disableBtn.disabled = false; refresh(); }
  });

  testBtn.addEventListener('click', async () => {
    try { await showLocalTest(); }
    catch (e) { toast('couldn\'t show · ' + (e.message || 'error')); }
  });

  card.appendChild(el('div', { class: 'card__title' }, [
    el('i', { class: 'ph-duotone ph-bell-simple-ringing', 'aria-hidden': 'true' }),
    'real check-ins', el('small', null, '6 a day · even when app is closed')
  ]));
  card.appendChild(statusLine);
  card.appendChild(row);
  card.appendChild(el('p', { class: 'muted', style: { fontSize: '0.7rem', margin: '8px 0 0' } },
    'on Android: install the app first (More → install). on iPhone: add to Home Screen (Safari share menu) · iOS only sends push to installed PWAs.'));

  refresh();
  return card;
}

function wardrobeBlock() {
  const s = getState();
  const unlocked = new Set(s.mino.unlocks || []);
  const equipped = s.mino.equippedAccessoryId || null;

  // Lazy access UNLOCKS list · populated from unlocks.js
  // We hard-code a small list mirror here to avoid import cycle in panel.js.
  const ALL = [
    { id: 'default', label: 'starter', emoji: '✿' },
    { id: 'flower',  label: 'flower crown', emoji: '🌸' },
    { id: 'wings',   label: 'tiny wings',   emoji: '🦋' },
    { id: 'star',    label: 'sparkle star', emoji: '⭐' },
    { id: 'bow',     label: 'silky bow',    emoji: '🎀' },
    { id: 'sushi',   label: 'snack pouch',  emoji: '🍱' },
    { id: 'cap',     label: 'graduate cap', emoji: '🎓' },
    { id: 'tea',     label: 'chai cup',     emoji: '🍵' },
    { id: 'ribbon',  label: 'rainbow ribbon', emoji: '🌈' },
    { id: 'heart',   label: 'sparkly heart',  emoji: '💖' },
  ];

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-flower-lotus', 'aria-hidden': 'true' }),
      'wardrobe', el('small', null, `${unlocked.size} unlocked`)
    ]),
    el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
      ALL.map((u) => {
        const isUnlocked = unlocked.has(u.id);
        const isEquipped = equipped === u.id || (!equipped && u.id === [...unlocked].pop());
        return el('button', {
          class: isEquipped ? 'chip chip--primary' : 'chip',
          type: 'button',
          style: {
            cursor: isUnlocked ? 'pointer' : 'not-allowed',
            opacity: isUnlocked ? 1 : 0.4,
          },
          disabled: !isUnlocked,
          title: u.label,
          onClick: () => {
            if (!isUnlocked) return;
            update((d) => { d.mino.equippedAccessoryId = u.id; });
            toast(`equipped ${u.emoji} ${u.label}`);
          }
        }, [u.emoji, ' ', u.label]);
      })
    ),
    el('p', { class: 'muted', style: { fontSize: '0.7rem', margin: '6px 0 0' } }, 'unlocks come from showing up. never taken away.'),
  ]);
}

function quickToggleRow(taskId, label) {
  const s = getState();
  const t = todayKey();
  const done = !!(s.nonNegotiables.tickLog[t] || {})[taskId];
  const row = el('label', { class: 'check', dataset: { done: String(done) } }, [
    el('span', { class: 'check__box', 'aria-hidden': 'true' }),
    el('span', { class: 'check__label' }, label),
  ]);
  row.addEventListener('click', (e) => {
    e.preventDefault();
    update((d) => {
      const day = todayKey();
      d.nonNegotiables.tickLog[day] = d.nonNegotiables.tickLog[day] || {};
      const wasDone = !!d.nonNegotiables.tickLog[day][taskId];
      d.nonNegotiables.tickLog[day][taskId] = !wasDone;
      d.doneJar.byDate[day] = d.doneJar.byDate[day] || [];
      if (!wasDone) {
        d.doneJar.byDate[day].push({ kind: 'nonneg', id: taskId, label, at: new Date().toISOString() });
      } else {
        d.doneJar.byDate[day] = d.doneJar.byDate[day].filter((j) => !(j.kind === 'nonneg' && j.id === taskId));
      }
    });
    const nowDone = !!(getState().nonNegotiables.tickLog[t] || {})[taskId];
    row.dataset.done = String(nowDone);
  });
  return row;
}

function chatBlock() {
  const log = el('div', { class: 'stack', style: { fontSize: '0.875rem' } });
  const input = el('input', { class: 'input', type: 'text', placeholder: 'ask Mino · or type a quick log…' });
  const send = el('button', { class: 'btn', type: 'button' }, 'say');

  async function pushTurn(role, text) {
    log.appendChild(el('div', {
      style: {
        alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
        background: role === 'user' ? 'var(--primary-soft)' : 'var(--surface-2)',
        color: role === 'user' ? 'var(--primary-deep)' : 'var(--ink)',
        padding: '8px 12px',
        borderRadius: '16px',
        maxWidth: '85%',
      }
    }, text));
  }

  async function onSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await pushTurn('user', text);
    let reply;
    try {
      const res = await fetch('/api/mino-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: contextSnapshot(),
        }),
      });
      const data = await res.json();
      reply = data.reply || data.error || say('callout_default');
    } catch {
      reply = patternReply(text);
    }
    await pushTurn('mino', reply);
  }

  send.addEventListener('click', onSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSend(); });

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-chat-circle-dots', 'aria-hidden': 'true' }),
      'chat', el('small', null, 'logs count too')
    ]),
    log,
    el('div', { class: 'row', style: { marginTop: '8px', gap: '8px' } }, [input, send]),
  ]);
}

function controlsBlock() {
  const s = getState();
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-sliders-horizontal', 'aria-hidden': 'true' }),
      'controls', el('small', null, 'you set the tone')
    ]),
    el('label', { class: 'field' }, [
      el('span', { class: 'field__label' }, 'chattiness'),
      el('select', {
        class: 'select',
        onChange: (e) => update((d) => { d.mino.chattiness = e.target.value; })
      }, [
        ['chatty', 'chatty · lots of pings'],
        ['balanced', 'balanced · once per day-part'],
        ['quiet', 'quiet · only when I tap her'],
      ].map(([v, l]) => el('option', { value: v, selected: s.mino.chattiness === v }, l)))
    ]),
    el('label', { class: 'field' }, [
      el('span', { class: 'field__label' }, 'quiet hours'),
      el('div', { class: 'row', style: { gap: '8px' } }, [
        el('input', {
          class: 'input', type: 'time', value: s.mino.quietHours.from,
          onChange: (e) => update((d) => { d.mino.quietHours.from = e.target.value; })
        }),
        el('span', { class: 'muted' }, '→'),
        el('input', {
          class: 'input', type: 'time', value: s.mino.quietHours.to,
          onChange: (e) => update((d) => { d.mino.quietHours.to = e.target.value; })
        }),
      ]),
    ]),
    el('div', { class: 'row', style: { gap: '8px' } }, [
      el('button', { class: 'btn btn--soft', type: 'button', onClick: () => { snoozeMino(60);  toast('Mino snoozed 1h'); }}, 'snooze 1h'),
      el('button', { class: 'btn btn--soft', type: 'button', onClick: () => { snoozeMino(240); toast('Mino snoozed 4h'); }}, 'snooze 4h'),
    ]),
  ]);
}

function contextSnapshot() {
  const s = getState();
  const t = todayKey();
  return {
    time: new Date().toISOString(),
    dayPart: dayPart(),
    nonNegotiablesTodayDone: Object.entries(s.nonNegotiables.tickLog[t] || {}).filter(([,v]) => v).map(([k]) => k),
    openTasks: s.tasks.negotiable.filter((x) => x.status !== 'done').slice(0, 5).map((x) => x.title),
    chattiness: s.mino.chattiness,
  };
}

function patternReply(text) {
  const lower = text.toLowerCase();
  if (/\b(meds|medicine|dawai|davai)\b/.test(lower)) return say('ask_meds_morning');
  if (/\b(lunch|khaana|food|bhojanam)\b/.test(lower))  return say('ask_lunch');
  if (/\b(sleep|so|tired|neend)\b/.test(lower))        return say('greet_night');
  if (/\b(scroll|insta|instagram|reel)\b/.test(lower)) return say('urge_redirect');
  if (/\b(sad|down|spiral|crying|stressed)\b/.test(lower)) return say('spiral_panic');
  if (/\b(thank|love|cute|♡)\b/.test(lower))            return 'i know ♡';
  return say('callout_default');
}
