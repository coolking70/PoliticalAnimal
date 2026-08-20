import type { GameSave } from '../models/game';

export const SAVE_KEY = 'political-animal-save';

export function serializeSave(save: GameSave): string {
  return JSON.stringify(save);
}

export function parseSave(raw: string): GameSave {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (parsed.saveVersion !== 4 || parsed.engineVersion !== '0.4.0') throw new Error('存档版本不受支持');
  if (!['playing', 'completed'].includes(String(parsed.status))
    || !Array.isArray(parsed.history)
    || !Array.isArray(parsed.memories)
    || !Array.isArray(parsed.debts)
    || !Array.isArray(parsed.pendingFramingIds)
    || !Array.isArray(parsed.seenFramingIds)) {
    throw new Error('存档内容不完整');
  }
  return parsed as unknown as GameSave;
}

export function saveToStorage(save: GameSave): void {
  localStorage.setItem(SAVE_KEY, serializeSave(save));
}

export function loadFromStorage(): GameSave | null {
  const current = localStorage.getItem(SAVE_KEY);
  return current ? parseSave(current) : null;
}
