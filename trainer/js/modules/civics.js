// Sverigekunskap: civics practice for the Swedish citizenship test.
// Chapters mirror UHR's official study material "Sverige i fokus".
// Content lives in /shared/content/civics so other apps (Kung Bulle) can reuse it.
import { h, t, shuffle, progressBar, backLink } from '../core/ui.js';
import { loadJSON, PATHS } from '../core/content.js';
import { storage } from '../core/storage.js';
import { renderQuestion } from '../core/quiz.js';

const ANSWERS_KEY = 'civics:answers';
const EXAM_SIZE = 20;

export async function render(root, [mode, chapterId]) {
  const index = await loadJSON(`${PATHS.civics}/index.json`);
  const files = await Promise.all(index.files.map((f) => loadJSON(`${PATHS.civics}/${f}`)));
  const all = files.flatMap((f) => f.questions);
  const chapters = index.chapters
    .map((c) => ({ ...c, questions: all.filter((q) => q.chapter === c.id) }))
    .filter((c) => c.questions.length);

  if (mode === 'practice') {
    const ch = chapters.find((c) => c.id === chapterId);
    return runSession(root, ch ? ch.questions : chapters.flatMap((c) => c.questions), {
      title: ch ? ch.title : 'Alla kapitel', reveal: true,
    });
  }
  if (mode === 'exam') {
    const pool = shuffle(chapters.flatMap((c) => c.questions)).slice(0, EXAM_SIZE);
    return runSession(root, pool, { title: 'Provläge', reveal: false });
  }
  renderOverview(root, index, chapters);
}

function renderOverview(root, index, chapters) {
  const answers = storage.get(ANSWERS_KEY, {});
  const total = chapters.reduce((n, c) => n + c.questions.length, 0);
  root.append(
    h('h1', {}, t('Sverigekunskap', 'Knowledge of Sweden')),
    h('p', { class: 'muted' },
      'Öva inför samhällskunskapsprovet för svenskt medborgarskap. Kapitlen följer UHR:s utbildningsmaterial ',
      h('a', { href: index.source.url, target: '_blank', rel: 'noopener' }, `”${index.source.title}”`), '.'),
    h('div', { class: 'card' },
      h('h2', {}, 'Om provet'),
      h('ul', { class: 'small' }, index.examFacts.map((f) => h('li', {}, f))),
      h('p', { class: 'small muted', style: { margin: 0 } }, index.disclaimer)),
    h('div', { class: 'row', style: { marginBottom: '12px' } },
      h('a', { class: 'btn primary', href: '#/civics/exam' }, `Provläge (${Math.min(EXAM_SIZE, total)} frågor)`),
      h('a', { class: 'btn', href: '#/civics/practice/all' }, 'Öva alla')),
    chapters.map((c) => {
      const known = c.questions.filter((q) => answers[q.id]?.last === true).length;
      const frac = c.questions.length ? known / c.questions.length : 0;
      return h('a', { class: 'card link', href: `#/civics/practice/${c.id}` },
        h('div', { class: 'row spread' },
          h('h3', { style: { margin: 0 } }, `${c.number}. ${c.title}`),
          h('span', { class: 'small muted' }, `${known}/${c.questions.length}`)),
        h('p', { class: 'small muted', style: { margin: '4px 0 8px' } }, c.en),
        progressBar(frac));
    }),
  );
}

function runSession(root, questions, { title, reveal }) {
  const items = shuffle(questions); // option order is shuffled by renderQuestion
  const answers = storage.get(ANSWERS_KEY, {});
  const rendered = [];
  let i = 0;
  let correct = 0;
  const started = Date.now();
  const stage = h('div');
  const header = h('div', { class: 'row spread small muted' });
  root.append(backLink('#/civics'), h('h1', { style: { marginTop: '8px' } }, title), header, stage);
  ask();

  function ask() {
    header.replaceChildren(h('span', {}, `Fråga ${i + 1} av ${items.length}`), h('span', {}, reveal ? `${correct} rätt` : ''));
    const q = items[i];
    let next;
    const el = renderQuestion(q, {
      reveal,
      onAnswered: (score) => {
        correct += score;
        const prev = answers[q.id] || { right: 0, wrong: 0 };
        answers[q.id] = { right: prev.right + score, wrong: prev.wrong + (1 - score), last: score === 1 };
        storage.set(ANSWERS_KEY, answers);
        next.disabled = false;
        if (!reveal) setTimeout(() => next.click(), 250);
        else next.focus();
      },
    });
    rendered.push({ q, el });
    next = h('button', { class: 'primary', disabled: true, onclick: () => { i += 1; i < items.length ? ask() : finish(); } },
      i + 1 < items.length ? 'Nästa' : 'Se resultat');
    stage.replaceChildren(progressBar(i / items.length), h('div', { class: 'card', style: { marginTop: '12px' } }, el), next);
  }

  function finish() {
    const mins = Math.round((Date.now() - started) / 60000);
    const pct = Math.round((correct / items.length) * 100);
    stage.replaceChildren(
      h('div', { class: 'card' },
        h('h2', {}, `${correct} av ${items.length} rätt (${pct} %)`),
        h('p', { class: 'small muted' }, `Tid: ${mins} min. Gränsen för godkänt är inte fastställd ännu – sikta på minst 80 %.`),
        h('div', { class: 'row' },
          h('a', { class: 'btn primary', href: '#/civics' }, 'Till översikten'),
          h('button', { onclick: () => location.reload() }, 'Gör om'))),
      !reveal ? h('div', { class: 'card' }, h('h2', {}, 'Genomgång'), rendered.map(({ el }) => { el.revealAnswer?.(); return el; })) : null,
    );
    header.replaceChildren();
  }
}
