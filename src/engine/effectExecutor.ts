import type { Effect, WorldState } from '../models/game';

export function applyEffects(state: WorldState, effects: Effect[]): WorldState {
  const next: WorldState = structuredClone(state);
  for (const effect of effects) {
    switch (effect.operation) {
      case 'set':
        next[effect.field] = structuredClone(effect.value);
        break;
      case 'increment':
        next[effect.field] = Number(next[effect.field] ?? 0) + Number(effect.value);
        break;
      case 'decrement':
        next[effect.field] = Number(next[effect.field] ?? 0) - Number(effect.value);
        break;
      case 'push': {
        const list = Array.isArray(next[effect.field]) ? [...next[effect.field] as string[]] : [];
        const value = String(effect.value);
        if (!list.includes(value)) list.push(value);
        next[effect.field] = list;
        break;
      }
    }
  }
  return next;
}
