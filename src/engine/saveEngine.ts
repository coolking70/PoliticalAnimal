import type { GameSave } from '../models/game';

export const SAVE_KEY = 'political-animal-stage0-save';

export function serializeSave(save: GameSave): string {
  return JSON.stringify(save);
}

export function parseSave(raw: string): GameSave {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (parsed.saveVersion === 1 && parsed.engineVersion === '0.1.0') {
    return {
      ...(parsed as unknown as GameSave),
      saveVersion: 2,
      engineVersion: '0.2.0',
      memories: [],
      debts: [],
      completedEvents: ((parsed.completedEvents as string[]) ?? []).filter((id) => id !== 'S0_END'),
      currentEventId: parsed.currentEventId === 'S0_END' ? 'E11' : String(parsed.currentEventId),
    };
  }
  if (parsed.saveVersion !== 2 || parsed.engineVersion !== '0.2.0') {
    throw new Error('存档版本不受支持');
  }
  if (!parsed.currentEventId || !Array.isArray(parsed.history) || !Array.isArray(parsed.memories) || !Array.isArray(parsed.debts)) {
    throw new Error('存档内容不完整');
  }
  return parsed as unknown as GameSave;
}

export function saveToStorage(save: GameSave): void {
  localStorage.setItem(SAVE_KEY, serializeSave(save));
}

export function loadFromStorage(): GameSave | null {
  const raw = localStorage.getItem(SAVE_KEY);
  return raw ? parseSave(raw) : null;
}
