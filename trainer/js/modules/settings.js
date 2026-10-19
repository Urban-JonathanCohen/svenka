// Settings: level, exam profile, hints, API key, speech, backup.
import { h, t, toast } from '../core/ui.js';
import { getSettings, saveSettings } from '../core/state.js';
import { storage } from '../core/storage.js';
import { EXAMS, LEVELS } from '../core/exams.js';
import { PROVIDERS, complete } from '../core/llm.js';
import { svVoices } from './listening.js';

export async function render(root) {
  const s = getSettings();

  const select = (name, options, value, onchange) =>
    h('select', { name, onchange: (e) => onchange(e.target.value) },
      options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));

  const keyInput = h('input', { type: 'password', value: s.apiKey, autocomplete: 'off', placeholder: 'sk-…',
    onchange: (e) => { saveSettings({ apiKey: e.target.value.trim() }); toast('Nyckeln sparad på den här enheten.'); } });
  const modelInput = h('input', { type: 'text', value: s.model, placeholder: PROVIDERS[s.provider]?.defaultModel || '',
    onchange: (e) => saveSettings({ model: e.target.value.trim() }) });
  const keyFields = h('div', { hidden: s.provider === 'none' },
    h('label', { class: 'field' }, h('span', {}, 'API-nyckel'), keyInput),
    h('label', { class: 'field' }, h('span', {}, 'Modell (tom = standard)'), modelInput),
    h('button', { onclick: testKey }, 'Testa nyckeln'));

  const voiceSelect = h('select', { onchange: (e) => saveSettings({ ttsVoice: e.target.value }) }, h('option', { value: '' }, 'Automatiskt'));
  if ('speechSynthesis' in window) {
    svVoices().then((voices) => voices.forEach((v) =>
      voiceSelect.append(h('option', { value: v.name, selected: v.name === s.ttsVoice }, `${v.name} (${v.lang})`))));
  }

  root.append(
    h('h1', {}, t('Inställningar', 'Settings')),

    h('section', { class: 'card' },
      h('h2', {}, 'Nivå och mål'),
      h('label', { class: 'field' }, h('span', {}, `Nivå (nivåtestet gav: ${s.level || 'ej gjort'})`),
        select('level', [['', 'Använd nivåtestets resultat'], ...LEVELS.map((l) => [l, l])], s.levelOverride || '',
          (v) => saveSettings({ levelOverride: v || null }))),
      h('label', { class: 'field' }, h('span', {}, 'Vilket prov förbereder du dig för?'),
        select('exam', Object.values(EXAMS).map((e) => [e.id, `${e.name} – ${e.en}`]), s.exam,
          (v) => saveSettings({ exam: v }))),
      h('label', { class: 'row' },
        h('input', { type: 'checkbox', checked: s.showEnglish, onchange: (e) => saveSettings({ showEnglish: e.target.checked }) }),
        'Visa engelska ledtrådar (English hints)')),

    h('section', { class: 'card' },
      h('h2', {}, 'AI-feedback (valfritt)'),
      h('p', { class: 'small muted' },
        'Med en egen API-nyckel får du bedömning av skrivuppgifter och öppna svar. Nyckeln sparas bara i den här webbläsaren ',
        'och skickas direkt till leverantören – aldrig till oss. Den tas inte med i exporterade backuper.'),
      h('label', { class: 'field' }, h('span', {}, 'Leverantör'),
        select('provider', [['none', 'Ingen (offline)'], ...Object.entries(PROVIDERS).map(([k, p]) => [k, p.label])], s.provider, (v) => {
          saveSettings({ provider: v, model: '' });
          keyFields.hidden = v === 'none';
          modelInput.value = '';
          modelInput.placeholder = PROVIDERS[v]?.defaultModel || '';
        })),
      keyFields),

    h('section', { class: 'card' },
      h('h2', {}, 'Uppläsning'),
      h('label', { class: 'field' }, h('span', {}, 'Svensk röst'), voiceSelect),
      h('button', { onclick: () => speak('Hej! Så här låter jag när jag läser upp texter på svenska.') }, '▶ Provlyssna')),

    h('section', { class: 'card' },
      h('h2', {}, 'Framsteg och backup'),
      h('p', { class: 'small muted' }, 'Allt sparas lokalt i webbläsaren. Exportera en fil för att flytta dina framsteg till en annan enhet.'),
      h('div', { class: 'row' },
        h('button', { onclick: exportData }, 'Exportera'),
        h('label', { class: 'btn' }, 'Importera…', h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: importData })),
        h('button', { class: 'ghost', onclick: resetAll }, 'Radera allt'))),

    h('p', { class: 'small muted' }, 'Svenka · öppen källkod · ', h('a', { href: 'https://github.com/Urban-JonathanCohen/svenka' }, 'GitHub')),
  );

  async function testKey(e) {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Testar…';
    try {
      const reply = await complete({ system: 'Svara kort på svenska.', prompt: 'Säg "Det fungerar!"', maxTokens: 1000 });
      toast(`✓ ${reply.slice(0, 60)}`);
    } catch (err) {
      toast(err.message, 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Testa nyckeln';
    }
  }
}

function speak(text) {
  if (!('speechSynthesis' in window)) return toast('Talsyntes stöds inte i den här webbläsaren.');
  svVoices().then((voices) => {
    const s = getSettings();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'sv-SE';
    u.rate = s.ttsRate;
    u.voice = voices.find((v) => v.name === s.ttsVoice) || voices[0] || null;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(storage.exportAll(), null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `svenka-backup-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    storage.importAll(JSON.parse(await file.text()));
    toast('Backup importerad.');
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    toast(err.message, 4000);
  }
}

function resetAll() {
  if (!confirm('Radera alla framsteg, utkast och inställningar på den här enheten?')) return;
  storage.clearAll();
  location.reload();
}
