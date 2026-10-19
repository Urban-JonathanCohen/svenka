// Writing (Skriftlig färdighet): genre prompts with word count, timer,
// checklist and exam-style LLM feedback. Drafts autosave.
import { h, t, levelPill, backLink, spinner, toast } from '../core/ui.js';
import { loadJSON, PATHS } from '../core/content.js';
import { getSettings, effectiveLevel, hasLLM, recordResult, getProgress } from '../core/state.js';
import { storage } from '../core/storage.js';
import { askJSON } from '../core/llm.js';
import { EXAMS } from '../core/exams.js';

const MODULE = 'writing';

// Connectors used for the offline text-binding check.
const CONNECTORS = [
  'dessutom', 'däremot', 'eftersom', 'därför', 'trots att', 'trots det', 'å ena sidan', 'å andra sidan',
  'sammanfattningsvis', 'till exempel', 'för det första', 'för det andra', 'slutligen', 'alltså', 'medan',
  'emellertid', 'följaktligen', 'avslutningsvis', 'med andra ord', 'framför allt', 'vilket innebär',
  'samtidigt', 'i stället', 'på grund av', 'det vill säga', 'kort sagt', 'således', 'dock', 'nämligen', 'även om',
];

export async function render(root, [id]) {
  const data = await loadJSON(PATHS.writing);
  if (id) return renderTask(root, data.prompts.find((p) => p.id === id));
  renderList(root, data.prompts);
}

function renderList(root, prompts) {
  const level = effectiveLevel();
  const progress = getProgress(MODULE);
  const exam = getSettings().exam;
  const sorted = [...prompts].sort((a, b) =>
    (b.exams?.includes(exam) ? 1 : 0) - (a.exams?.includes(exam) ? 1 : 0));
  root.append(
    h('h1', {}, t('Skriftlig färdighet', 'Writing')),
    h('p', { class: 'muted' },
      `Välj en uppgift. Uppgifter som passar ditt mål (${EXAMS[exam].name}) visas först. Din nivå: ${level}.`),
    sorted.map((p) => h('a', { class: 'card link', href: `#/writing/${p.id}` },
      h('div', { class: 'row spread' }, h('h3', { style: { margin: 0 } }, p.title), levelPill(p.level)),
      h('p', { class: 'small muted', style: { margin: '4px 0 0' } },
        `${p.genre} · ${p.words[0]}–${p.words[1]} ord · ${p.minutes} min`,
        progress[p.id]?.estimatedLevel ? ` · senast bedömd ${progress[p.id].estimatedLevel}` : ''))),
  );
}

