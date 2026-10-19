// Dashboard: level, exam profile and shortcuts into each module.
import { h, t } from '../core/ui.js';
import { getSettings, effectiveLevel } from '../core/state.js';
import { storage } from '../core/storage.js';
import { EXAMS } from '../core/exams.js';

const SHORTCUTS = [
  { id: 'level', title: 'Nivåtest', en: 'Level check', desc: 'Adaptivt test som uppskattar din nivå (A2–C1).' },
  { id: 'reading', title: 'Läsförståelse', en: 'Reading', desc: 'Texter med flerval, sant/falskt och en öppen fråga.' },
  { id: 'listening', title: 'Hörförståelse', en: 'Listening', desc: 'Dialoger och monologer som läses upp. Texten visas efteråt.' },
  { id: 'writing', title: 'Skriftlig färdighet', en: 'Writing', desc: 'Skrivuppgifter med timer, checklista och AI-feedback.' },
  { id: 'vocab', title: 'Ordförråd', en: 'Vocabulary', desc: 'Kort med repetition och en karta över dina ämnen.' },
  { id: 'civics', title: 'Sverigekunskap', en: 'Civics', desc: 'Samhällskunskap inför medborgarskapsprovet.' },
];

export function render(root) {
  const s = getSettings();
  const exam = EXAMS[s.exam];
  const vocabSeen = Object.keys(storage.get('vocab:srs', {})).length;

  root.append(
    h('h1', {}, t('Hej! Dags att träna svenska.', "Hi! Time to practise Swedish.")),
    h('div', { class: 'card' },
      h('div', { class: 'row spread' },
        h('div', {},
          h('div', { class: 'small muted' }, 'Din nivå'),
          h('div', { style: { fontSize: '1.6rem', fontWeight: 700 } }, effectiveLevel()),
          h('div', { class: 'small muted' }, s.levelOverride ? 'Manuellt vald' : s.level ? 'Från nivåtestet' : 'Standard – gör nivåtestet')),
        h('div', { style: { textAlign: 'right' } },
          h('div', { class: 'small muted' }, 'Mål'),
          h('div', { style: { fontWeight: 600 } }, exam.name),
          h('a', { href: '#/settings', class: 'small' }, 'Ändra'))),
      !s.level ? h('p', { style: { marginTop: '12px', marginBottom: 0 } },
        h('a', { href: '#/level', class: 'btn primary' }, 'Gör nivåtestet (5 min)')) : null,
    ),
    h('div', { class: 'grid' },
      SHORTCUTS.map((m) => h('a', { class: 'card link', href: `#/${m.id}` },
        h('h3', {}, t(m.title, m.en)),
        h('p', { class: 'small muted', style: { margin: 0 } }, m.desc),
        m.id === 'vocab' && vocabSeen ? h('p', { class: 'small', style: { margin: '6px 0 0' } }, `${vocabSeen} ord påbörjade`) : null))),
    !s.apiKey ? h('p', { class: 'small muted' },
      'Tips: med en egen API-nyckel (Inställningar) får du AI-feedback på skrivuppgifter och öppna svar. Allt annat fungerar utan.') : null,
  );
}
