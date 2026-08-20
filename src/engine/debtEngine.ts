import type { DebtAction, DebtTemplate, PoliticalDebt } from '../models/game';

export function createDebt(
  debts: PoliticalDebt[],
  template: DebtTemplate,
  sourceEvent: string,
  turn: number,
  index = 0,
): PoliticalDebt[] {
  const debt: PoliticalDebt = {
    ...structuredClone(template),
    id: `D-${sourceEvent}-${turn}-${index + 1}`,
    sourceEvent,
    createdAtTurn: turn,
    status: 'active',
  };
  return [...debts, debt];
}

export function queryDebt(debts: PoliticalDebt[], topic: string): PoliticalDebt[] {
  return debts.filter((debt) => debt.topic === topic && debt.status === 'active');
}

export function resolveDebt(debts: PoliticalDebt[], topic: string): PoliticalDebt[] {
  return debts.map((debt) => debt.topic === topic && debt.status === 'active' ? { ...debt, status: 'paid' } : debt);
}

export function breakDebt(debts: PoliticalDebt[], topic: string): PoliticalDebt[] {
  return debts.map((debt) => debt.topic === topic && debt.status === 'active' ? { ...debt, status: 'broken', pressure: debt.pressure + 2 } : debt);
}

export function applyDebtActions(debts: PoliticalDebt[], actions: DebtAction[] = []): PoliticalDebt[] {
  return actions.reduce((next, action) => action.action === 'resolve'
    ? resolveDebt(next, action.topic)
    : breakDebt(next, action.topic), debts);
}

export function advanceDebtPressure(debts: PoliticalDebt[]): PoliticalDebt[] {
  return debts.map((debt) => debt.status === 'active'
    ? { ...debt, pressure: Math.min(5, debt.pressure + 1) }
    : debt);
}

export function getDebtPressure(debts: PoliticalDebt[], topic?: string): number {
  return debts
    .filter((debt) => debt.status === 'active' && (!topic || debt.topic === topic))
    .reduce((sum, debt) => sum + debt.pressure, 0);
}
