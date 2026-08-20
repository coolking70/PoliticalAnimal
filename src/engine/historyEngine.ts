import type { GameSave, HistoryEntry } from '../models/game';
import { findMemory } from './memoryEngine';
import { queryDebt } from './debtEngine';

export function generateHistoricalEvaluation(save: GameSave): string {
  const metric = save.worldState.reform_metric;
  const exam = save.worldState.standardized_exam === true;
  const autonomy = Number(save.worldState.local_autonomy ?? 0);
  const expertPower = Number(save.worldState.expert_power ?? 0);
  const finalPolicy = save.worldState.final_policy;
  const term = Array.isArray(save.worldState.official_terms)
    ? save.worldState.official_terms.at(-1)
    : undefined;

  const doctrine = finalPolicy === 'permanent_reform'
    ? '把临时改革建设成了永久机构'
    : finalPolicy === 'local_autonomy' || autonomy >= 3
      ? '以中央退出证明了地方多样性的胜利'
      : finalPolicy === 'expert_rule' || expertPower >= 3
        ? '让专家从解释教育开始，逐步学会解释国家'
        : exam
          ? '建立了全国统一的独立思考标准'
          : '成功避免了用同一种方法要求所有动物保持不同';
  const measurement = metric && metric !== 'none'
    ? `官方的${String(metric) === 'creativity' ? '创造力指数' : '改革指标'}在五年内增长了 42%。`
    : '由于拒绝设置指标，改革取得了无法被数字否认的成功。';
  const language = term ? `历史教材把这段时期称为“${term}”。` : '历史教材把当年的混乱解释为审慎的战略留白。';
  return `五年后的共和国教材写道：本届政府${doctrine}。${measurement}${language}`;
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.join('、');
  if (value === true) return '是';
  if (value === false) return '否';
  return String(value ?? '未定义');
}

export function renderNarrativeTemplate(template: string, save: GameSave, choice?: HistoryEntry): string {
  return template
    .replace(/\{\{memory:([^}:]+)(?::([^}]+))?\}\}/g, (_, topic: string, field?: string) => {
      const memory = findMemory(save.memories, topic);
      return displayValue(memory?.[(field ?? 'statement') as keyof typeof memory] ?? '政府始终尊重独立思考');
    })
    .replace(/\{\{debt:([^}:]+)(?::([^}]+))?\}\}/g, (_, topic: string, field?: string) => {
      const matching = save.debts.filter((debt) => debt.topic === topic);
      const debt = matching.find((item) => item.status === 'active') ?? matching.at(-1) ?? queryDebt(save.debts, topic)[0];
      return displayValue(debt?.[(field ?? 'description') as keyof typeof debt] ?? '一项尚未被正式承认的承诺');
    })
    .replace(/\{\{state:([^}]+)\}\}/g, (_, field: string) => displayValue(save.worldState[field]))
    .replace(/\{\{choice:(id|label|response)\}\}/g, (_, field: 'id' | 'label' | 'response') => {
      const key = field === 'id' ? 'choiceId' : field === 'label' ? 'choiceLabel' : 'response';
      return displayValue(choice?.[key]);
    })
    .replace(/\{\{official_terms:last\}\}/g, () => {
      const terms = save.worldState.official_terms;
      return Array.isArray(terms) ? terms.at(-1) ?? '尚未命名' : '尚未命名';
    })
    .replace('{{history:evaluation}}', generateHistoricalEvaluation(save));
}
