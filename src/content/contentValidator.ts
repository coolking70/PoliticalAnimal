import type { Condition, GameEvent, ScenarioBundle, StateValueType } from '../models/game';

export interface ContentIssue {
  code: string;
  path: string;
  message: string;
}

const memoryFields = new Set(['id', 'createdAtTurn', 'sourceEvent', 'speaker', 'topic', 'statement', 'public', 'importance', 'tags', 'active']);
const debtFields = new Set(['id', 'sourceEvent', 'createdAtTurn', 'creditor', 'type', 'topic', 'strength', 'pressure', 'description', 'tags', 'status']);
const framingTypes = new Set(['newspaper', 'tv_news', 'government_memo', 'internal_memo']);

function valueMatchesType(value: unknown, type: StateValueType): boolean {
  if (type === 'string[]') return Array.isArray(value) && value.every((item) => typeof item === 'string');
  return typeof value === type;
}

function visitConditions(conditions: Condition[] | undefined, visit: (condition: Extract<Condition, { field: string }>) => void): void {
  for (const condition of conditions ?? []) {
    if ('field' in condition) visit(condition);
    else {
      visitConditions(condition.all, visit);
      visitConditions(condition.any, visit);
    }
  }
}

function duplicateValues(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

export function validateScenarioBundle(bundle: ScenarioBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const report = (code: string, path: string, message: string) => issues.push({ code, path, message });
  const actorIds = bundle.actors.map((actor) => actor.id);
  const institutionIds = bundle.institutions.map((institution) => institution.id);
  const eventIds = bundle.events.map((event) => event.id);
  const framingIds = bundle.framings.map((framing) => framing.id);
  const phaseIds = bundle.scenario.phases.map((phase) => phase.id);
  const stateFields = new Set(Object.keys(bundle.scenario.stateSchema));

  for (const id of duplicateValues(actorIds)) report('duplicate_actor', `actors.${id}`, `重复 actor id：${id}`);
  for (const id of duplicateValues(institutionIds)) report('duplicate_institution', `institutions.${id}`, `重复 institution id：${id}`);
  for (const id of duplicateValues(eventIds)) report('duplicate_event', `events.${id}`, `重复 event id：${id}`);
  for (const id of duplicateValues(framingIds)) report('duplicate_framing', `framings.${id}`, `重复 framing id：${id}`);
  for (const id of duplicateValues(phaseIds)) report('duplicate_phase', `scenario.phases.${id}`, `重复 phase id：${id}`);

  for (const actor of bundle.actors) {
    if (actor.institutionId && !institutionIds.includes(actor.institutionId)) {
      report('unknown_actor_institution', `actors.${actor.id}.institutionId`, `未知 institution：${actor.institutionId}`);
    }
  }
  for (const [field, type] of Object.entries(bundle.scenario.stateSchema)) {
    if (!(field in bundle.scenario.initialState)) report('missing_initial_state', `scenario.initialState.${field}`, `基础字段缺少初始值：${field}`);
    else if (!valueMatchesType(bundle.scenario.initialState[field], type)) report('invalid_initial_type', `scenario.initialState.${field}`, `${field} 应为 ${type}`);
  }
  for (const field of Object.keys(bundle.scenario.initialState)) {
    if (!stateFields.has(field)) report('unknown_initial_field', `scenario.initialState.${field}`, `initialState 字段未在 stateSchema 声明：${field}`);
  }

  const phaseIndex = new Map(phaseIds.map((id, index) => [id, index]));
  const dependencyGraph = new Map<string, string[]>();
  const checkCondition = (condition: Extract<Condition, { field: string }>, conditionPath: string) => {
    if (condition.scope === 'memory' && !memoryFields.has(condition.field)) report('unknown_memory_field', conditionPath, `未知 Memory 字段：${condition.field}`);
    else if (condition.scope === 'debt' && !debtFields.has(condition.field)) report('unknown_debt_field', conditionPath, `未知 Debt 字段：${condition.field}`);
    else if (!condition.scope && !stateFields.has(condition.field)) report('unknown_state_field', conditionPath, `未知 World State 字段：${condition.field}`);
    else if (!condition.scope) {
      const type = bundle.scenario.stateSchema[condition.field];
      if (['>', '>=', '<', '<='].includes(condition.operator) && type !== 'number') report('invalid_numeric_condition', conditionPath, `数值比较用于非 number 字段：${condition.field}`);
      if (['contains', 'not_contains'].includes(condition.operator) && type !== 'string[]') report('invalid_contains_condition', conditionPath, `contains 用于非 string[] 字段：${condition.field}`);
    }
  };
  for (const event of bundle.events) {
    const path = `events.${event.id}`;
    if (!actorIds.includes(event.actorId)) report('unknown_actor', `${path}.actorId`, `未知 actor：${event.actorId}`);
    if (!institutionIds.includes(event.institutionId)) report('unknown_institution', `${path}.institutionId`, `未知 institution：${event.institutionId}`);
    const actor = bundle.actors.find((item) => item.id === event.actorId);
    if (actor?.institutionId && actor.institutionId !== event.institutionId) {
      report('actor_institution_mismatch', path, `actor ${event.actorId} 不属于 institution ${event.institutionId}`);
    }
    if (!phaseIndex.has(event.phase)) report('unknown_phase', `${path}.phase`, `未知 phase：${event.phase}`);
    if (!event.choices.length) report('no_choices', `${path}.choices`, '事件没有选项');
    for (const id of duplicateValues(event.choices.map((choice) => choice.id))) report('duplicate_choice', `${path}.choices.${id}`, `重复 choice id：${id}`);

    const dependencies = [...(event.after ?? []), ...(event.afterAny ?? [])];
    dependencyGraph.set(event.id, dependencies);
    for (const reference of dependencies) {
      const target = bundle.events.find((item) => item.id === reference);
      if (!target) report('unknown_event_reference', path, `引用不存在的事件：${reference}`);
      if (reference === event.id) report('self_reference', path, '事件不能依赖自身');
      if (target && (phaseIndex.get(target.phase) ?? 0) > (phaseIndex.get(event.phase) ?? 0)) {
        report('future_phase_reference', path, `事件依赖未来阶段事件：${reference}`);
      }
    }
    for (const reference of duplicateValues(dependencies)) report('duplicate_event_reference', path, `重复事件引用：${reference}`);

    visitConditions(event.requirements, (condition) => checkCondition(condition, `${path}.requirements`));
    visitConditions(event.blockers, (condition) => checkCondition(condition, `${path}.blockers`));
    for (const field of event.urgencyFields ?? []) {
      if (!stateFields.has(field)) report('unknown_urgency_field', `${path}.urgencyFields`, `未知 urgency 字段：${field}`);
      else if (bundle.scenario.stateSchema[field] !== 'number') report('non_numeric_urgency_field', `${path}.urgencyFields`, `urgency 字段必须是 number：${field}`);
    }
    for (const choice of event.choices) {
      const choicePath = `${path}.choices.${choice.id}`;
      visitConditions(choice.requirements, (condition) => checkCondition(condition, `${choicePath}.requirements`));
      for (const effect of choice.effects) {
        if (!stateFields.has(effect.field)) report('unknown_effect_field', `${choicePath}.effects`, `未知 Effect 字段：${effect.field}`);
        else {
          const type = bundle.scenario.stateSchema[effect.field];
          if (['increment', 'decrement'].includes(effect.operation) && type !== 'number') report('invalid_numeric_effect', `${choicePath}.effects`, `数值 Effect 用于非 number 字段：${effect.field}`);
          if (effect.operation === 'push' && type !== 'string[]') report('invalid_push_effect', `${choicePath}.effects`, `push 用于非 string[] 字段：${effect.field}`);
          if (effect.operation === 'set' && !valueMatchesType(effect.value, type)) report('invalid_set_type', `${choicePath}.effects`, `${effect.field} 的 set 值类型不匹配 ${type}`);
        }
      }
    }
  }

  const checkTemplate = (template: string | undefined, path: string) => {
    for (const match of template?.matchAll(/\{\{([^}]+)\}\}/g) ?? []) {
      const [scope, key, field] = match[1].split(':');
      if (scope === 'state' && !stateFields.has(key)) report('unknown_framing_state_field', path, `Framing 引用未知 World State：${key}`);
      else if (scope === 'memory' && field && !memoryFields.has(field)) report('unknown_framing_memory_field', path, `Framing 引用未知 Memory 字段：${field}`);
      else if (scope === 'debt' && field && !debtFields.has(field)) report('unknown_framing_debt_field', path, `Framing 引用未知 Debt 字段：${field}`);
      else if (scope === 'choice' && !['id', 'label', 'response'].includes(key)) report('unknown_framing_choice_field', path, `Framing 引用未知 Choice 字段：${key}`);
      else if (scope === 'official_terms' && key !== 'last') report('unknown_framing_official_terms', path, `Framing 引用非法 official_terms 选择器：${key}`);
      else if (!['state', 'memory', 'debt', 'choice', 'official_terms', 'history'].includes(scope)) report('unknown_framing_template_scope', path, `Framing 引用未知模板 scope：${scope}`);
      else if (scope === 'history' && key !== 'evaluation') report('unknown_framing_history_field', path, `Framing 引用未知 History 字段：${key}`);
    }
  };
  for (const framing of bundle.framings) {
    const path = `framings.${framing.id}`;
    const event = bundle.events.find((item) => item.id === framing.eventId);
    if (!event) report('unknown_framing_event', `${path}.eventId`, `Framing 引用未知 event：${framing.eventId}`);
    if (!framingTypes.has(framing.type)) report('unknown_framing_type', `${path}.type`, `未知 framing type：${framing.type}`);
    if (!framing.source.actorId && !framing.source.institutionId && !framing.source.label) report('missing_framing_source', `${path}.source`, 'Framing 缺少来源');
    if (framing.source.actorId && !actorIds.includes(framing.source.actorId)) report('unknown_framing_actor', `${path}.source.actorId`, `Framing 引用未知 actor：${framing.source.actorId}`);
    if (framing.source.institutionId && !institutionIds.includes(framing.source.institutionId)) report('unknown_framing_institution', `${path}.source.institutionId`, `Framing 引用未知 institution：${framing.source.institutionId}`);
    for (const id of duplicateValues(framing.choiceIds ?? [])) report('duplicate_framing_choice_reference', `${path}.choiceIds`, `Framing 重复引用 choice：${id}`);
    for (const id of framing.choiceIds ?? []) if (event && !event.choices.some((choice) => choice.id === id)) report('unknown_framing_choice', `${path}.choiceIds`, `Framing 引用未知 choice：${id}`);
    visitConditions(framing.requirements, (condition) => checkCondition(condition, `${path}.requirements`));
    checkTemplate(framing.eyebrow, `${path}.eyebrow`);
    checkTemplate(framing.title, `${path}.title`);
    checkTemplate(framing.body, `${path}.body`);
    checkTemplate(framing.footer, `${path}.footer`);
  }
  for (const [index, evaluation] of (bundle.scenario.historyEvaluations ?? []).entries()) {
    const path = `scenario.historyEvaluations.${index}`;
    visitConditions(evaluation.requirements, (condition) => checkCondition(condition, `${path}.requirements`));
    checkTemplate(evaluation.text, `${path}.text`);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycle = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const cycle = (dependencyGraph.get(id) ?? []).some((dependency) => eventIds.includes(dependency) && hasCycle(dependency));
    visiting.delete(id);
    visited.add(id);
    return cycle;
  };
  for (const id of eventIds) if (hasCycle(id)) report('dependency_cycle', `events.${id}`, '事件依赖图存在循环');
  for (const phase of phaseIds) {
    if (!bundle.events.some((event) => event.phase === phase)) report('empty_phase', `scenario.phases.${phase}`, `阶段没有事件：${phase}`);
  }
  if (!bundle.events.some((event) => event.type === 'ending')) report('missing_ending', 'events', '剧本没有 ending 事件');
  const finalPhase = phaseIds.at(-1);
  if (finalPhase && !bundle.events.some((event) => event.phase === finalPhase && event.type === 'ending')) {
    report('unreachable_ending_phase', `scenario.phases.${finalPhase}`, '最终阶段没有 ending 事件，剧情会明显死路');
  }
  return issues;
}
