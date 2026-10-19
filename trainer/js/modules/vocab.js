// Vocabulary (Ordförråd): SM-2 flashcards plus a sunburst map of the theme
// tree coloured by mastery. Click a segment to focus a category or theme.
import { h, t, toast, shuffle } from '../core/ui.js';
import { loadJSON, PATHS } from '../core/content.js';
import { storage } from '../core/storage.js';
import { GRADES, review, isDue, mastery, newState } from '../core/srs.js';

const SRS_KEY = 'vocab:srs';
const NEW_PER_SESSION = 10;
const MAX_PER_SESSION = 30;

// Single-hue sequential ramp (blue), validated light->dark. Dark mode runs the
// ramp the other way so stronger mastery is always the higher-contrast fill.
const RAMP_LIGHT = ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];
const RAMP_DARK = ['#104281', '#1c5cab', '#2a78d6', '#6da7ec', '#cde2fb'];
const UNSEEN = { light: '#e4e0d6', dark: '#33373d' };

export async function render(root, [mode, nodeId]) {
  const { tree, cards } = await loadVocab();
  if (mode === 'study') return renderStudy(root, tree, cards, nodeId || 'root');
  await renderMap(root, tree, cards, nodeId || 'root');
}

export async function loadVocab() {
  const tree = await loadJSON(`${PATHS.vocab}/tree.json`);
  const files = await Promise.all(tree.files.map((f) => loadJSON(`${PATHS.vocab}/${f}`)));
  const cards = files.flatMap((f) => f.cards);
  return { tree, cards };
}

function loadD3() {
  if (window.d3) return Promise.resolve(window.d3);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/d3.min.js';
    s.onload = () => resolve(window.d3);
    s.onerror = () => reject(new Error('Kunde inte ladda D3.'));
    document.head.append(s);
  });
}

/** Ids of every leaf theme under `nodeId` (inclusive). */
function leafIds(tree, nodeId) {
  const out = [];
  const walk = (n, inside) => {
    const now = inside || n.id === nodeId;
    if (!n.children) { if (now) out.push(n.id); return; }
    n.children.forEach((c) => walk(c, now));
  };
  walk(tree.root, false);
  return out;
}

function findNode(tree, id) {
  let found = null;
  const walk = (n) => { if (n.id === id) found = n; n.children?.forEach(walk); };
  walk(tree.root);
  return found;
}

function statsFor(cards, srs) {
  const now = new Date();
  let sum = 0, started = 0, due = 0;
  for (const c of cards) {
    const s = srs[c.id];
    sum += mastery(s);
    if (s?.seen) { started += 1; if (isDue(s, now)) due += 1; }
  }
  return { total: cards.length, started, due, fresh: cards.length - started, mastery: cards.length ? sum / cards.length : 0 };
}

// --- Map view ----------------------------------------------------------------

