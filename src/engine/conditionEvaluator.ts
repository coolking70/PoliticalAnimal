import type { Condition, LeafCondition, PoliticalDebt, PoliticalMemory, Primitive, WorldState } from '../models/game';

function isLeaf(condition: Condition): condition is LeafCondition {
  return 'field' in condition;
}

function compare(actual: unknown, condition: LeafCondition): boolean {
  const expected = condition.value;
  switch (condition.operator) {
    case 'exists': return actual !== undefined;
    case '==': return actual === expected;
    case '!=': return actual !== expected;
    case '>': return Number(actual) > Number(expected);
    case '>=': return Number(actual) >= Number(expected);
    case '<': return Number(actual) < Number(expected);
    case '<=': return Number(actual) <= Number(expected);
    case 'contains': return Array.isArray(actual) && actual.includes(String(expected));
    case 'not_contains': return !Array.isArray(actual) || !actual.includes(String(expected));
  }
}

export function evaluateCondition(
  condition: Condition,
  state: WorldState,
  memories: PoliticalMemory[] = [],
  debts: PoliticalDebt[] = [],
): boolean {
  if (!isLeaf(condition)) {
    if (condition.all) return condition.all.every((item) => evaluateCondition(item, state, memories, debts));
    if (condition.any) return condition.any.some((item) => evaluateCondition(item, state, memories, debts));
    return false;
  }
  if (condition.scope === 'memory') {
    return memories.some((memory) => memory.active && compare(memory[condition.field as keyof PoliticalMemory], condition));
  }
  if (condition.scope === 'debt') {
    return debts.some((debt) => compare(debt[condition.field as keyof PoliticalDebt], condition));
  }
  return compare(state[condition.field] as Primitive | undefined, condition);
}

export function allConditionsMatch(
  conditions: Condition[] = [],
  state: WorldState,
  memories: PoliticalMemory[] = [],
  debts: PoliticalDebt[] = [],
): boolean {
  return conditions.every((condition) => evaluateCondition(condition, state, memories, debts));
}
