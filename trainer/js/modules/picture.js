// Picture description (Bildbeskrivning) – planned for the next iteration.
import { h, t } from '../core/ui.js';

export function render(root) {
  root.append(
    h('h1', {}, t('Bildbeskrivning', 'Picture description')),
    h('div', { class: 'card' },
      h('p', {}, 'Kommer snart. Planen:'),
      h('ul', {},
        h('li', {}, 'Öppet licensierade bilder från Wikimedia Commons, med upphovsuppgifter.'),
        h('li', {}, 'Läge 1: namnge markerade föremål i bilden.'),
        h('li', {}, 'Läge 2: beskriv bilden med 3–5 meningar.'),
        h('li', {}, 'Generös AI-bedömning (alla rimliga ord räknas) och en lista med användbara ord du missade.')),
      h('p', { class: 'small muted', style: { margin: 0 } }, 'Innehållsformatet finns redan beskrivet i docs/SCHEMA.md.')),
  );
}
