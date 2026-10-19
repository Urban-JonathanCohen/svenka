#!/usr/bin/env node
// Validates all content JSON against the rules in trainer/docs/SCHEMA.md.
// Usage: node tools/validate-content.mjs   (exit code 1 on errors)

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = ['A2', 'B1', 'B2', 'C1'];
const ID = /^[a-z0-9-]+$/;
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

function read(rel) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) { err(rel, 'file missing'); return null; }
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) { err(rel, `invalid JSON – ${e.message}`); return null; }
}

function checkQuestion(where, q) {
  if (!['mc', 'tf', 'open'].includes(q.type)) return err(where, `unknown type "${q.type}"`);
  if (!q.q) err(where, 'missing q');
  if (q.type === 'mc') {
    if (!Array.isArray(q.options) || q.options.length < 2) err(where, 'mc needs ≥2 options');
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(where, `answer ${q.answer} out of range`);
    if (new Set(q.options).size !== q.options?.length) err(where, 'duplicate options');
  }
  if (q.type === 'tf' && typeof q.answer !== 'boolean') err(where, 'tf answer must be boolean');
  if (q.type === 'open' && !q.modelAnswer) err(where, 'open needs modelAnswer');
  if (q.type !== 'open' && !q.explanation) err(where, 'missing explanation');
}

function checkIds(where, items) {
  const seen = new Set();
  for (const x of items) {
    if (!x.id || !ID.test(x.id)) err(where, `bad id "${x.id}"`);
    if (seen.has(x.id)) err(where, `duplicate id "${x.id}"`);
    seen.add(x.id);
  }
}

// Level check
const level = read('trainer/content/level/questions.json');
if (level) {
  checkIds('level', level.questions);
  for (const q of level.questions) {
    if (!LEVELS.includes(q.level)) err(`level/${q.id}`, `bad level ${q.level}`);
    checkQuestion(`level/${q.id}`, q);
  }
  for (const l of LEVELS) {
    const n = level.questions.filter((q) => q.level === l).length;
    if (n < 4) err('level', `${l} has ${n} questions, needs ≥4`);
  }
}

// Reading & listening
for (const mod of ['reading', 'listening']) {
  const index = read(`trainer/content/${mod}/index.json`);
  if (!index) continue;
  const items = index.files.map((f) => ({ f, data: read(`trainer/content/${mod}/${f}`) })).filter((x) => x.data);
  checkIds(mod, items.map((x) => x.data));
  for (const { f, data } of items) {
    const where = `${mod}/${f}`;
    if (!LEVELS.includes(data.level)) err(where, `bad level ${data.level}`);
    if (!data.title) err(where, 'missing title');
    if (mod === 'reading' && (!data.text || !data.summary)) err(where, 'missing text or summary');
    if (mod === 'listening' && !data.segments?.length) err(where, 'missing segments');
    (data.questions || []).forEach((q, i) => checkQuestion(`${where}#${i + 1}`, q));
  }
}

// Writing
const writing = read('trainer/content/writing/prompts.json');
if (writing) {
  checkIds('writing', writing.prompts);
  for (const p of writing.prompts) {
    if (!LEVELS.includes(p.level)) err(`writing/${p.id}`, 'bad level');
    if (!Array.isArray(p.words) || p.words.length !== 2) err(`writing/${p.id}`, 'words must be [min, max]');
  }
}

// Vocabulary
const tree = read('trainer/content/vocab/tree.json');
if (tree) {
  const leaves = new Set();
  const walk = (n) => (n.children ? n.children.forEach(walk) : leaves.add(n.id));
  walk(tree.root);
  const cards = tree.files.flatMap((f) => read(`trainer/content/vocab/${f}`)?.cards || []);
  checkIds('vocab', cards);
  for (const c of cards) {
    if (!leaves.has(c.theme)) err(`vocab/${c.id}`, `unknown theme "${c.theme}"`);
    if (!c.sv) err(`vocab/${c.id}`, 'missing sv');
    if (c.article && !['en', 'ett'].includes(c.article)) err(`vocab/${c.id}`, `bad article "${c.article}"`);
  }
  console.log(`vocab: ${cards.length} cards in ${leaves.size} themes`);
}

// Civics
const civ = read('shared/content/civics/index.json');
if (civ) {
  const chapters = new Set(civ.chapters.map((c) => c.id));
  const qs = civ.files.flatMap((f) => read(`shared/content/civics/${f}`)?.questions || []);
  checkIds('civics', qs);
  for (const q of qs) {
    if (!chapters.has(q.chapter)) err(`civics/${q.id}`, `unknown chapter "${q.chapter}"`);
    checkQuestion(`civics/${q.id}`, q);
  }
  console.log(`civics: ${qs.length} questions`);
}

// Kung Bulle prompts
const kb = read('kung-bulle/content/prompts.json');
if (kb) {
  const { slug } = await import('../kung-bulle/js/match.js');
  checkIds('kung-bulle', kb.prompts);
  for (const p of kb.prompts) {
    if (!p.answers?.length) err(`kung-bulle/${p.id}`, 'no answers');
    const canon = new Set();
    for (const a of p.answers || []) {
      const id = a.id || slug(a.label);
      if (!ID.test(id)) err(`kung-bulle/${p.id}`, `bad answer id "${id}"`);
      if (canon.has(id)) err(`kung-bulle/${p.id}`, `duplicate answer id ${id}`);
      canon.add(id);
    }
  }
  console.log(`kung-bulle: ${kb.prompts.length} prompts`);
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log('✓ All content valid');
