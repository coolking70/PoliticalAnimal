import type { GameSave, HistoryEntry, Scenario } from '../models/game';
import { findMemory } from './memoryEngine';
import { queryDebt } from './debtEngine';
import { allConditionsMatch } from './conditionEvaluator';

export function generateHistoricalEvaluation(save: GameSave, scenario?: Scenario): string {
  const evaluation = scenario?.historyEvaluations?.find((item) =>
    allConditionsMatch(item.requirements, save.worldState, save.memories, save.debts));
  return evaluation?.text ?? '历史尚未收到可供编辑的官方结论。';
}

const commonPlayerValues: Record<string, string> = {
  active: '尚未兑现',
  paid: '已兑现',
  broken: '已违约',
  expired: '已失效',
  true: '是',
  false: '否',
  unset: '尚未决定',
  undefined: '尚未决定',
};

export function formatPlayerValue(value: unknown, scenario?: Scenario, field?: string): string {
  if (Array.isArray(value)) return value.map((item) => formatPlayerValue(item, scenario, field)).join('、');
  const raw = String(value ?? 'undefined');
  return (field ? scenario?.playerDisplay?.fields?.[field]?.[raw] : undefined)
    ?? scenario?.playerDisplay?.values?.[raw]
    ?? commonPlayerValues[raw]
    ?? raw;
}

export function renderNarrativeTemplate(template: string, save: GameSave, choice?: HistoryEntry, scenario?: Scenario): string {
  return template
    .replace('{{history:evaluation}}', generateHistoricalEvaluation(save, scenario))
    .replace(/\{\{memory:([^}:]+)(?::([^}]+))?\}\}/g, (_, topic: string, field?: string) => {
      const memory = findMemory(save.memories, topic);
      if (!memory) return field ? '无记录' : '没有可供引用的相关记录';
      const resolvedField = field ?? 'statement';
      return formatPlayerValue(memory[resolvedField as keyof typeof memory], scenario, `memory.${resolvedField}`);
    })
    .replace(/\{\{debt:([^}:]+)(?::([^}]+))?\}\}/g, (_, topic: string, field?: string) => {
      const matching = save.debts.filter((debt) => debt.topic === topic);
      const debt = matching.find((item) => item.status === 'active') ?? matching.at(-1) ?? queryDebt(save.debts, topic)[0];
      if (!debt) return field ? '无记录' : '一项尚未被正式承认的承诺';
      const resolvedField = field ?? 'description';
      return formatPlayerValue(debt[resolvedField as keyof typeof debt], scenario, `debt.${resolvedField}`);
    })
    .replace(/\{\{state:([^}]+)\}\}/g, (_, field: string) => formatPlayerValue(save.worldState[field], scenario, field))
    .replace(/\{\{choice:(id|label|response)\}\}/g, (_, field: 'id' | 'label' | 'response') => {
      const key = field === 'id' ? 'choiceId' : field === 'label' ? 'choiceLabel' : 'response';
      return formatPlayerValue(choice?.[key], scenario, `choice.${field}`);
    })
    .replace(/\{\{official_terms:last\}\}/g, () => {
      const terms = save.worldState.official_terms;
      return Array.isArray(terms) ? terms.at(-1) ?? '尚未命名' : '尚未命名';
    });
}
