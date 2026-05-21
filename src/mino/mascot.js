// Mino mascot · floating pink unicorn bottom-right.
// Mood states: happy, sleepy, wave, encouraging. NEVER sad.

import { $, el, clear } from '../utils/dom.js';
import { getState, subscribe, update, TODAY } from '../state.js';
import { dayPart, inQuietHours, todayKey } from '../utils/format.js';
import { say } from './voice.js';
import { openMinoPanel } from './panel.js';
import { isStaleTimer } from '../ui/timer.js';
import { equippedAccessory } from './unlocks.js';

let _calloutTimer = null;

export function mountMino() {
  const root = $('#mino-root');
  clear(root);

  const btn = el('button', {
    class: 'mino', type: 'button', 'aria-label': 'Mino · tap to open',
    dataset: { mood: 'happy' },
    onClick: () => openMinoPanel(),
  }, [
    el('img', { src: '/icons/mino.svg', alt: '', draggable: 'false', style: { width: '100%', height: '100%' } })
  ]);
  root.appendChild(btn);

  applyMood();
  subscribe(applyMood);

  // Document visibility pauses petals; also dims Mino when tab hidden.
  document.addEventListener('visibilitychange', () => {
    btn.style.opacity = document.hidden ? '0.5' : '';
  });

  // Initial callout · gentle hello + (maybe) a check-in offer.
  setTimeout(maybeCheckIn, 900);
  // Schedule a soft re-check every 20 minutes (only fires if mood/dayPart changed).
  setInterval(maybeCheckIn, 20 * 60 * 1000);
}

function applyMood() {
  const btn = $('#mino-root .mino');
  if (!btn) return;
  const s = getState();
  const hour = new Date().getHours();
  const snoozed = isSnoozed(s);

  let mood = 'happy';
  if (hour >= 22 || hour < 6) mood = 'sleepy';
  if (snoozed)                mood = 'sleepy';
  if (s.mino.checkins.length === 0) mood = 'wave';

  btn.dataset.mood = mood;

  // Equipped accessory overlay (a small floating emoji)
  const root = $('#mino-root');
  if (!root) return;
  let badge = root.querySelector('.mino-accessory');
  const acc = equippedAccessory(s);
  if (acc) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'mino-accessory';
      badge.style.cssText = 'position:absolute;top:-4px;right:-4px;font-size:1.4rem;pointer-events:none;text-shadow:0 2px 6px rgba(180,110,140,0.4);animation:mino-bob 5s ease-in-out infinite';
      root.appendChild(badge);
    }
    badge.textContent = acc;
  } else if (badge) {
    badge.remove();
  }
}

function isSnoozed(s) {
  const until = s.mino.snoozedUntil ? Date.parse(s.mino.snoozedUntil) : 0;
  return until > Date.now();
}

function isQuiet(s) {
  const { from, to } = s.mino.quietHours || {};
  if (!from || !to) return false;
  return inQuietHours(new Date(), from, to);
}

function alreadyCheckedInToday(s, key) {
  const today = TODAY();
  return s.mino.checkins.some((c) => c.date === today && c.part === key);
}

// Decide whether to surface a callout, and what to say.
function maybeCheckIn() {
  const s = getState();
  if (!s) return;
  if (isSnoozed(s)) return;
  if (isQuiet(s) && s.mino.chattiness !== 'chatty') return;
  if (s.mino.chattiness === 'quiet') return;

  // Forgot-to-stop guard takes priority · it's a real ask, not a check-in.
  if (isStaleTimer(s, 3)) {
    showCallout('still on this timer? want me to stop or split it?', {
      actionable: true,
      onConfirm: () => import('../ui/timer.js').then((m) => m.stopTimer()),
      onDismiss: () => {},
    });
    return;
  }

  const part = dayPart();
  const key = `checkin-${part}`;
  if (alreadyCheckedInToday(s, key)) {
    // After daily check-ins are done, surface "one next action" once an hour at most.
    if (shouldNudge(s)) showCallout(nextAction(s), { actionable: true });
    return;
  }

  const prompt = pickPromptForPart(part, s);
  if (!prompt) return;
  showCallout(prompt.text, {
    actionable: true,
    onConfirm: () => {
      update((d) => {
        d.mino.checkins.push({ date: TODAY(), part: key, prompt: prompt.text, answered: 'yes' });
        prompt.onYes && prompt.onYes(d);
      });
    },
    onDismiss: () => {
      update((d) => d.mino.checkins.push({ date: TODAY(), part: key, prompt: prompt.text, answered: 'dismiss' }));
    },
  });
}

