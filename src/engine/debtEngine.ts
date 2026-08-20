import type { DebtAction, DebtTemplate, PoliticalDebt } from '../models/game';

export function getDebtPressureCap(debt: Pick<PoliticalDebt, 'strength'>): number {
  return Math.max(2, debt.strength * 2);
}

export function getDebtIntensity(debt: Pick<PoliticalDebt, 'pressure' | 'strength'>): number {
  return debt.pressure * (1 + debt.strength / 4);
}

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
    pressure: Math.min(template.pressure, Math.max(2, template.strength * 2)),
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
  return debts.map((debt) => debt.topic === topic && debt.status === 'active'
    ? { ...debt, status: 'broken', pressure: Math.min(getDebtPressureCap(debt), debt.pressure + debt.strength) }
    : debt);
}

export function applyDebtActions(debts: PoliticalDebt[], actions: DebtAction[] = []): PoliticalDebt[] {
  return actions.reduce((next, action) => action.action === 'resolve'
    ? resolveDebt(next, action.topic)
    : breakDebt(next, action.topic), debts);
}

export function advanceDebtPressure(debts: PoliticalDebt[]): PoliticalDebt[] {
  return debts.map((debt) => debt.status === 'active'
    ? { ...debt, pressure: Math.min(getDebtPressureCap(debt), debt.pressure + Math.max(1, Math.ceil(debt.strength / 3))) }
    : debt);
}

export function getDebtPressure(debts: PoliticalDebt[], topic?: string): number {
  return debts
    .filter((debt) => debt.status === 'active' && (!topic || debt.topic === topic))
    .reduce((sum, debt) => sum + getDebtIntensity(debt), 0);
}
