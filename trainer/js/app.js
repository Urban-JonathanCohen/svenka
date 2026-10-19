// App shell: hash router, tab navigation, level badge, service worker.
// Each tab is an ES module in ./modules exporting `render(root, params)`, which
// may return a cleanup function that runs when the user navigates away.

import { h } from './core/ui.js';
import { getSettings, effectiveLevel, onSettingsChange } from './core/state.js';

export const MODULES = [
  { id: 'home', label: 'Hem', en: 'Home', load: () => import('./modules/home.js') },
  { id: 'level', label: 'Nivåtest', en: 'Level check', load: () => import('./modules/level.js') },
  { id: 'reading', label: 'Läsa', en: 'Reading', load: () => import('./modules/reading.js') },
  { id: 'listening', label: 'Lyssna', en: 'Listening', load: () => import('./modules/listening.js') },
  { id: 'writing', label: 'Skriva', en: 'Writing', load: () => import('./modules/writing.js') },
  { id: 'vocab', label: 'Ordförråd', en: 'Vocabulary', load: () => import('./modules/vocab.js') },
  { id: 'civics', label: 'Sverigekunskap', en: 'Civics', load: () => import('./modules/civics.js') },
  { id: 'picture', label: 'Bild', en: 'Pictures', load: () => import('./modules/picture.js') },
  { id: 'conversation', label: 'Tala', en: 'Speaking', load: () => import('./modules/conversation.js') },
  { id: 'settings', label: 'Inställningar', en: 'Settings', load: () => import('./modules/settings.js') },
];

const view = document.getElementById('view');
const tabs = document.getElementById('tabs');
let cleanup = null;

function renderTabs(activeId) {
  tabs.replaceChildren(...MODULES.map((m) =>
    h('a', { href: `#/${m.id === 'home' ? '' : m.id}`, 'aria-current': m.id === activeId ? 'page' : null }, m.label)));
  tabs.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function renderBadge() {
  const s = getSettings();
  const badge = document.getElementById('level-badge');
  badge.textContent = s.level || s.levelOverride ? `Nivå ${effectiveLevel()}` : '';
  document.body.classList.toggle('hide-en', !s.showEnglish);
}

async function route() {
  const [id = 'home', ...params] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const mod = MODULES.find((m) => m.id === id) || MODULES[0];
  renderTabs(mod.id);
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  view.replaceChildren(h('p', { class: 'muted' }, 'Laddar…'));
  try {
    const { render } = await mod.load();
    view.replaceChildren();
    cleanup = await render(view, params);
  } catch (err) {
    console.error(err);
    view.replaceChildren(h('div', { class: 'card' },
      h('h2', {}, 'Något gick fel'),
      h('p', { class: 'muted' }, err.message)));
  }
  document.title = mod.id === 'home' ? 'Svenka – svensktränare' : `${mod.label} · Svenka`;
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
onSettingsChange(renderBadge);
renderBadge();
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
}
