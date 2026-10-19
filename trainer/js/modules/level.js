// Level check: an adaptive staircase. Questions are asked in blocks of
// BLOCK per level, starting at A2. Passing a block (≥ PASS correct) moves you
// up; failing stops the test. The estimate is the highest level passed.

import { h, t, shuffle, progressBar } from '../core/ui.js';
import { loadJSON, PATHS } from '../core/content.js';
import { saveSettings, getSettings } from '../core/state.js';
import { storage } from '../core/storage.js';
import { renderQuestion } from '../core/quiz.js';
import { LEVELS } from '../core/exams.js';

const BLOCK = 4;
const PASS = 3;

const DESCRIPTIONS = {
  'under A2': 'Du är i början. Börja med enkla texter och vardagsord.',
  A2: 'Du klarar vardagliga situationer och enkla texter. Bygg ordförråd och grundgrammatik.',
  B1: 'Du förstår huvudinnehållet i tydliga texter om bekanta ämnen. Fokusera på bisatser, ordföljd och sambandsord.',
  B2: 'Du förstår komplexa texter och kan uttrycka dig flytande. Arbeta med nyanser, register och idiomatiska uttryck.',
  C1: 'Du behärskar svenskan väl. Finslipa precision, stil och akademiskt ordförråd.',
};

export async function render(root) {
  const bank = await loadJSON(PATHS.level);
  const last = storage.get('level-history', []).at(-1);

  root.append(
    h('h1', {}, t('Nivåtest', 'Level check')),
    h('p', { class: 'muted' },
      `Frågorna blir svårare så länge du svarar rätt. Testet tar 4–16 frågor. Svara utan hjälpmedel – gissa hellre än att hoppa över.`),
    last ? h('p', { class: 'small muted' }, `Senaste resultat: ${last.level} (${new Date(last.at).toLocaleDateString('sv-SE')})`) : null,
    h('button', { class: 'primary', onclick: () => start(root, bank) }, 'Starta testet'),
  );
}

function start(root, bank) {
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, shuffle(bank.questions.filter((q) => q.level === l))]));
  let levelIdx = 0;
  let block = [];
  let asked = 0;
  let passed = null;
  const log = [];

  nextBlock();

  function nextBlock() {
    block = byLevel[LEVELS[levelIdx]].slice(0, BLOCK);
    askNext(0, 0);
  }

  function askNext(i, correct) {
    if (i === block.length) {
      if (correct >= PASS) {
        passed = LEVELS[levelIdx];
        if (levelIdx < LEVELS.length - 1) {
          levelIdx += 1;
          return nextBlock();
        }
      }
      return finish();
    }
    const q = block[i];
    asked += 1;
    const maxQuestions = LEVELS.length * BLOCK;
    let next;
    root.replaceChildren(
      h('div', { class: 'row spread small muted' },
        h('span', {}, `Fråga ${asked}`),
        h('span', {}, `Nivå just nu: ${LEVELS[levelIdx]}`)),
      progressBar(asked / maxQuestions),
      h('div', { class: 'card', style: { marginTop: '12px' } },
        renderQuestion(q, {
          onAnswered: (score) => {
            log.push({ id: q.id, level: q.level, correct: score === 1 });
            next.disabled = false;
            next.focus();
            next.onclick = () => askNext(i + 1, correct + score);
          },
        })),
      next = h('button', { class: 'primary', disabled: true }, 'Nästa'),
    );
  }

  function finish() {
    const level = passed || 'under A2';
    const stored = passed || 'A2';
    saveSettings({ level: stored, levelOverride: null });
    const history = storage.get('level-history', []);
    history.push({ level, at: new Date().toISOString(), answers: log });
    storage.set('level-history', history.slice(-20));
    const right = log.filter((l) => l.correct).length;

    root.replaceChildren(
      h('h1', {}, 'Resultat'),
      h('div', { class: 'card' },
        h('div', { class: 'small muted' }, 'Uppskattad nivå'),
        h('div', { style: { fontSize: '2.4rem', fontWeight: 700 } }, level),
        h('p', {}, DESCRIPTIONS[level]),
        h('p', { class: 'small muted' }, `${right} av ${log.length} rätt. Alla moduler använder nu nivå ${stored} som standard – du kan ändra det under Inställningar.`),
        getSettings().exam === 'c1' && level !== 'C1' ? h('p', { class: 'small' }, 'Målet är C1. Läs- och skrivövningarna på nivån ovanför din är bra utmaningar.') : null),
      h('div', { class: 'row' },
        h('a', { class: 'btn primary', href: '#/reading' }, 'Till läsförståelse'),
        h('button', { onclick: () => start(root, bank) }, 'Gör om testet')),
    );
  }
}
