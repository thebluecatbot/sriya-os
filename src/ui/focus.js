// Focus mode · DND screen for a single work block.
// Mino quiet, petals calmed, only the task + timer.

import { el, clear, toast } from '../utils/dom.js';
import { getState, subscribe, update, uid } from '../state.js';
import { fmtDuration, todayKey } from '../utils/format.js';

let tickHandle = null;

export function renderFocus(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(build()); };
  paint();
  unsub = subscribe(paint);

  // Apply focus-mode class to body (hides Mino, calms petals, hides FAB)
  document.body.dataset.focus = 'on';

  // Tick every second to update the live counter
  tickHandle = setInterval(() => {
    const t = host.querySelector('[data-focus-time]');
    if (t) {
      const s = getState();
      if (s.timer.active?.startedAt) t.textContent = fmtDuration(Date.now() - Date.parse(s.timer.active.startedAt));
    }
  }, 1000);

  host.addEventListener('beforerouted', () => {
    unsub && unsub();
    if (tickHandle) clearInterval(tickHandle);
    document.body.dataset.focus = '';
  }, { once: true });
}

function build() {
  const s = getState();
  const wrap = el('div', { class: 'stack', style: { minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' } });

  const active = s.timer.active;
  const linkedTask = active?.linkedTaskId
    ? s.tasks.negotiable.find((t) => t.id === active.linkedTaskId)
    : (s.tasks.mainThingByDate[todayKey()]
        ? s.tasks.negotiable.find((t) => t.id === s.tasks.mainThingByDate[todayKey()])
        : null);

  wrap.appendChild(el('div', { class: 'card card--hero', style: { width: '100%', maxWidth: '420px', textAlign: 'center', padding: 'var(--space-6)' } }, [
    el('div', { class: 'chip', style: { marginBottom: '14px', background: 'var(--surface)' } },
      [el('i', { class: 'ph-fill ph-eye' }), ' focus mode']),
    el('h2', null, linkedTask?.title || active?.label || 'one thing ✿'),
    el('div', { dataset: { focusTime: '' }, style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '3rem', margin: '20px 0', fontVariantNumeric: 'tabular-nums' } },
      active?.startedAt ? fmtDuration(Date.now() - Date.parse(active.startedAt)) : '0:00'),
    el('p', { class: 'muted', style: { margin: '0 0 16px' } },
      active ? 'tracking · breath in, breath out.' : 'pick a task to focus on.'),
    !active
      ? el('div', { class: 'row', style: { gap: '6px', justifyContent: 'center' } }, [
          el('button', { class: 'btn', onClick: () => startFromMainThing() }, [el('i', { class: 'ph-fill ph-play' }), ' start']),
          el('a', { class: 'btn btn--soft', href: '#/tasks' }, 'pick task'),
        ])
      : el('div', { class: 'row', style: { gap: '6px', justifyContent: 'center' } }, [
          el('button', { class: 'btn', onClick: () => exitFocus() }, [el('i', { class: 'ph-fill ph-check-circle' }), ' done · how did that go?']),
          el('a', { class: 'btn btn--ghost', href: '#/today' }, 'pause focus'),
        ]),
  ]));

  // Ambient sound toggle (lo-fi via a free CDN audio loop · optional)
  wrap.appendChild(el('div', { style: { marginTop: 'var(--space-4)' } }, [
    el('button', {
      class: 'btn btn--soft', id: 'focus-sound',
      onClick: () => toggleSound(),
    }, [el('i', { class: 'ph ph-music-notes' }), ' ambient (off)'])
  ]));

  return wrap;
}

async function startFromMainThing() {
  const s = getState();
  const main = s.tasks.mainThingByDate[todayKey()];
  const t = main ? s.tasks.negotiable.find((x) => x.id === main) : s.tasks.negotiable.filter((x) => x.status !== 'done')[0];
  if (!t) { toast('add a task first'); return; }
  const tm = await import('./timer.js');
  tm.startTimer({ label: t.title, categoryId: t.linkedModule?.kind || 'other', person: 'sriya', note: '' });
  update((d) => {
    if (d.timer.active) d.timer.active.linkedTaskId = t.id;
  });
}

let audioEl = null;
function toggleSound() {
  const btn = document.querySelector('#focus-sound');
  if (audioEl && !audioEl.paused) {
    audioEl.pause();
    btn.innerHTML = `<i class="ph ph-music-notes"></i> ambient (off)`;
    return;
  }
  if (!audioEl) {
    // Soft rain · free / royalty-free loop
    audioEl = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_8c9f927a08.mp3');
    audioEl.loop = true;
    audioEl.volume = 0.3;
  }
  audioEl.play().then(() => {
    btn.innerHTML = `<i class="ph-fill ph-music-notes"></i> ambient (on)`;
  }).catch(() => {
    toast('tap again to play audio');
  });
}

async function exitFocus() {
  const tm = await import('./timer.js');
  // Capture the timer label before stopping, for the "how did it go" log
  const s = getState();
  const label = s.timer.active?.label || 'focus session';
  const mins = s.timer.active?.startedAt
    ? Math.round((Date.now() - Date.parse(s.timer.active.startedAt)) / 60_000)
    : 0;
  tm.stopTimer();

  // Stop ambient
  if (audioEl) { try { audioEl.pause(); } catch {} }

  // Quick "how did it go" prompt
  const note = prompt(`done · ${label} · ${mins}m\n\nhow did that go? (one line, optional)`);
  if (note && note.trim()) {
    update((d) => {
      d.doneJar.byDate[todayKey()] = d.doneJar.byDate[todayKey()] || [];
      d.doneJar.byDate[todayKey()].push({
        kind: 'focus', id: uid('f'), label: `${label} · ${note.trim()}`, at: new Date().toISOString(),
      });
    });
  }
  location.hash = '/today';
  toast('logged ✿');
}
