// Shared question renderer for Reading, Listening, Civics and the Level check.
// Question types (see docs/SCHEMA.md):
//   mc   { type, q, options[], answer: index, explanation }
//   tf   { type, q, answer: boolean, explanation }
//   open { type, q, modelAnswer, keywords[], explanation? }

import { h, shuffle } from './ui.js';
import { hasLLM, getSettings } from './state.js';
import { askJSON } from './llm.js';
import { EXAMS } from './exams.js';

/**
 * Render one question.
 * @param {object} q
 * @param {{onAnswered?: (score:number, detail:object)=>void, context?: string, reveal?: boolean, number?: number}} opts
 *   reveal=false hides right/wrong (exam mode); the caller reveals later.
 */
export function renderQuestion(q, { onAnswered = () => {}, context = '', reveal = true, number } = {}) {
  q = shuffleOptions(q);
  const prefix = number ? `${number}. ` : '';
  const wrap = h('div', { class: 'question' });
  if (q.type === 'mc' || q.type === 'tf') {
    const options = q.type === 'tf' ? ['Sant', 'Falskt'] : q.options;
    const correctIndex = q.type === 'tf' ? (q.answer ? 0 : 1) : q.answer;
    const buttons = options.map((label, i) =>
      h('button', { type: 'button', onclick: () => choose(i) }, label));
    const fb = h('div');
    wrap.append(
      h('div', { class: 'prompt' }, prefix, q.type === 'tf' ? `Sant eller falskt: ${q.q}` : q.q),
      h('div', { class: 'options' }, buttons),
      fb,
    );

    function choose(i) {
      buttons.forEach((b) => (b.disabled = true));
      const correct = i === correctIndex;
      if (reveal) {
        buttons[correctIndex].classList.add('correct');
        if (!correct) buttons[i].classList.add('wrong');
        fb.replaceChildren(feedback(correct, q.explanation));
      } else {
        buttons[i].setAttribute('aria-pressed', 'true');
        buttons[i].classList.add('chosen');
      }
      wrap.revealAnswer = () => {
        buttons[correctIndex].classList.add('correct');
        if (!correct) buttons[i].classList.add('wrong');
        fb.replaceChildren(feedback(correct, q.explanation));
      };
      onAnswered(correct ? 1 : 0, { chosen: i, correct });
    }
    return wrap;
  }

  if (q.type === 'open') {
    const area = h('textarea', { rows: 4, placeholder: 'Skriv ditt svar här…' });
    const fb = h('div');
    const btn = h('button', { type: 'button', class: 'primary', onclick: grade }, 'Rätta');
    wrap.append(h('div', { class: 'prompt' }, prefix, q.q), area, h('div', { class: 'row', style: { marginTop: '8px' } }, btn), fb);

    async function grade() {
      const answer = area.value.trim();
      if (!answer) return;
      btn.disabled = true;
      area.readOnly = true;
      let result;
      if (hasLLM()) {
        fb.replaceChildren(h('div', { class: 'feedback neutral' }, 'Bedömer ditt svar…'));
        try {
          result = await gradeOpenWithLLM(q, answer, context);
        } catch (err) {
          result = { ...gradeOpenOffline(q, answer), note: `AI-bedömning misslyckades (${err.message}). Visar nyckelordsbedömning.` };
        }
      } else {
        result = gradeOpenOffline(q, answer);
      }
      fb.replaceChildren(
        h('div', { class: `feedback ${result.score >= 0.5 ? 'ok' : 'bad'}` },
          h('div', {}, h('strong', {}, `Poäng: ${Math.round(result.score * 100)} %`), ' — ', result.feedback),
          result.note ? h('div', { class: 'small muted' }, result.note) : null,
          h('div', { class: 'small', style: { marginTop: '6px' } }, h('strong', {}, 'Modellsvar: '), q.modelAnswer)),
      );
      onAnswered(result.score, { answer, ...result });
    }
    return wrap;
  }

  return h('div', { class: 'question muted' }, `Okänd frågetyp: ${q.type}`);
}

/** Render a list of questions and report a total when all are answered. */
export function renderQuestionList(questions, { onComplete = () => {}, context = '' } = {}) {
  const scores = new Array(questions.length).fill(null);
  const list = h('div');
  questions.forEach((q, i) => {
    list.append(renderQuestion(q, {
      context,
      number: i + 1,
      onAnswered: (score) => {
        scores[i] = score;
        if (scores.every((s) => s !== null)) {
          const total = scores.reduce((a, b) => a + b, 0);
          onComplete({ score: total, max: questions.length });
        }
      },
    }));
  });
  return list;
}

/** Shuffle mc options, keeping `answer` pointing at the right one. Set `keepOrder: true` to opt out. */
function shuffleOptions(q) {
  if (q.type !== 'mc' || q.keepOrder) return q;
  const order = shuffle(q.options.map((_, i) => i));
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

function feedback(correct, explanation) {
  return h('div', { class: `feedback ${correct ? 'ok' : 'bad'}` },
    h('strong', {}, correct ? 'Rätt! ' : 'Fel. '), explanation || '');
}

// --- Open-answer grading ---------------------------------------------------

const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\s]/gu, ' ');

export function gradeOpenOffline(q, answer) {
  const text = ` ${norm(answer)} `;
  const keywords = q.keywords || [];
  const hits = keywords.filter((k) => text.includes(norm(k).trim()));
  const needed = Math.max(1, Math.ceil(keywords.length / 2));
  const score = keywords.length ? Math.min(1, hits.length / needed) : 0.5;
  const feedbackText = keywords.length
    ? `Du nämnde ${hits.length} av ${keywords.length} nyckelbegrepp${hits.length ? ` (${hits.join(', ')})` : ''}. Jämför med modellsvaret.`
    : 'Jämför ditt svar med modellsvaret.';
  return { score, feedback: feedbackText, note: 'Utan API-nyckel bedöms svaret med nyckelord.' };
}

async function gradeOpenWithLLM(q, answer, context) {
  const exam = EXAMS[getSettings().exam];
  const res = await askJSON({
    system:
      'Du är en erfaren och vänlig examinator i svenska som andraspråk. Bedöm elevens svar på en förståelsefråga. ' +
      'Bedöm innehållet (förståelse av texten), inte stavning, om inte frågan gäller språket. Var generös med ' +
      'formuleringar som visar rätt förståelse. ' + exam.rubric,
    prompt:
      `TEXT:\n${context || '(ingen text)'}\n\nFRÅGA: ${q.q}\nMODELLSVAR: ${q.modelAnswer}\n\nELEVENS SVAR: ${answer}\n\n` +
      'Returnera JSON: {"score": tal mellan 0 och 1, "feedback": "1–3 meningar på svenska om vad som var bra och vad som saknas"}',
    maxTokens: 2000,
  });
  const score = Math.max(0, Math.min(1, Number(res.score) || 0));
  return { score, feedback: String(res.feedback || '') };
}
