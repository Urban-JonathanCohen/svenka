// Reading (Läsförståelse): level-filtered texts with summary and questions.
import { h, t, paragraphs, levelPill, backLink } from '../core/ui.js';
import { loadCollection, PATHS } from '../core/content.js';
import { effectiveLevel, getProgress, recordResult } from '../core/state.js';
import { renderQuestionList } from '../core/quiz.js';
import { LEVELS } from '../core/exams.js';

const MODULE = 'reading';

export async function render(root, [id]) {
  const { items } = await loadCollection(PATHS.reading);
  if (id) return renderText(root, items.find((x) => x.id === id));
  renderList(root, items);
}

/** Shared list view, also used by Listening. */
export function renderExerciseList(root, items, { module, title, en, intro }) {
  const progress = getProgress(module);
  let filter = effectiveLevel();

  const listEl = h('div');
  const chips = h('div', { class: 'row', style: { marginBottom: '12px' } });

  function draw() {
    chips.replaceChildren(...['Alla', ...LEVELS].map((l) =>
      h('button', { class: 'chip', 'aria-pressed': String(filter === l), onclick: () => { filter = l; draw(); } }, l)));
    const shown = items.filter((x) => filter === 'Alla' || x.level === filter);
    listEl.replaceChildren(
      ...(shown.length ? shown : items).map((x) => {
        const p = progress[x.id];
        return h('a', { class: 'card link', href: `#/${module}/${x.id}` },
          h('div', { class: 'row spread' }, h('h3', { style: { margin: 0 } }, x.title), levelPill(x.level)),
          h('p', { class: 'small muted', style: { margin: '4px 0 0' } }, x.topic,
            p ? ` · bästa resultat ${Math.round(p.best * 100)} %` : ''));
      }),
      !shown.length ? h('p', { class: 'small muted' }, `Inga övningar på nivå ${filter} ännu – visar alla.`) : null,
    );
  }
  draw();
  root.append(h('h1', {}, t(title, en)), h('p', { class: 'muted' }, intro), chips, listEl);
}

function renderList(root, items) {
  renderExerciseList(root, items, {
    module: MODULE,
    title: 'Läsförståelse',
    en: 'Reading',
    intro: 'Läs texten, svara på frågorna och få direkt återkoppling. Du kan läsa sammanfattningen först eller efteråt.',
  });
}

function renderText(root, item) {
  if (!item) {
    root.append(backLink('#/reading'), h('p', {}, 'Texten hittades inte.'));
    return;
  }
  const result = h('div');
  const summary = h('details', { class: 'card' },
    h('summary', {}, t('Sammanfattning', 'Summary')),
    h('p', { style: { marginTop: '8px' } }, item.summary));

  root.append(
    backLink('#/reading'),
    h('div', { class: 'row spread', style: { marginTop: '8px' } }, h('h1', { style: { margin: 0 } }, item.title), levelPill(item.level)),
    h('p', { class: 'small muted' }, item.topic, item.source ? ` · ${item.source}` : ''),
    summary,
    h('article', { class: 'card reading-text' }, paragraphs(item.text)),
    item.glossary?.length ? h('details', { class: 'card' },
      h('summary', {}, t('Ordlista', 'Glossary')),
      h('ul', {}, item.glossary.map((g) => h('li', {}, h('strong', {}, g.sv), ' – ', g.en)))) : null,
    h('section', { class: 'card' },
      h('h2', {}, 'Frågor'),
      renderQuestionList(item.questions, {
        context: item.text,
        onComplete: ({ score, max }) => {
          recordResult(MODULE, item.id, { score, max });
          result.replaceChildren(h('div', { class: 'card' },
            h('h2', {}, `Resultat: ${score.toFixed(1).replace('.0', '')} av ${max}`),
            h('a', { href: '#/reading', class: 'btn' }, 'Fler texter')));
        },
      })),
    result,
  );
}
