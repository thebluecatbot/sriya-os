// Tiny sync-status dot — fixed top-right, 10px circle.
// Green = synced, yellow = in flight, red = offline.
// Tap = force sync now (calls syncNow). Long-press = diagnostic toast.

import { el, toast } from '../utils/dom.js';
import { syncNow, getState, subscribeSyncStatus } from '../state.js';

let _root = null;
let _dot = null;
let _label = null;

function colorFor(status) {
  switch (status) {
    case 'ok':      return '#3CB371';   // sea green
    case 'syncing': return '#E8B73E';   // amber
    case 'offline': return '#E64967';   // raspberry red
    default:        return '#999999';
  }
}

function applyStatus(status) {
  if (!_dot) return;
  _dot.style.background = colorFor(status);
  _dot.style.boxShadow = `0 0 0 2px color-mix(in srgb, ${colorFor(status)} 30%, transparent)`;
  _dot.dataset.status = status;
  if (_label) _label.textContent = (
    status === 'ok'      ? 'synced ♡' :
    status === 'syncing' ? 'syncing…' :
    status === 'offline' ? 'OFFLINE · tap to retry' : ''
  );
}

export function mountSyncStatus() {
  if (_root) return; // mount once

  _dot = el('button', {
    type: 'button',
    'aria-label': 'sync status',
    title: 'tap to sync · long-press for details',
    style: {
      width: '12px', height: '12px',
      borderRadius: '50%',
      background: colorFor('syncing'),
      border: 'none', cursor: 'pointer',
      padding: 0, margin: 0,
      transition: 'background 0.25s ease, box-shadow 0.25s ease',
      boxShadow: `0 0 0 2px color-mix(in srgb, ${colorFor('syncing')} 30%, transparent)`,
    },
  });

  _label = el('span', {
    style: {
      fontSize: '0.62rem',
      color: 'var(--ink-mute)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    },
  }, 'syncing…');

  _root = el('div', {
    id: 'sync-status',
    style: {
      position: 'fixed', top: '6px', right: '10px',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 8px',
      borderRadius: '999px',
      background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid var(--line)',
    },
  }, [_dot, _label]);

  // Tap → force sync
  let pressTimer = null;
  const onPress = async () => {
    const s = getState();
    if (_dot.dataset.status === 'syncing') return;
    applyStatus('syncing');
    try {
      await syncNow();
      applyStatus(navigator.onLine ? 'ok' : 'offline');
      toast(navigator.onLine ? 'synced ♡' : 'still offline · saved locally');
    } catch (e) {
      applyStatus('offline');
      toast('sync failed · changes saved locally');
    }
  };

  const onLongPress = () => {
    const s = getState();
    const tasks  = s.tasks?.negotiable?.length ?? 0;
    const journ  = s.journal?.entries?.length ?? 0;
    const skin   = s.health?.skincare?.log?.length ?? 0;
    const up     = s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString() : '—';
    toast(`local · ${tasks} tasks · ${journ} journal · ${skin} skincare · last touch ${up}`);
  };

  _dot.addEventListener('click', (e) => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    onPress();
  });
  _dot.addEventListener('pointerdown', () => {
    pressTimer = setTimeout(() => { pressTimer = null; onLongPress(); }, 600);
  });
  _dot.addEventListener('pointerup', () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  });
  _dot.addEventListener('pointercancel', () => { if (pressTimer) clearTimeout(pressTimer); pressTimer = null; });

  document.body.appendChild(_root);

  // Subscribe to sync state changes from state.js
  if (typeof subscribeSyncStatus === 'function') {
    subscribeSyncStatus(applyStatus);
  }

  // Browser online/offline events
  window.addEventListener('online', () => applyStatus('syncing'));
  window.addEventListener('offline', () => applyStatus('offline'));

  // Initial state
  applyStatus(navigator.onLine ? 'syncing' : 'offline');
}
