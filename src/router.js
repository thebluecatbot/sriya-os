// Hash routing — no build step, no framework.
// Routes register a render function: (params, host) => void.

const routes = new Map();
let _host = null;
let _current = null;
let _onRoute = null;

export function registerRoute(path, render, { title } = {}) {
  routes.set(path, { render, title });
}

export function setRouteHost(host) { _host = host; }
export function onRoute(fn) { _onRoute = fn; }

function parseHash() {
  const hash = location.hash.replace(/^#/, '') || '/today';
  const [path, query = ''] = hash.split('?');
  const params = new URLSearchParams(query);
  return { path, params };
}

export function navigate(path) {
  if (location.hash === `#${path}`) renderCurrent();
  else location.hash = path;
}

function renderCurrent() {
  if (!_host) return;
  const { path, params } = parseHash();
  const match = routes.get(path) || routes.get('/today');
  _current = path;
  while (_host.firstChild) _host.removeChild(_host.firstChild);
  _host.scrollTop = 0;
  document.title = match.title ? `${match.title} · sriya` : 'sriya';
  try { match.render(params, _host); }
  catch (err) { console.error('route render failed', err); }
  if (_onRoute) _onRoute(path);
}

export function startRouter() {
  window.addEventListener('hashchange', renderCurrent);
  renderCurrent();
}

export function currentPath() { return _current; }
