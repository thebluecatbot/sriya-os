// Tiny DOM helpers — no framework, just sugar. (v2 - children flattening)

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  // Flatten so .map() inside a children array Just Works.
  const flat = [];
  const queue = Array.isArray(children) ? [...children] : [children];
  while (queue.length) {
    const c = queue.shift();
    if (c == null || c === false) continue;
    if (Array.isArray(c)) { queue.unshift(...c); continue; }
    flat.push(c);
  }
  for (const c of flat) {
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

export function toast(msg, ms = 2600) {
  const root = $('#toast-root');
  if (!root) return;
  const t = el('div', { class: 'toast', role: 'status' }, msg);
  root.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export function bloomAt(x, y, n = 6) {
  // Petal-bloom micro-interaction on check.
  const colors = ['var(--primary)', 'var(--primary-soft)', 'var(--accent-peach)', 'var(--accent-mint)'];
  for (let i = 0; i < n; i++) {
    const p = el('span', { class: 'bloom-particle' });
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const dist = 24 + Math.random() * 18;
    p.style.left = `${x - 7}px`;
    p.style.top = `${y - 7}px`;
    p.style.position = 'fixed';
    p.style.zIndex = '60';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    p.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}

export function haptic(ms = 12) {
  if ('vibrate' in navigator) try { navigator.vibrate(ms); } catch {}
}

export function openSheet(content, { title } = {}) {
  const root = $('#sheet-root');
  if (!root) return null;
  clear(root);
  const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'sheet__grip', 'aria-hidden': 'true' }),
    title ? el('h2', { class: 'sheet__title' }, title) : null,
    typeof content === 'function' ? content() : content,
  ].filter(Boolean));
  const backdrop = el('div', { class: 'sheet-backdrop', onClick: closeSheet });
  root.appendChild(backdrop);
  root.appendChild(sheet);
  requestAnimationFrame(() => root.setAttribute('aria-hidden', 'false'));
  document.addEventListener('keydown', sheetEscHandler);
  return sheet;
}

function sheetEscHandler(e) { if (e.key === 'Escape') closeSheet(); }

export function closeSheet() {
  const root = $('#sheet-root');
  if (!root) return;
  root.setAttribute('aria-hidden', 'true');
  document.removeEventListener('keydown', sheetEscHandler);
  setTimeout(() => clear(root), 300);
}
