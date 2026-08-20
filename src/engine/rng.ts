export interface RandomResult {
  value: number;
  state: number;
}

export function normalizeSeed(seed: number): number {
  const normalized = Math.abs(Math.trunc(seed)) >>> 0;
  return normalized || 0x6d2b79f5;
}

// Mulberry32 的单步形式：存档只需保存一个 32 位状态。
export function nextRandom(state: number): RandomResult {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: nextState };
}
