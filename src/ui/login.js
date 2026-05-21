// Login screen, shown before the app boots if no user is logged in.

import { el, clear, toast } from '../utils/dom.js';
import { login } from '../auth.js';

export function showLoginGate({ onLogin }) {
  const root = document.querySelector('#view');
  if (!root) return;
  clear(root);
  root.appendChild(buildLogin({ onLogin }));
  // Hide chrome that doesn't make sense at login
  document.body.dataset.login = 'on';
}

export function hideLoginGate() {
  document.body.dataset.login = '';
}

function buildLogin({ onLogin }) {
  const fU = el('input', {
    class: 'input', type: 'text', placeholder: 'username',
    'aria-label': 'Username', autocomplete: 'username',
    autocapitalize: 'off', spellcheck: 'false',
  });
  const fP = el('input', {
    class: 'input', type: 'password', placeholder: 'password',
    'aria-label': 'Password', autocomplete: 'current-password',
  });

  function attempt() {
    const r = login(fU.value, fP.value);
    if (!r.ok) { toast(r.error || 'try again'); fP.value = ''; fP.focus(); return; }
    hideLoginGate();
    if (typeof onLogin === 'function') onLogin();
  }

  fP.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
  fU.addEventListener('keydown', (e) => { if (e.key === 'Enter') fP.focus(); });

  const wrap = el('div', { class: 'login-wrap' }, [
    el('div', { class: 'login-card' }, [
      el('div', { class: 'login-logo' }, '✿'),
      el('h1', { class: 'login-title' }, 'sriya'),
      el('p', { class: 'login-sub' }, 'sign in to continue'),
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label' }, 'username'),
        fU,
      ]),
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label' }, 'password'),
        fP,
      ]),
      el('button', { class: 'btn btn--block', onClick: attempt }, 'continue'),
      el('p', { class: 'muted login-hint' }, 'private app, two accounts only.'),
    ]),
  ]);

  setTimeout(() => fU.focus(), 80);
  return wrap;
}
