// Wave-2+ tabs render a friendly "coming next" empty state.

import { el } from '../utils/dom.js';

export function placeholder({ title, wave, blurb, art }) {
  return function render(_params, host) {
    host.appendChild(el('div', { class: 'stack' }, [
      el('h1', null, title),
      el('div', { class: 'card', style: { textAlign: 'center', padding: '32px 16px' } }, [
        el('div', { style: { fontSize: '3rem' } }, art || '✿'),
        el('p', { class: 'muted', style: { marginTop: '8px' } }, blurb || ''),
        el('div', { class: 'chip', style: { marginTop: '12px' } }, `wave ${wave}`),
      ])
    ]));
  };
}
