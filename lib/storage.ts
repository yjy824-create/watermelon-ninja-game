import { BEST_SCORE_KEY } from './gameConfig';

export function getBestScore(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(BEST_SCORE_KEY);
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function setBestScore(score: number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEST_SCORE_KEY, String(Math.max(0, score)));
}
