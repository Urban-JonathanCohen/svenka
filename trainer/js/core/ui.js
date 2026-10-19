// Tiny DOM helpers so modules stay readable without a framework.

/**
 * h('button', { class: 'primary', onclick }, 'Text', childNode)
 * Attributes starting with "on" become event listeners; `html` sets innerHTML
 * (only use with trusted, app-authored strings).
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Swedish text with an optional English hint (hidden when hints are off). */
export function t(sv, en) {
  return en ? h('span', {}, sv, h('span', { class: 'en' }, en)) : h('span', {}, sv);
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

let toastTimer;
export function toast(message, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function spinner(label = 'Arbetar…') {
  return h('span', { class: 'row muted' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), label);
}

export function progressBar(fraction) {
  return h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': Math.round(fraction * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div', { style: { width: `${Math.round(fraction * 100)}%` } }));
}

export function paragraphs(text) {
  return text.split(/\n\s*\n/).map((p) => h('p', {}, p.trim()));
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function backLink(href, label = '← Tillbaka') {
  return h('a', { href, class: 'small' }, label);
}

export function levelPill(level) {
  return h('span', { class: 'pill level' }, level);
}
