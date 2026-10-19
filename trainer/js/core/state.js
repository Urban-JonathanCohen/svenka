// Settings and progress on top of the storage adapter.
import { storage } from './storage.js';
import { DEFAULT_EXAM } from './exams.js';

const DEFAULT_SETTINGS = {
  level: null,          // set by the level check
  levelOverride: null,  // manual override, wins over `level`
  exam: DEFAULT_EXAM,
  showEnglish: true,
  provider: 'none',     // 'none' | 'anthropic' | 'openai'
  apiKey: '',
  model: '',            // empty = provider default
  ttsRate: 0.9,
  ttsVoice: '',
};

const listeners = new Set();

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...storage.get('settings', {}) };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  storage.set('settings', next);
  listeners.forEach((fn) => fn(next));
  return next;
}

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function effectiveLevel() {
  const s = getSettings();
  return s.levelOverride || s.level || 'B2';
}

export function hasLLM() {
  const s = getSettings();
  return s.provider !== 'none' && Boolean(s.apiKey);
}

// Progress: one record per module, keyed by exercise id.
export function getProgress(module) {
  return storage.get(`progress:${module}`, {});
}

export function recordResult(module, id, { score, max, extra } = {}) {
  const all = getProgress(module);
  const prev = all[id] || { attempts: 0, best: 0 };
  all[id] = {
    attempts: prev.attempts + 1,
    last: { score, max, at: new Date().toISOString() },
    best: Math.max(prev.best || 0, max ? score / max : 0),
    ...(extra || {}),
  };
  storage.set(`progress:${module}`, all);
  return all[id];
}
