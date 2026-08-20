import type {
  EventWeightBreakdown,
  GameEvent,
  HistoryEntry,
  PoliticalDebt,
  PoliticalMemory,
  WorldState,
} from '../models/game';
import { allConditionsMatch } from './conditionEvaluator';
import { getDebtIntensity } from './debtEngine';
import { nextRandom } from './rng';

export function eligibleEvents(
  events: GameEvent[],
  state: WorldState,
  completedEvents: string[],
  memories: PoliticalMemory[] = [],
  debts: PoliticalDebt[] = [],
): GameEvent[] {
  const phase = String(state.phase ?? '');
  return events.filter((event) => {
    if (event.phase !== phase) return false;
    if (event.once && completedEvents.includes(event.id)) return false;
    if (event.after?.some((id) => !completedEvents.includes(id))) return false;
    if (event.afterAny?.length && !event.afterAny.some((id) => completedEvents.includes(id))) return false;
    if (!allConditionsMatch(event.requirements, state, memories, debts)) return false;
    if ((event.blockers ?? []).some((blocker) => allConditionsMatch([blocker], state, memories, debts))) return false;
    return true;
  });
}

export function scoreEvents(
  eligible: GameEvent[],
  state: WorldState,
  memories: PoliticalMemory[],
  debts: PoliticalDebt[],
  history: HistoryEntry[],
): EventWeightBreakdown[] {
  const recentThreads = history.slice(-3).flatMap((entry) => entry.threads);
  return eligible.map((event) => {
    const baseWeight = Math.max(0, event.weight);
    const priorityBonus = Math.max(0, event.priority - 80) * 0.05;
    const debtBonus = Math.min(6, debts
      .filter((debt) => debt.status === 'active' && event.debtTopics?.includes(debt.topic))
      .reduce((sum, debt) => sum + getDebtIntensity(debt) / 3, 0));
    const memoryBonus = Math.min(4, memories
      .filter((memory) => memory.active && event.memoryTopics?.includes(memory.topic))
      .reduce((sum, memory) => sum + memory.importance / 3, 0));
    const uniqueThreads = event.thread.filter((thread) => !recentThreads.includes(thread));
    const threadBonus = Math.min(1.5, uniqueThreads.length * 0.5);
    const urgencyBonus = Math.min(4, (event.urgencyFields ?? [])
      .reduce((sum, field) => sum + Math.max(0, Number(state[field] ?? 0)) * 0.35, 0));
    const repetitionPenalty = history.slice(-3).reduce((penalty, entry) => {
      const overlap = entry.threads.some((thread) => event.thread.includes(thread));
      return penalty + (overlap ? 0.45 : 0);
    }, 0);
    const finalWeight = Math.max(0.1,
      baseWeight + priorityBonus + debtBonus + memoryBonus + threadBonus + urgencyBonus - repetitionPenalty);
    return { event, baseWeight, priorityBonus, debtBonus, memoryBonus, threadBonus, urgencyBonus, repetitionPenalty, finalWeight };
  });
}

export function selectEvent(
  events: GameEvent[],
  state: WorldState,
  completedEvents: string[],
  rngState: number,
  memories: PoliticalMemory[] = [],
  debts: PoliticalDebt[] = [],
  history: HistoryEntry[] = [],
): { event: GameEvent | null; rngState: number; eligible: GameEvent[]; weighted: EventWeightBreakdown[] } {
  const eligible = eligibleEvents(events, state, completedEvents, memories, debts);
  if (!eligible.length) return { event: null, rngState, eligible, weighted: [] };
  const forced = eligible.filter((event) => event.priority >= 150);
  const pool = forced.length ? forced : eligible;
  const weighted = scoreEvents(pool, state, memories, debts, history);
  const total = weighted.reduce((sum, candidate) => sum + candidate.finalWeight, 0);
  const random = nextRandom(rngState);
  let cursor = random.value * total;
  for (const candidate of weighted) {
    cursor -= candidate.finalWeight;
    if (cursor <= 0) return { event: candidate.event, rngState: random.state, eligible, weighted };
  }
  return { event: weighted.at(-1)?.event ?? null, rngState: random.state, eligible, weighted };
}