async function renderMap(root, tree, cards, selectedId) {
  const srs = storage.get(SRS_KEY, {});
  const byTheme = Map.groupBy ? Map.groupBy(cards, (c) => c.theme) : groupBy(cards, (c) => c.theme);
  const cardsUnder = (id) => leafIds(tree, id).flatMap((leaf) => byTheme.get(leaf) || []);

  const info = h('div', { class: 'card' });
  const chartWrap = h('div', { class: 'sunburst-wrap' });
  const centerLabel = h('div', { class: 'sunburst-center' });
  chartWrap.append(centerLabel);

  root.append(
    h('h1', {}, t('Ordförråd', 'Vocabulary')),
    h('p', { class: 'muted' }, 'Kartan visar hur väl du kan varje område. Mörkare = starkare. Klicka på ett område för att öva just det.'),
    chartWrap,
    legend(),
    info,
    h('details', { class: 'card' }, h('summary', {}, t('Tabell', 'Table view')), table()),
  );

  let selected = selectedId;
  const d3 = await loadD3();
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const ramp = d3.scaleLinear().domain([0, 0.25, 0.5, 0.75, 1]).range(dark ? RAMP_DARK : RAMP_LIGHT).interpolate(d3.interpolateRgb).clamp(true);
  const fillFor = (st) => (st.started ? ramp(st.mastery) : dark ? UNSEEN.dark : UNSEEN.light);

  const size = 520;
  const R = size / 2;
  const hierarchy = d3.hierarchy(tree.root).sum((d) => (d.children ? 0 : Math.max((byTheme.get(d.id) || []).length, 1)));
  d3.partition().size([2 * Math.PI, 3])(hierarchy);
  const rings = { 1: [0.30, 0.60], 2: [0.62, 0.995] };
  const arc = d3.arc()
    .startAngle((d) => d.x0).endAngle((d) => d.x1)
    .padAngle(0.006).padRadius(R)
    .innerRadius((d) => rings[d.depth][0] * R).outerRadius((d) => rings[d.depth][1] * R);

  const svg = d3.create('svg').attr('viewBox', [-R, -R, size, size]).attr('role', 'img')
    .attr('aria-label', 'Karta över ordförrådet, färgad efter hur väl du kan varje område');
  const nodes = hierarchy.descendants().filter((d) => d.depth > 0);
  nodes.forEach((d) => (d.stats = statsFor(cardsUnder(d.data.id), srs)));

  const paths = svg.append('g').selectAll('path').data(nodes).join('path')
    .attr('d', arc)
    .attr('fill', (d) => fillFor(d.stats))
    .attr('tabindex', 0)
    .on('click', (_, d) => select(d.data.id))
    .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(d.data.id); } })
    .on('mouseenter focus', (_, d) => drawCenter(d.data, d.stats))
    .on('mouseleave blur', () => drawCenter(findNode(tree, selected), statsFor(cardsUnder(selected), srs)));
  paths.append('title').text((d) => `${d.data.name}: ${pct(d.stats.mastery)} · ${d.stats.started}/${d.stats.total} påbörjade`);

  // Labels: only where the arc is wide enough; ink chosen for contrast with the fill.
  svg.append('g').attr('pointer-events', 'none').attr('text-anchor', 'middle')
    .style('font', '600 12px system-ui, sans-serif')
    .selectAll('text').data(nodes.filter((d) => (d.x1 - d.x0) * ((rings[d.depth][0] + rings[d.depth][1]) / 2) * R > 34))
    .join('text')
    .attr('transform', (d) => {
      const x = ((d.x0 + d.x1) / 2) * 180 / Math.PI;
      const y = ((rings[d.depth][0] + rings[d.depth][1]) / 2) * R;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    })
    .attr('dy', '0.35em')
    .attr('fill', (d) => (d3.hsl(fillFor(d.stats)).l > 0.6 ? '#1d1f22' : '#ffffff'))
    .text((d) => d.data.short || d.data.name);

  // Center disc resets to everything.
  svg.append('circle').attr('r', rings[1][0] * R - 4).attr('fill', 'transparent').style('cursor', 'pointer')
    .on('click', () => select('root'));

  chartWrap.prepend(svg.node());

  function select(id) {
    selected = id;
    history.replaceState(null, '', `#/vocab/map/${id}`);
    paths.attr('opacity', (d) => (id === 'root' || d.data.id === id || d.ancestors().some((a) => a.data.id === id) ? 1 : 0.35));
    const node = findNode(tree, id);
    const st = statsFor(cardsUnder(id), srs);
    drawCenter(node, st);
    drawInfo(node, st);
  }

  function drawCenter(node, st) {
    centerLabel.replaceChildren(
      h('strong', {}, node.name),
      h('span', { class: 'small muted' }, `${pct(st.mastery)} behärskat`),
      h('span', { class: 'small muted' }, `${st.total} ord`));
  }

  function drawInfo(node, st) {
    const studyable = Math.min(st.due + Math.min(st.fresh, NEW_PER_SESSION), MAX_PER_SESSION);
    info.replaceChildren(
      h('h2', {}, node.name, node.en ? h('span', { class: 'en' }, node.en) : null),
      h('p', { class: 'small muted' },
        `${st.total} ord · ${st.started} påbörjade · ${st.due} att repetera nu · ${st.fresh} nya`),
      h('div', { class: 'row' },
        h('a', { class: 'btn primary', href: `#/vocab/study/${node.id}`, 'aria-disabled': String(!studyable) },
          studyable ? `Öva ${studyable} kort` : 'Inget att öva just nu'),
        h('a', { class: 'btn', href: `#/vocab/study/${node.id}?all=1` }, 'Öva alla i området')),
    );
  }

  function table() {
    const rows = [];
    const walk = (n, depth) => {
      if (n.id !== 'root') {
        const st = statsFor(cardsUnder(n.id), srs);
        rows.push(h('tr', {},
          h('td', { style: { paddingLeft: `${(depth - 1) * 16}px`, fontWeight: n.children ? 600 : 400 } }, n.name),
          h('td', {}, st.total), h('td', {}, st.started), h('td', {}, pct(st.mastery))));
      }
      n.children?.forEach((c) => walk(c, depth + 1));
    };
    walk(tree.root, 0);
    return h('table', { class: 'small', style: { width: '100%', marginTop: '8px', borderCollapse: 'collapse' } },
      h('thead', {}, h('tr', {}, ['Område', 'Ord', 'Påbörjade', 'Behärskat'].map((x) => h('th', { style: { textAlign: 'left' } }, x)))),
      h('tbody', {}, rows));
  }

  function legend() {
    const dk = matchMedia('(prefers-color-scheme: dark)').matches;
    const stops = (dk ? RAMP_DARK : RAMP_LIGHT).join(',');
    return h('div', { class: 'legend' },
      h('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: dk ? UNSEEN.dark : UNSEEN.light, display: 'inline-block' } }),
      'Ej påbörjad',
      h('span', { style: { width: '12px' } }),
      '0 %', h('span', { class: 'ramp', style: { background: `linear-gradient(90deg, ${stops})` } }), '100 %');
  }

  select(selected);
}

