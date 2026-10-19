// Uniqueness scoring and the cheeky titles.
import { CONFIG } from './config.js';

/**
 * Blend live counts with popularity priors so scores are stable before much
 * live data exists. Returns [{id, label, n, share}] sorted by popularity.
 */
export function distribution(prepared, counts = {}) {
  const rows = prepared.map((a) => ({ id: a.id, label: a.label, n: (counts[a.id] || 0) + (a.w || 1) * CONFIG.PRIOR_WEIGHT }));
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  rows.forEach((r) => (r.share = r.n / total));
  return rows.sort((a, b) => b.n - a.n);
}

/** 0 for invalid/timeout; rarer valid answers score more (5–100). */
export function points(share) {
  if (share === null || share === undefined) return 0;
  return Math.max(5, Math.round(100 * (1 - Math.sqrt(share))));
}

export const MAX_SCORE = CONFIG.ROUND_SIZE * 100;

export const TITLES = [
  { min: 0, title: 'Turist på Arlanda', emoji: '✈️', line: 'Du har precis landat. Välkommen! Börja med att köpa en kanelbulle.' },
  { min: 150, title: 'Vilse på IKEA', emoji: '🛋️', line: 'Du har hittat köttbullarna men inte utgången. Följ pilarna i golvet.' },
  { min: 300, title: 'Fikanovis', emoji: '☕', line: 'Du vet vad fika är, men tar fortfarande bara EN kaka. Respekt.' },
  { min: 430, title: 'Lagom-lärling', emoji: '⚖️', line: 'Inte för mycket, inte för lite. Du är på god väg.' },
  { min: 560, title: 'Jantelagens väktare', emoji: '🤫', line: 'Du är ganska bra – men du skulle aldrig säga det själv.' },
  { min: 690, title: 'Midsommargeneral', emoji: '🌸', line: 'Du kan dansa små grodorna i regn utan att blinka.' },
  { min: 820, title: 'Kung Bulle', emoji: '👑', line: 'Hela Sverige bugar. Du är svenskare än en kanelbulle på kanelbullens dag.' },
];

export function titleFor(score) {
  return [...TITLES].reverse().find((t) => score >= t.min);
}

/** One emoji per round for the share text. */
export function roundEmoji(p, valid) {
  if (!valid) return '⬛';
  if (p >= 80) return '👑';
  if (p >= 50) return '🟨';
  return '🟦';
}
