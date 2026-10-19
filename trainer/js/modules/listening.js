// Listening (Hörförståelse): speechSynthesis reads a dialogue or monologue
// with a sv-SE voice. The transcript stays hidden until every question is answered.
import { h, t, levelPill, backLink } from '../core/ui.js';
import { loadCollection, PATHS } from '../core/content.js';
import { getSettings, saveSettings, recordResult } from '../core/state.js';
import { renderQuestionList } from '../core/quiz.js';
import { renderExerciseList } from './reading.js';

const MODULE = 'listening';

export async function render(root, [id]) {
  const { items } = await loadCollection(PATHS.listening);
  if (!('speechSynthesis' in window)) {
    root.append(h('div', { class: 'card' }, 'Din webbläsare saknar talsyntes (speechSynthesis). Prova Chrome, Edge eller Safari.'));
    return;
  }
  if (!id) {
    renderExerciseList(root, items, {
      module: MODULE,
      title: 'Hörförståelse',
      en: 'Listening',
      intro: 'Lyssna på dialogen eller monologen och svara på frågorna. Texten visas när du har svarat.',
    });
    return;
  }
  return renderItem(root, items.find((x) => x.id === id));
}

export async function svVoices() {
  const pick = () => speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('sv'));
  let voices = pick();
  if (voices.length) return voices;
  await new Promise((resolve) => {
    speechSynthesis.addEventListener('voiceschanged', resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  return pick();
}

function renderItem(root, item) {
  if (!item) {
    root.append(backLink('#/listening'), h('p', {}, 'Övningen hittades inte.'));
    return;
  }
  const settings = getSettings();
  const status = h('span', { class: 'small muted' });
  const transcript = h('div', { class: 'card', hidden: true },
    h('h2', {}, t('Transkription', 'Transcript')),
    item.segments.map((s) => h('p', {}, s.speaker ? h('strong', {}, `${s.speaker}: `) : null, s.text)));
  const rateLabel = h('span', {}, `${settings.ttsRate.toFixed(2)}×`);
  const rate = h('input', {
    type: 'range', min: '0.5', max: '1.3', step: '0.05', value: String(settings.ttsRate),
    oninput: (e) => { rateLabel.textContent = `${Number(e.target.value).toFixed(2)}×`; },
    onchange: (e) => saveSettings({ ttsRate: Number(e.target.value) }),
  });
  const result = h('div');

  async function play() {
    speechSynthesis.cancel();
    const voices = await svVoices();
    if (!voices.length) status.textContent = 'Ingen svensk röst hittades – installera en svensk röst i systemet för bästa resultat.';
    const preferred = voices.find((v) => v.name === getSettings().ttsVoice);
    // Alternate voices (or pitch) between speakers so dialogues are easier to follow.
    const speakers = [...new Set(item.segments.map((s) => s.speaker || ''))];
    item.segments.forEach((seg, i) => {
      const u = new SpeechSynthesisUtterance(seg.text);
      u.lang = 'sv-SE';
      const si = speakers.indexOf(seg.speaker || '');
      u.voice = (si === 0 && preferred) || voices[si % Math.max(voices.length, 1)] || null;
      u.pitch = voices.length > 1 ? 1 : si % 2 ? 0.8 : 1.1;
      u.rate = Number(rate.value);
      if (i === 0) u.onstart = () => (status.textContent = 'Spelar…');
      if (i === item.segments.length - 1) u.onend = () => (status.textContent = 'Klart. Du kan lyssna igen.');
      speechSynthesis.speak(u);
    });
  }

  root.append(
    backLink('#/listening'),
    h('div', { class: 'row spread', style: { marginTop: '8px' } }, h('h1', { style: { margin: 0 } }, item.title), levelPill(item.level)),
    h('p', { class: 'small muted' }, item.topic, ' · ', item.kind === 'dialog' ? 'Dialog' : 'Monolog'),
    item.situation ? h('p', {}, item.situation) : null,
    h('div', { class: 'card stack' },
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: play }, '▶ Spela upp'),
        h('button', { onclick: () => { speechSynthesis.cancel(); status.textContent = 'Stoppad.'; } }, '■ Stopp'),
        status),
      h('label', { class: 'field', style: { margin: 0 } }, h('span', {}, 'Hastighet ', rateLabel), rate)),
    h('section', { class: 'card' },
      h('h2', {}, 'Frågor'),
      renderQuestionList(item.questions, {
        context: item.segments.map((s) => `${s.speaker ? s.speaker + ': ' : ''}${s.text}`).join('\n'),
        onComplete: ({ score, max }) => {
          recordResult(MODULE, item.id, { score, max });
          transcript.hidden = false;
          result.replaceChildren(h('div', { class: 'card' },
            h('h2', {}, `Resultat: ${score.toFixed(1).replace('.0', '')} av ${max}`),
            h('p', { class: 'small muted' }, 'Transkriptionen visas ovan. Lyssna igen och läs med.')));
        },
      })),
    transcript,
    result,
  );
  return () => speechSynthesis.cancel();
}
