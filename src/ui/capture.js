// Global quick-capture sheet. One field, smart routing, voice input.
// Routes: task | idea | quote | thought | journal | log

import { el, openSheet, closeSheet, toast, $ } from '../utils/dom.js';
import { update, uid, TODAY } from '../state.js';
import { parseTask } from '../utils/parse-task.js';

const DEST_LABELS = {
  task:    'task',
  idea:    'substack idea',
  quote:   'quote',
  thought: 'thought-park',
  journal: 'journal line',
  log:     'log entry',
};

export function openCapture() {
  const input = el('textarea', { class: 'input', rows: 3, placeholder: 'type or speak anything…', 'aria-label': 'Quick capture' });
  const destChips = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } });
  let dest = 'task';

  function paintChips() {
    destChips.innerHTML = '';
    Object.keys(DEST_LABELS).forEach((k) => {
      const chip = el('button', {
        class: dest === k ? 'chip chip--primary' : 'chip',
        type: 'button',
        style: { cursor: 'pointer' },
        onClick: () => { dest = k; paintChips(); }
      }, DEST_LABELS[k]);
      destChips.appendChild(chip);
    });
  }

  // Smart-default routing — first non-empty heuristic wins.
  input.addEventListener('input', () => {
    const t = input.value.toLowerCase();
    let guess = 'task';
    if (/^["“].+["”]\s*[—-]/.test(input.value)) guess = 'quote';
    else if (/^(idea|substack|post|piece|video|essay):/.test(t)) guess = 'idea';
    else if (/^(thought|stuck|spiral|head|mind):/.test(t))        guess = 'thought';
    else if (/^(journal|today|felt|feeling):/.test(t))            guess = 'journal';
    else if (/\b(took|logged|done|finished)\b/.test(t))            guess = 'log';
    dest = guess;
    paintChips();
  });

  const voiceBtn = el('button', { class: 'btn btn--soft', type: 'button', 'aria-label': 'Voice input' }, [
    el('i', { class: 'ph-fill ph-microphone', 'aria-hidden': 'true', style: { marginRight: '6px' } }),
    'voice'
  ]);
  voiceBtn.addEventListener('click', () => startVoice(input));

  paintChips();

  openSheet(el('div', { class: 'stack' }, [
    input,
    voiceBtn,
    el('div', { class: 'field__label' }, 'send to'),
    destChips,
    el('button', {
      class: 'btn btn--block',
      onClick: () => {
        const text = input.value.trim();
        if (!text) { toast('nothing to capture'); return; }
        route(dest, text);
        closeSheet();
      }
    }, 'capture ✿'),
  ]), { title: 'quick capture' });

  setTimeout(() => input.focus(), 320);
}

function route(dest, text) {
  switch (dest) {
    case 'task': {
      const parsed = parseTask(text);
      update((d) => {
        d.tasks.negotiable.unshift({
          id: uid('t'), type: 'negotiable',
          title: parsed.title, emoji: parsed.emoji || '',
          category: parsed.category,
          due: parsed.due, estMins: parsed.estMins, priority: parsed.priority,
          energy: parsed.energy || 'light',
          person: 'sriya', subtasks: [], status: 'open',
          linkedModule: parsed.linkedModule || null,
          createdAt: new Date().toISOString(),
        });
      });
      toast('task added ✓');
      break;
    }
    case 'idea': {
      update((d) => {
        d.substack.ideas.unshift({ id: uid('i'), text, createdAt: new Date().toISOString() });
      });
      toast('idea parked ✓');
      break;
    }
    case 'quote': {
      update((d) => {
        d.reading.quotes.unshift({ id: uid('q'), text, date: new Date().toISOString(), tags: [] });
      });
      toast('quote saved ✓');
      break;
    }
    case 'thought': {
      update((d) => {
        d.thoughtPark.items.unshift({ id: uid('p'), text, date: new Date().toISOString(), triaged: false });
      });
      toast('parked ✿');
      break;
    }
    case 'journal': {
      update((d) => {
        d.journal.entries.unshift({
          id: uid('j'), date: TODAY(), time: new Date().toISOString(), body: text, mood: null,
        });
      });
      toast('journal line saved ✓');
      break;
    }
    case 'log': {
      update((d) => {
        d.doneJar.byDate[TODAY()] = d.doneJar.byDate[TODAY()] || [];
        d.doneJar.byDate[TODAY()].push({ kind: 'note', label: text, at: new Date().toISOString() });
      });
      toast('logged ✓');
      break;
    }
  }
}

// parseTask now lives in src/utils/parse-task.js — shared with the brain-dump.

function startVoice(input) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('voice not available on this browser'); return; }
  const rec = new SR();
  rec.lang = navigator.language || 'en-IN';
  rec.continuous = false;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let txt = '';
    for (const r of e.results) txt += r[0].transcript;
    input.value = txt;
    input.dispatchEvent(new Event('input'));
  };
  rec.onerror = () => toast('mic error — try typing');
  rec.onend = () => toast('listening done');
  rec.start();
  toast('listening… ✿');
}
