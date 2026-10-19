// Kung Bulle – "How Swedish are you?"
// Ten prompts, 20 seconds each. Answer with something valid that few others
// said: the rarer your answer, the more points. Daily round = same prompts
// for everyone (Stockholm date), plus unlimited free play.

import { CONFIG } from './config.js';
import { api, submitAnswer } from './api.js';
import { prepare, match } from './match.js';
import { distribution, points, titleFor, roundEmoji, MAX_SCORE } from './scoring.js';

const app = document.getElementById('app');

// ---------- tiny helpers ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const store = {
  get(k, f = null) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const todayKey = () => new Intl.DateTimeFormat('sv-SE', { timeZone: CONFIG.TIMEZONE }).format(new Date());

function seededShuffle(arr, seedStr) {
  let seed = 0;
  for (const ch of seedStr) seed = (Math.imul(31, seed) + ch.charCodeAt(0)) | 0;
  const rand = () => { // mulberry32
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- boot ----------
let PROMPTS = [];

async function boot() {
  const data = await fetch('content/prompts.json').then((r) => r.json());
  PROMPTS = data.prompts.map((p) => ({ ...p, prepared: prepare(p) }));
  start();
}

// ---------- start screen ----------
function start() {
  const today = todayKey();
  const played = store.get(`kb:daily:${today}`);
  const liveEl = h('p', { class: 'live', hidden: true });

  app.replaceChildren(
    h('div', { class: 'hero' },
      h('div', { class: 'crown', 'aria-hidden': 'true' }, '👑'),
      h('h1', {}, 'Kung Bulle'),
      h('p', { class: 'tagline' }, 'Hur svensk är du egentligen?')),
    h('div', { class: 'panel' },
      h('h2', {}, 'Så spelar du'),
      h('ol', { class: 'rules' },
        h('li', {}, `${CONFIG.ROUND_SIZE} frågor, ${CONFIG.SECONDS_PER_PROMPT} sekunder var.`),
        h('li', {}, 'Skriv ett svar som stämmer – men som ', h('strong', {}, 'få andra'), ' har skrivit.'),
        h('li', {}, 'Ju ovanligare (men korrekt!) svar, desto fler poäng.'),
        h('li', {}, 'Samla poäng och bli ', h('strong', {}, 'Kung Bulle 👑'), '.'))),
    liveEl,
    played
      ? h('div', { class: 'panel center' },
          h('p', {}, 'Du har redan spelat dagens omgång.'),
          h('p', { class: 'big' }, `${titleFor(played.score).emoji} ${titleFor(played.score).title}`),
          h('p', { class: 'muted' }, `${played.score} / ${MAX_SCORE} poäng`),
          h('div', { class: 'buttons' },
            h('button', { class: 'primary', onclick: () => share(played, today) }, 'Dela resultat'),
            h('button', { onclick: () => play('free') }, 'Spela fritt')))
      : h('div', { class: 'buttons' },
          h('button', { class: 'primary big-btn', onclick: () => play('daily') }, 'Starta dagens omgång'),
          h('button', { onclick: () => play('free') }, 'Spela fritt')),
    h('p', { class: 'fine' },
      api.live ? 'Svaren sparas anonymt tillsammans med ungefärligt land och tidszon. ' : 'Offline-läge: poängen räknas mot uppskattade svar. ',
      h('a', { href: 'privacy.html' }, 'Integritet'), ' · ',
      h('a', { href: '../trainer/' }, 'Plugga svenska på riktigt med Svenka')),
  );

  if (api.live) {
    api.stats().then((s) => {
      if (!s) return;
      liveEl.hidden = false;
      liveEl.replaceChildren(h('span', { class: 'dot' }), ` Live: ${s.playersToday} spelare och ${s.answersToday} svar i dag`,
        s.countries?.length ? ` · från ${s.countries.length} ${s.countries.length === 1 ? 'land' : 'länder'}` : '');
    }).catch(() => {});
  }
}

// ---------- a round ----------
function play(mode) {
  const today = todayKey();
  const seed = mode === 'daily' ? today : `${today}-${Math.random()}`;
  const prompts = seededShuffle(PROMPTS, seed).slice(0, CONFIG.ROUND_SIZE);
  const rounds = [];
  ask(0);

  function ask(i) {
    if (i === prompts.length) return finish();
    const p = prompts[i];
    const total = CONFIG.SECONDS_PER_PROMPT;
    let left = total;
    let done = false;

    const input = h('input', { type: 'text', maxlength: '60', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      placeholder: 'Skriv ditt svar…', 'aria-label': 'Ditt svar', enterkeyhint: 'send' });
    const bar = h('div', { class: 'timebar' }, h('div'));
    const secs = h('span', { class: 'secs' }, String(left));
    const form = h('form', { class: 'answer', onsubmit: (e) => { e.preventDefault(); submit(); } },
      input, h('button', { class: 'primary', type: 'submit' }, 'Svara'));

    app.replaceChildren(
      h('div', { class: 'progress-row' }, h('span', {}, `${i + 1} / ${prompts.length}`), secs),
      bar,
      h('div', { class: 'prompt' }, p.q),
      form,
    );
    input.focus();

    const started = performance.now();
    const tick = setInterval(() => {
      left = Math.max(0, total - (performance.now() - started) / 1000);
      secs.textContent = String(Math.ceil(left));
      bar.firstChild.style.width = `${(left / total) * 100}%`;
      bar.classList.toggle('hurry', left < 5);
      if (left <= 0) submit(true);
    }, 100);

    async function submit(timeout = false) {
      if (done) return;
      const raw = input.value.trim();
      if (!raw && !timeout) return;
      done = true;
      clearInterval(tick);
      input.disabled = true;
      form.querySelector('button').disabled = true;

      const m = raw ? match(raw, p.prepared) : null;
      const result = await submitAnswer({ promptId: p.id, answerId: m?.answer.id || null, raw });
      const dist = distribution(p.prepared, result.counts);
      const mine = m ? dist.find((d) => d.id === m.answer.id) : null;
      const pts = mine ? points(mine.share) : 0;
      rounds.push({ promptId: p.id, raw, answerId: mine?.id || null, label: mine?.label || null, points: pts });
      reveal(i, p, raw, mine, pts, dist, timeout);
    }
  }

  function reveal(i, p, raw, mine, pts, dist, timeout) {
    const top = dist.slice(0, 5);
    const rare = dist.slice(-3).reverse().filter((d) => !top.includes(d) && d.id !== mine?.id);
    const next = h('button', { class: 'primary big-btn', onclick: () => ask(i + 1) }, i + 1 < prompts.length ? 'Nästa fråga →' : 'Se resultat 👑');

    let verdict;
    if (!raw) verdict = h('div', { class: 'verdict bad' }, h('strong', {}, timeout ? 'Tiden tog slut! ⏰' : 'Inget svar'), ' 0 poäng');
    else if (!mine) verdict = h('div', { class: 'verdict bad' }, h('strong', {}, `”${raw}”`), ' godkändes inte. 0 poäng. ',
      h('span', { class: 'muted' }, 'Borde det godkännas? Vi går igenom alla svar och utökar listan.'));
    else verdict = h('div', { class: `verdict ${pts >= 50 ? 'great' : 'ok'}` },
      h('div', { class: 'pts' }, `+${pts}`),
      h('div', {}, h('strong', {}, mine.label), ` – ${pct(mine.share)} svarade samma.`),
      h('div', { class: 'muted' }, pts >= 80 ? 'Unikt! Kunglig klass. 👑' : pts >= 50 ? 'Snyggt, ganska ovanligt!' : 'Korrekt, men många tänkte likadant.'));

    app.replaceChildren(
      h('div', { class: 'progress-row' }, h('span', {}, `${i + 1} / ${prompts.length}`), h('span', {}, `${rounds.reduce((s, r) => s + r.points, 0)} p`)),
      h('div', { class: 'prompt small' }, p.q),
      verdict,
      h('div', { class: 'panel' },
        h('h3', {}, 'Vanligaste svaren'),
        h('ul', { class: 'bars' }, top.map((d) => h('li', { class: d.id === mine?.id ? 'me' : '' },
          h('span', { class: 'label' }, d.label),
          h('span', { class: 'track' }, h('span', { class: 'fill', style: { width: `${Math.max(2, d.share * 100 / top[0].share)}%` } })),
          h('span', { class: 'val' }, pct(d.share))))),
        rare.length ? h('p', { class: 'muted small' }, 'Ovanliga svar som också godkänns: ', rare.map((d) => d.label).join(', ')) : null),
      next,
    );
    next.focus();
  }

  function finish() {
    const score = rounds.reduce((s, r) => s + r.points, 0);
    const result = { score, rounds, mode, at: new Date().toISOString() };
    if (mode === 'daily') store.set(`kb:daily:${today}`, result);
    const best = store.get('kb:best', 0);
    if (score > best) store.set('kb:best', score);
    const t = titleFor(score);

    app.replaceChildren(
      h('div', { class: 'hero' },
        h('div', { class: 'crown', 'aria-hidden': 'true' }, t.emoji),
        h('p', { class: 'muted' }, 'Du är…'),
        h('h1', {}, t.title),
        h('p', { class: 'tagline' }, t.line),
        h('p', { class: 'score' }, `${score} / ${MAX_SCORE}`),
        h('p', { class: 'emojis', 'aria-hidden': 'true' }, rounds.map((r) => roundEmoji(r.points, !!r.answerId)).join(''))),
      h('div', { class: 'buttons' },
        h('button', { class: 'primary', onclick: () => share(result, today) }, 'Dela resultat'),
        h('button', { onclick: () => play('free') }, 'Spela igen (fritt)'),
        h('button', { onclick: start }, 'Startsidan')),
      h('div', { class: 'panel' },
        h('h3', {}, 'Dina svar'),
        h('ol', { class: 'summary' }, rounds.map((r) => {
          const p = PROMPTS.find((x) => x.id === r.promptId);
          return h('li', {}, h('span', { class: 'muted' }, p.q), h('br'),
            r.answerId ? h('strong', {}, r.label) : h('span', { class: 'bad-text' }, r.raw || '—'), ` · ${r.points} p`);
        }))),
      h('p', { class: 'fine center' }, `Ditt bästa resultat: ${Math.max(best, score)} p`),
    );
  }
}

function pct(x) {
  const v = x * 100;
  return `${v < 1 ? v.toFixed(1).replace('.', ',') : Math.round(v)} %`;
}

async function share(result, date) {
  const t = titleFor(result.score);
  const text = `Kung Bulle 👑 ${result.mode === 'daily' ? date : '(fritt spel)'}\n` +
    `Jag blev: ${t.title} ${t.emoji} (${result.score}/${MAX_SCORE})\n` +
    `${result.rounds.map((r) => roundEmoji(r.points, !!r.answerId)).join('')}\n` +
    `Hur svensk är du? ${location.href.split('#')[0]}`;
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      toast('Kopierat! Klistra in var du vill.');
    }
  } catch { /* user cancelled */ }
}

function toast(msg) {
  const el = h('div', { class: 'toast' }, msg);
  document.body.append(el);
  setTimeout(() => el.remove(), 2500);
}

boot().catch((err) => {
  app.replaceChildren(h('div', { class: 'panel' }, h('h2', {}, 'Hoppsan!'), h('p', {}, err.message)));
});
