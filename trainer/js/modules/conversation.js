// Conversation (Muntlig) – placeholder. See README "Roadmap" for the plan.
import { h, t } from '../core/ui.js';

export function render(root) {
  const hasSTT = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  root.append(
    h('h1', {}, t('Muntlig färdighet', 'Speaking')),
    h('div', { class: 'card' },
      h('p', {}, 'Kommer senare. Planen:'),
      h('ul', {},
        h('li', {}, 'Tal till text med Web Speech API.'),
        h('li', {}, 'En AI som spelar examinator i provsituationer: diskutera en åsikt, berätta om en upplevelse, jämföra alternativ.'),
        h('li', {}, 'Svaren läses upp med talsyntes, och efteråt får du feedback på uttal, flyt och ordförråd.')),
      h('p', { class: 'small muted', style: { margin: 0 } },
        hasSTT ? '✓ Din webbläsare stöder taligenkänning.' : 'Obs: din webbläsare saknar taligenkänning (fungerar i Chrome och Edge).')),
  );
}
