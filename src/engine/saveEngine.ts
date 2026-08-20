import type { GameSave } from '../models/game';
import { defaultScenarioId } from '../content/scenarioRegistry';

export const SAVE_KEY = 'political-animal-save';

export function serializeSave(save: GameSave): string {
  return JSON.stringify(save);
}

function inferLegacyPhase(currentEventId: unknown): string {
  const number = Number(String(currentEventId ?? '').replace(/\D/g, ''));
  if (number <= 1) return 'mandate';
  if (number <= 4) return 'design';
  if (number <= 10) return 'implementation';
  if (number <= 18) return 'backlash';
  if (number === 19) return 'reckoning';
  return 'ending';
}

export function parseSave(raw: string): GameSave {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (parsed.saveVersion === 1 || parsed.saveVersion === 2) {
    const currentEventId = parsed.currentEventId === 'S0_END' ? 'E11' : String(parsed.currentEventId);
    const history = ((parsed.history as Array<Record<string, unknown>>) ?? []).map((entry) => ({
      ...entry,
      threads: Array.isArray(entry.threads) ? entry.threads : [],
    })) as GameSave['history'];
    return {
      ...(parsed as unknown as GameSave),
      saveVersion: 3,
      engineVersion: '0.3.0',
      scenarioId: String(parsed.scenarioId ?? parsed.scenario ?? defaultScenarioId),
      status: 'playing',
      worldState: { ...(parsed.worldState as GameSave['worldState']), phase: inferLegacyPhase(currentEventId) },
      history,
      memories: (parsed.memories as GameSave['memories']) ?? [],
      debts: (parsed.debts as GameSave['debts']) ?? [],
      completedEvents: ((parsed.completedEvents as string[]) ?? []).filter((id) => id !== 'S0_END'),
      currentEventId,
    };
  }
  if (parsed.saveVersion !== 3 || parsed.engineVersion !== '0.3.0') throw new Error('存档版本不受支持');
  if (!['playing', 'completed'].includes(String(parsed.status)) || !Array.isArray(parsed.history) || !Array.isArray(parsed.memories) || !Array.isArray(parsed.debts)) {
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