// --- Study session -------------------------------------------------------------

function renderStudy(root, tree, cards, nodeId) {
  const all = new URLSearchParams(location.hash.split('?')[1] || '').has('all');
  const id = nodeId.split('?')[0];
  const node = findNode(tree, id) || tree.root;
  const leaves = new Set(leafIds(tree, node.id));
  const srs = storage.get(SRS_KEY, {});
  const pool = cards.filter((c) => leaves.has(c.theme));

  const due = shuffle(pool.filter((c) => srs[c.id]?.seen && isDue(srs[c.id])));
  const fresh = shuffle(pool.filter((c) => !srs[c.id]?.seen)).slice(0, all ? pool.length : NEW_PER_SESSION);
  let queue = all ? shuffle(pool) : [...due, ...fresh].slice(0, MAX_PER_SESSION);
  let done = 0;
  const total = queue.length;

  if (!queue.length) {
    root.append(
      h('a', { href: `#/vocab/map/${node.id}`, class: 'small' }, '← Till kartan'),
      h('div', { class: 'card', style: { marginTop: '8px' } },
        h('h2', {}, 'Inget att repetera just nu 🎉'),
        h('p', {}, 'Kom tillbaka senare, eller öva alla kort i området.'),
        h('a', { class: 'btn', href: `#/vocab/study/${node.id}?all=1` }, 'Öva alla ändå')));
    return;
  }

  const header = h('div', { class: 'row spread small muted' });
  const stage = h('div');
  root.append(h('a', { href: `#/vocab/map/${node.id}`, class: 'small' }, '← Till kartan'),
    h('h1', { style: { marginTop: '8px' } }, node.name), header, stage);

  function next() {
    header.replaceChildren(h('span', {}, `${done} av ${total} klara`), h('span', {}, `${queue.length} kvar`));
    if (!queue.length) {
      stage.replaceChildren(h('div', { class: 'card' },
        h('h2', {}, 'Bra jobbat!'),
        h('p', {}, `Du gick igenom ${total} kort.`),
        h('a', { class: 'btn primary', href: `#/vocab/map/${node.id}` }, 'Se kartan')));
      return;
    }
    const card = queue.shift();
    let revealed = false;
    const back = h('div', { hidden: true, class: 'stack', style: { width: '100%' } },
      card.forms ? h('div', { class: 'meta' }, card.forms) : null,
      card.en ? h('div', { class: 'en', style: { fontSize: '1.05rem' } }, card.en) : null,
      card.example ? h('div', { class: 'reading-text', style: { fontSize: '1rem' } }, `”${card.example}”`) : null);
    const face = h('div', { class: 'card flashcard', role: 'button', tabindex: 0, onclick: reveal },
      h('span', { class: 'pill' }, card.pos),
      h('div', { class: 'word' }, card.article ? h('span', { class: 'muted', style: { fontWeight: 400 } }, `${card.article} `) : null, card.sv),
      back,
      h('div', { class: 'small muted', hidden: false, id: 'tap-hint' }, 'Tryck för att visa'));
    const grades = h('div', { class: 'grades', hidden: true },
      GRADES.map((g) => h('button', { onclick: () => grade(g.q) }, h('strong', {}, g.label), h('span', { class: 'small muted' }, g.en))));
    stage.replaceChildren(face, grades);
    face.focus();

    function reveal() {
      if (revealed) return;
      revealed = true;
      back.hidden = false;
      face.querySelector('#tap-hint').hidden = true;
      grades.hidden = false;
      // Hearing the word helps; use TTS when available.
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(`${card.article ? card.article + ' ' : ''}${card.sv}`);
        u.lang = 'sv-SE';
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      }
    }

    function grade(q) {
      const state = review(srs[card.id] || newState(), q);
      srs[card.id] = state;
      storage.set(SRS_KEY, srs);
      if (q < 3) queue.splice(Math.min(3, queue.length), 0, card); // see it again soon
      else done += 1;
      next();
    }

    face.onkeydown = (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); }
    };
  }

  const onKey = (e) => {
    const map = { 1: 1, 2: 3, 3: 4, 4: 5 };
    const btns = stage.querySelectorAll('.grades:not([hidden]) button');
    if (btns.length && map[e.key]) btns[Number(e.key) - 1].click();
  };
  document.addEventListener('keydown', onKey);
  next();
  toast('Tips: tangenterna 1–4 betygsätter kortet.');
  return () => document.removeEventListener('keydown', onKey);
}

function pct(x) {
  return `${Math.round(x * 100)} %`;
}

function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}
