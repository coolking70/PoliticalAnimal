import type { GameEvent, PoliticalDebt, PoliticalMemory, WorldState } from '../models/game';
import { allConditionsMatch } from './conditionEvaluator';
import { nextRandom } from './rng';

export function eligibleEvents(
  events: GameEvent[],
  state: WorldState,
  completedEvents: string[],
  memories: PoliticalMemory[] = [],
  debts: PoliticalDebt[] = [],
): GameEvent[] {
  return events.filter((event) => {
    if (event.once && completedEvents.includes(event.id)) return false;
    if (!allConditionsMatch(event.requirements, state, memories, debts)) return false;
    if ((event.blockers ?? []).some((blocker) => allConditionsMatch([blocker], state, memories, debts))) return false;
    return true;
  });
}

export function selectEvent(
  events: GameEvent[],
  state: WorldState,
  completedEvents: string[],
  rngState: number,
  memories: PoliticalMemory[] = [],
  debts: PoliticalDebt[] = [],
): { event: GameEvent | null; rngState: number; eligible: GameEvent[] } {
  const eligible = eligibleEvents(events, state, completedEvents, memories, debts);
  if (!eligible.length) return { event: null, rngState, eligible };

  const forced = eligible.filter((event) => event.priority >= 100);
  const pool = forced.length ? forced : eligible;
  const highestPriority = Math.max(...pool.map((event) => event.priority));
  const prioritized = pool.filter((event) => event.priority === highestPriority);
  const total = prioritized.reduce((sum, event) => sum + Math.max(0, event.weight), 0);
  const random = nextRandom(rngState);
  if (total <= 0) return { event: prioritized[0], rngState: random.state, eligible };

  let cursor = random.value * total;
  for (const event of prioritized) {
    cursor -= Math.max(0, event.weight);
    if (cursor <= 0) return { event, rngState: random.state, eligible };
  }
  return { event: prioritized.at(-1) ?? null, rngState: random.state, eligible };
}