function renderTask(root, task) {
  if (!task) {
    root.append(backLink('#/writing'), h('p', {}, 'Uppgiften hittades inte.'));
    return;
  }
  const draftKey = `draft:${task.id}`;
  const area = h('textarea', { rows: 14, placeholder: 'Skriv din text här…', spellcheck: 'false' });
  area.value = storage.get(draftKey, '');
  const wordCount = h('span', { class: 'small' });
  const timerEl = h('span', { class: 'timer' });
  const timerBtn = h('button', { class: 'chip' });
  const feedbackEl = h('div');
  const connectorsEl = h('div', { class: 'small muted' });

  // --- timer ---
  let remaining = task.minutes * 60;
  let running = false;
  let interval = null;
  const fmt = (s) => `${s < 0 ? '−' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`;
  function drawTimer() {
    timerEl.textContent = fmt(remaining);
    timerEl.classList.toggle('over', remaining < 0);
    timerBtn.textContent = running ? 'Pausa' : remaining === task.minutes * 60 ? 'Starta timer' : 'Fortsätt';
  }
  timerBtn.onclick = () => {
    running = !running;
    clearInterval(interval);
    if (running) interval = setInterval(() => { remaining -= 1; drawTimer(); }, 1000);
    drawTimer();
  };
  drawTimer();

  // --- live stats ---
  function update() {
    const words = countWords(area.value);
    const [min, max] = task.words;
    wordCount.textContent = `${words} ord (mål ${min}–${max})`;
    wordCount.style.color = words < min ? 'var(--muted)' : words > max ? 'var(--bad)' : 'var(--ok)';
    const used = usedConnectors(area.value);
    connectorsEl.textContent = used.length
      ? `Sambandsord: ${used.join(', ')}`
      : 'Inga sambandsord hittade ännu (t.ex. dessutom, däremot, därför, sammanfattningsvis).';
    storage.set(draftKey, area.value);
  }
  area.addEventListener('input', update);
  update();

  const checklist = h('div', { class: 'checklist' },
    task.checklist.map((item) => h('label', {}, h('input', { type: 'checkbox' }), h('span', {}, item))));

  const feedbackBtn = h('button', { class: 'primary', onclick: getFeedback }, hasLLM() ? 'Få feedback' : 'Analysera (utan AI)');

  async function getFeedback() {
    const text = area.value.trim();
    if (countWords(text) < 20) return toast('Skriv minst 20 ord först.');
    if (!hasLLM()) {
      feedbackEl.replaceChildren(offlineFeedback(text, task));
      return;
    }
    feedbackBtn.disabled = true;
    feedbackEl.replaceChildren(h('div', { class: 'card' }, spinner('Bedömer din text… (kan ta en halv minut)')));
    try {
      const fb = await llmFeedback(text, task);
      recordResult(MODULE, task.id, { score: 0, max: 0, extra: { estimatedLevel: fb.estimatedLevel } });
      feedbackEl.replaceChildren(renderFeedback(fb));
    } catch (err) {
      feedbackEl.replaceChildren(h('div', { class: 'card feedback bad' }, err.message), offlineFeedback(text, task));
    } finally {
      feedbackBtn.disabled = false;
    }
  }

  root.append(
    backLink('#/writing'),
    h('div', { class: 'row spread', style: { marginTop: '8px' } }, h('h1', { style: { margin: 0 } }, task.title), levelPill(task.level)),
    h('p', { class: 'small muted' }, `${task.genre} · ${task.register === 'formal' ? 'formellt' : 'informellt'} register`),
    h('div', { class: 'card' },
      h('p', {}, task.instructions),
      task.points?.length ? h('ul', {}, task.points.map((p) => h('li', {}, p))) : null,
      task.tip ? h('p', { class: 'small muted', style: { margin: 0 } }, `Tips: ${task.tip}`) : null),
    h('div', { class: 'writing-tools row spread' }, wordCount, h('span', { class: 'row' }, timerEl, timerBtn)),
    area,
    connectorsEl,
    h('details', { class: 'card', style: { marginTop: '12px' } },
      h('summary', {}, t('Checklista', 'Checklist')), h('div', { style: { marginTop: '8px' } }, checklist)),
    h('div', { class: 'row' }, feedbackBtn,
      h('button', { class: 'ghost', onclick: () => { if (confirm('Radera texten?')) { area.value = ''; update(); } } }, 'Rensa')),
    feedbackEl,
  );
  return () => clearInterval(interval);
}

export function countWords(text) {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
}

function usedConnectors(text) {
  const lower = ` ${text.toLowerCase().replace(/[^\p{L}\s]/gu, ' ')} `;
  return CONNECTORS.filter((c) => lower.includes(` ${c} `));
}

function offlineFeedback(text, task) {
  const words = countWords(text);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim()).length || 1;
  const paragraphsCount = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const unique = new Set((text.toLowerCase().match(/\p{L}+/gu) || [])).size;
  const connectors = usedConnectors(text);
  const tips = [];
  if (words < task.words[0]) tips.push(`Texten är kortare än målet (${task.words[0]} ord).`);
  if (paragraphsCount < 3) tips.push('Dela in texten i fler stycken: inledning, huvuddel och avslutning.');
  if (connectors.length < 4) tips.push('Använd fler sambandsord för att binda ihop texten.');
  if (words / sentences > 28) tips.push('Många långa meningar – variera meningslängden.');
  if (task.register === 'formal' && /\b(hej|hejsan|tjena|kram)\b/i.test(text)) tips.push('Informella hälsningar passar inte i en formell text.');
  return h('div', { class: 'card' },
    h('h2', {}, 'Snabbanalys'),
    h('ul', {},
      h('li', {}, `${words} ord, ${sentences} meningar, ${paragraphsCount} stycken`),
      h('li', {}, `Genomsnittlig meningslängd: ${(words / sentences).toFixed(1)} ord`),
      h('li', {}, `Variation i ordförrådet: ${Math.round((unique / Math.max(words, 1)) * 100)} % unika ord`),
      h('li', {}, `Sambandsord (${connectors.length}): ${connectors.join(', ') || '–'}`)),
    tips.length ? h('div', {}, h('strong', {}, 'Att tänka på:'), h('ul', {}, tips.map((x) => h('li', {}, x)))) : h('p', {}, 'Bra struktur!'),
    h('p', { class: 'small muted', style: { margin: 0 } }, 'Lägg till en API-nyckel under Inställningar för en fullständig bedömning med rättelser.'));
}