function shouldNudge(s) {
  const last = s.mino.lastSuggestionAt ? Date.parse(s.mino.lastSuggestionAt) : 0;
  return Date.now() - last > 60 * 60 * 1000;
}

function pickPromptForPart(part, s) {
  const today = todayKey();
  const ticks = s.nonNegotiables.tickLog[today] || {};
  const has = (id) => !!ticks[id];

  if (part === 'morning' && !has('mn-2')) return { text: say('ask_meds_morning'), onYes: (d) => tick(d, 'mn-2') };
  if (part === 'morning' && !has('mn-3')) return { text: say('ask_breakfast'),    onYes: (d) => tick(d, 'mn-3') };
  if (part === 'afternoon')                return { text: say('ask_lunch'),        onYes: (d) => {} };
  if (part === 'evening' && !has('nt-1')) return { text: say('ask_meds_evening'), onYes: (d) => tick(d, 'nt-1') };
  if (part === 'evening' && !has('nt-2')) return { text: say('ask_dinner'),       onYes: (d) => tick(d, 'nt-2') };
  if (part === 'evening' && !has('nt-4')) return { text: say('ask_journal'),      onYes: (d) => {} };
  if (part === 'late') return {
    text: say('ask_plan_tomorrow'),
    onYes: () => import('../ui/tasks.js').then((m) => m.openNightPlan()),
  };
  return { text: say(`greet_${part === 'late' ? 'night' : part}`), onYes: () => {} };
}

function tick(draft, taskId) {
  const t = todayKey();
  draft.nonNegotiables.tickLog[t] = draft.nonNegotiables.tickLog[t] || {};
  draft.nonNegotiables.tickLog[t][taskId] = true;
}

export function nextAction(s) {
  const ticks = s.nonNegotiables.tickLog[todayKey()] || {};
  if (!ticks['mn-2']) return 'one tiny win: tick morning meds ✿';
  if (!ticks['mn-4']) return 'a glass of water · go';

  // Energy-aware: pick a task that fits today's mood
  const todayMood = (s.health.moodLog || []).find((l) => l.date === todayKey())?.score;
  const open = s.tasks.negotiable.filter((t) => t.status !== 'done');
  let pick;
  if (todayMood >= 4)      pick = open.find((t) => t.energy === 'heavy') || open[0];
  else if (todayMood <= 2) pick = open.find((t) => t.energy === 'light') || open[0];
  else                      pick = open[0];

  if (pick) {
    const why = todayMood <= 2 ? ' · soft pick for a low day' : todayMood >= 4 ? ' · you have the fuel' : '';
    return `start: "${pick.title}"${why}`;
  }
  if (!ticks['nt-4']) return 'two lines in the journal, kanna';
  return say('greet_evening');
}

export function showCallout(text, { ms = 6500, actionable = false, onConfirm, onDismiss } = {}) {
  const root = $('#mino-root');
  if (!root) return;
  const existing = root.querySelector('.mino-callout');
  if (existing) existing.remove();
  if (_calloutTimer) { clearTimeout(_calloutTimer); _calloutTimer = null; }

  const bubble = el('div', { class: 'mino-callout', role: 'status' }, [
    el('div', { style: { marginBottom: actionable ? '6px' : 0 } }, text),
    actionable ? el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', { class: 'btn btn--soft', style: { padding: '4px 10px', fontSize: '0.75rem' },
        onClick: () => { onConfirm && onConfirm(); bubble.remove(); } }, 'yes ♡'),
      el('button', { class: 'btn btn--ghost', style: { padding: '4px 10px', fontSize: '0.75rem' },
        onClick: () => { onDismiss && onDismiss(); bubble.remove(); } }, 'later'),
    ]) : null,
  ]);
  root.appendChild(bubble);
  update((d) => { d.mino.lastSuggestionAt = new Date().toISOString(); }, { silent: true });
  if (!actionable) _calloutTimer = setTimeout(() => bubble.remove(), ms);
}

export function snoozeMino(mins = 60) {
  update((d) => {
    d.mino.snoozedUntil = new Date(Date.now() + mins * 60_000).toISOString();
  });
}
