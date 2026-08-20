import type { GameSave, HistoryEntry, Scenario } from '../models/game';
import { findMemory } from './memoryEngine';
import { queryDebt } from './debtEngine';
import { allConditionsMatch } from './conditionEvaluator';

export function generateHistoricalEvaluation(save: GameSave, scenario?: Scenario): string {
  const evaluation = scenario?.historyEvaluations?.find((item) =>
    allConditionsMatch(item.requirements, save.worldState, save.memories, save.debts));
  return evaluation?.text ?? '历史尚未收到可供编辑的官方结论。';
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.join('、');
  if (value === true) return '是';
  if (value === false) return '否';
  return String(value ?? '未定义');
}

export function renderNarrativeTemplate(template: string, save: GameSave, choice?: HistoryEntry, scenario?: Scenario): string {
  return template
    .replace('{{history:evaluation}}', generateHistoricalEvaluation(save, scenario))
    .replace(/\{\{memory:([^}:]+)(?::([^}]+))?\}\}/g, (_, topic: string, field?: string) => {
      const memory = findMemory(save.memories, topic);
      if (!memory) return field ? '无记录' : '政府始终尊重独立思考';
      return displayValue(memory[(field ?? 'statement') as keyof typeof memory]);
    })
    .replace(/\{\{debt:([^}:]+)(?::([^}]+))?\}\}/g, (_, topic: string, field?: string) => {
      const matching = save.debts.filter((debt) => debt.topic === topic);
      const debt = matching.find((item) => item.status === 'active') ?? matching.at(-1) ?? queryDebt(save.debts, topic)[0];
      if (!debt) return field ? '无记录' : '一项尚未被正式承认的承诺';
      return displayValue(debt[(field ?? 'description') as keyof typeof debt]);
    })
    .replace(/\{\{state:([^}]+)\}\}/g, (_, field: string) => displayValue(save.worldState[field]))
    .replace(/\{\{choice:(id|label|response)\}\}/g, (_, field: 'id' | 'label' | 'response') => {
      const key = field === 'id' ? 'choiceId' : field === 'label' ? 'choiceLabel' : 'response';
      return displayValue(choice?.[key]);
    })
    .replace(/\{\{official_terms:last\}\}/g, () => {
      const terms = save.worldState.official_terms;
      return Array.isArray(terms) ? terms.at(-1) ?? '尚未命名' : '尚未命名';
    });
}