async function llmFeedback(text, task) {
  const s = getSettings();
  const exam = EXAMS[s.exam];
  return askJSON({
    system:
      'Du är en erfaren examinator i svenska som andraspråk. Du ger tydlig, konkret och uppmuntrande feedback på svenska. ' +
      `Bedömningsram: ${exam.rubric} Elevens mål: ${exam.name}. Elevens nuvarande nivå: ${effectiveLevel()}.`,
    prompt:
      `UPPGIFT (${task.genre}, ${task.register === 'formal' ? 'formellt' : 'informellt'} register, ${task.words[0]}–${task.words[1]} ord):\n` +
      `${task.instructions}\n${(task.points || []).map((p) => '- ' + p).join('\n')}\n\nELEVENS TEXT:\n${text}\n\n` +
      'Returnera JSON med exakt dessa fält:\n' +
      '{\n' +
      '  "estimatedLevel": "A2|B1|B2|C1|C2",\n' +
      '  "grade": "betyg enligt bedömningsramen om den använder betyg, annars tom sträng",\n' +
      '  "summary": "2–3 meningar helhetsomdöme",\n' +
      '  "taskFulfilment": "hur väl uppgiften och genren är lösta",\n' +
      '  "grammar": [{"original": "exakt felaktig fras ur texten", "correction": "rättad fras", "explanation": "kort regel"}],\n' +
      '  "vocabulary": {"comment": "om ordförrådets bredd och precision", "suggestions": [{"instead": "ord i texten", "try": "mer precist/avancerat alternativ"}]},\n' +
      '  "coherence": "om struktur, styckeindelning och sambandsord",\n' +
      '  "register": "om ton och anpassning till mottagaren",\n' +
      '  "rewrittenParagraph": {"original": "ett stycke ur texten", "rewritten": "samma stycke omskrivet på målnivån"},\n' +
      '  "nextSteps": ["2–3 konkreta saker att öva på"]\n' +
      '}\nTa med de viktigaste grammatikfelen (högst 12).',
  });
}

function renderFeedback(fb) {
  const section = (title, body) => body ? h('div', { style: { marginTop: '12px' } }, h('h3', {}, title), body) : null;
  return h('div', { class: 'card' },
    h('div', { class: 'row spread' },
      h('h2', { style: { margin: 0 } }, 'Feedback'),
      h('span', { class: 'row' },
        fb.grade ? h('span', { class: 'pill' }, `Betyg ${fb.grade}`) : null,
        fb.estimatedLevel ? h('span', { class: 'pill level' }, fb.estimatedLevel) : null)),
    h('p', { style: { marginTop: '8px' } }, fb.summary),
    section('Uppgiften', fb.taskFulfilment && h('p', {}, fb.taskFulfilment)),
    section(`Grammatik (${fb.grammar?.length || 0})`, fb.grammar?.length ? h('div', {},
      fb.grammar.map((g) => h('div', { class: 'correction' },
        h('div', {}, h('del', {}, g.original), ' → ', h('ins', {}, g.correction)),
        h('div', { class: 'small muted' }, g.explanation)))) : h('p', {}, 'Inga större grammatikfel hittades.')),
    section('Ordförråd', fb.vocabulary && h('div', {},
      h('p', {}, fb.vocabulary.comment),
      fb.vocabulary.suggestions?.length ? h('ul', {}, fb.vocabulary.suggestions.map((v) =>
        h('li', {}, h('span', { class: 'muted' }, v.instead), ' → ', h('strong', {}, v.try)))) : null)),
    section('Textbindning', fb.coherence && h('p', {}, fb.coherence)),
    section('Register', fb.register && h('p', {}, fb.register)),
    section('Omskrivet stycke', fb.rewrittenParagraph && h('div', {},
      h('p', { class: 'small muted' }, fb.rewrittenParagraph.original),
      h('p', { class: 'reading-text' }, fb.rewrittenParagraph.rewritten))),
    section('Nästa steg', fb.nextSteps?.length && h('ul', {}, fb.nextSteps.map((x) => h('li', {}, x)))),
  );
}
