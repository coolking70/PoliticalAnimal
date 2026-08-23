import type { Condition, GameEvent, ScenarioBundle, StateValueType } from '../models/game';

export interface ContentIssue {
  code: string;
  path: string;
  message: string;
}

const memoryFields = new Set(['id', 'createdAtTurn', 'sourceEvent', 'speaker', 'topic', 'statement', 'public', 'importance', 'tags', 'active']);
const debtFields = new Set(['id', 'sourceEvent', 'createdAtTurn', 'creditor', 'type', 'topic', 'strength', 'pressure', 'description', 'tags', 'status']);
const framingTypes = new Set(['newspaper', 'tv_news', 'government_memo', 'internal_memo']);
const framingStances = new Set(['government', 'media', 'opposition', 'institution', 'foreign_observer']);
const eventTypes = new Set(['core', 'reactive', 'ambient', 'debt', 'ending']);
const conditionOperators = new Set(['==', '!=', '>', '>=', '<', '<=', 'contains', 'not_contains', 'exists']);
const effectOperations = new Set(['set', 'increment', 'decrement', 'push']);
const debtActions = new Set(['resolve', 'break']);
const idPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const machineEnumPattern = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;

function valueMatchesType(value: unknown, type: StateValueType): boolean {
  if (type === 'string[]') return Array.isArray(value) && value.every((item) => typeof item === 'string');
  return typeof value === type;
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
  const playerFacingStateFields = new Set<string>();

  const checkId = (id: string, path: string) => {
    if (!idPattern.test(id)) report('invalid_id', path, `ID 必须以字母开头，且只能包含字母、数字、下划线或连字符：${id}`);
  };

  checkId(bundle.scenario.id, 'scenario.id');
  for (const actor of bundle.actors) checkId(actor.id, `actors.${actor.id || '<empty>'}.id`);
  for (const institution of bundle.institutions) checkId(institution.id, `institutions.${institution.id || '<empty>'}.id`);
  for (const event of bundle.events) checkId(event.id, `events.${event.id || '<empty>'}.id`);
  for (const framing of bundle.framings) checkId(framing.id, `framings.${framing.id || '<empty>'}.id`);
  for (const phase of bundle.scenario.phases) checkId(phase.id, `scenario.phases.${phase.id || '<empty>'}.id`);

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
  for (const field of Object.keys(bundle.scenario.playerDisplay?.fields ?? {})) {
    if (!stateFields.has(field) && !field.startsWith('debt.') && !field.startsWith('memory.') && !field.startsWith('choice.')) {
      report('unknown_player_display_field', `scenario.playerDisplay.fields.${field}`, `玩家显示映射引用未知字段：${field}`);
    }
  }

  const phaseIndex = new Map(phaseIds.map((id, index) => [id, index]));
  const dependencyGraph = new Map<string, string[]>();
  const checkCondition = (condition: Extract<Condition, { field: string }>, conditionPath: string) => {
    if (!conditionOperators.has(condition.operator)) report('unknown_condition_operator', conditionPath, `未知 Condition operator：${condition.operator}`);
    if (condition.scope && !['world', 'memory', 'debt'].includes(condition.scope)) report('unknown_condition_scope', conditionPath, `未知 Condition scope：${condition.scope}`);
    if (condition.scope === 'memory' && !memoryFields.has(condition.field)) report('unknown_memory_field', conditionPath, `未知 Memory 字段：${condition.field}`);
    else if (condition.scope === 'debt' && !debtFields.has(condition.field)) report('unknown_debt_field', conditionPath, `未知 Debt 字段：${condition.field}`);
    else if ((!condition.scope || condition.scope === 'world') && !stateFields.has(condition.field)) report('unknown_state_field', conditionPath, `未知 World State 字段：${condition.field}`);
    else if (!condition.scope || condition.scope === 'world') {
      const type = bundle.scenario.stateSchema[condition.field];
      if (['>', '>=', '<', '<='].includes(condition.operator) && type !== 'number') report('invalid_numeric_condition', conditionPath, `数值比较用于非 number 字段：${condition.field}`);
      if (['contains', 'not_contains'].includes(condition.operator) && type !== 'string[]') report('invalid_contains_condition', conditionPath, `contains 用于非 string[] 字段：${condition.field}`);
    }
  };
  const checkConditionList = (conditions: unknown, conditionPath: string): void => {
    if (conditions === undefined) return;
    if (!Array.isArray(conditions)) {
      report('invalid_condition_container', conditionPath, 'Condition 容器必须是数组');
      return;
    }
    for (const [index, condition] of conditions.entries()) {
      const path = `${conditionPath}.${index}`;
      if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
        report('invalid_condition', path, 'Condition 必须是对象');
        continue;
      }
      if ('field' in condition) {
        if (typeof condition.field !== 'string') report('invalid_condition', path, 'Condition field 必须是字符串');
        else checkCondition(condition as Extract<Condition, { field: string }>, path);
        continue;
      }
      const composite = condition as { all?: unknown; any?: unknown };
      if (!('all' in composite) && !('any' in composite)) {
        report('invalid_condition', path, 'Condition 必须包含 field、all 或 any');
        continue;
      }
      if ('all' in composite) checkConditionList(composite.all, `${path}.all`);
      if ('any' in composite) checkConditionList(composite.any, `${path}.any`);
    }
  };
  for (const event of bundle.events) {
    const path = `events.${event.id}`;
    if (!eventTypes.has(event.type)) report('unknown_event_type', `${path}.type`, `未知 event type：${event.type}`);
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

    checkConditionList(event.requirements, `${path}.requirements`);
    checkConditionList(event.blockers, `${path}.blockers`);
    for (const field of event.urgencyFields ?? []) {
      if (!stateFields.has(field)) report('unknown_urgency_field', `${path}.urgencyFields`, `未知 urgency 字段：${field}`);
      else if (bundle.scenario.stateSchema[field] !== 'number') report('non_numeric_urgency_field', `${path}.urgencyFields`, `urgency 字段必须是 number：${field}`);
    }
    for (const choice of event.choices) {
      const choicePath = `${path}.choices.${choice.id}`;
      checkConditionList(choice.requirements, `${choicePath}.requirements`);
      for (const effect of choice.effects) {
        if (!effectOperations.has(effect.operation)) report('unknown_effect_operation', `${choicePath}.effects`, `未知 Effect operation：${effect.operation}`);
        if (!stateFields.has(effect.field)) report('unknown_effect_field', `${choicePath}.effects`, `未知 Effect 字段：${effect.field}`);
        else {
          const type = bundle.scenario.stateSchema[effect.field];
          if (['increment', 'decrement'].includes(effect.operation) && type !== 'number') report('invalid_numeric_effect', `${choicePath}.effects`, `数值 Effect 用于非 number 字段：${effect.field}`);
          if (effect.operation === 'push' && type !== 'string[]') report('invalid_push_effect', `${choicePath}.effects`, `push 用于非 string[] 字段：${effect.field}`);
          if (effect.operation === 'set' && !valueMatchesType(effect.value, type)) report('invalid_set_type', `${choicePath}.effects`, `${effect.field} 的 set 值类型不匹配 ${type}`);
        }
      }
      for (const memory of choice.memories ?? []) {
        if (!actorIds.includes(memory.speaker)) report('unknown_memory_speaker', `${choicePath}.memories`, `Memory speaker 不是已知 actor：${memory.speaker}`);
        if (!memory.topic || !memory.statement) report('invalid_memory_template', `${choicePath}.memories`, 'Memory 必须包含 topic 与 statement');
        if (typeof memory.public !== 'boolean' || typeof memory.importance !== 'number' || !Array.isArray(memory.tags)) report('invalid_memory_template', `${choicePath}.memories`, 'Memory 的 public / importance / tags 类型非法');
      }
      for (const debt of choice.debts ?? []) {
        if (!debt.topic || !debt.description) report('invalid_debt_template', `${choicePath}.debts`, 'Debt 必须包含 topic 与 description');
        if (!Number.isFinite(debt.strength) || debt.strength <= 0 || !Number.isFinite(debt.pressure) || debt.pressure < 0) report('invalid_debt_template', `${choicePath}.debts`, 'Debt strength 必须为正数，pressure 必须为非负数');
        if (!Array.isArray(debt.tags)) report('invalid_debt_template', `${choicePath}.debts`, 'Debt tags 必须是数组');
      }
      for (const action of choice.debtActions ?? []) {
        if (!debtActions.has(action.action) || !action.topic) report('invalid_debt_action', `${choicePath}.debtActions`, `非法 Debt action：${action.action}`);
      }
    }
  }

  const checkTemplate = (template: string | undefined, path: string) => {
    if (!template) return;
    const matchedRanges: Array<[number, number]> = [];
    for (const match of template?.matchAll(/\{\{([^}]+)\}\}/g) ?? []) {
      matchedRanges.push([match.index, match.index + match[0].length]);
      const [scope, key, field] = match[1].split(':');
      const partCount = match[1].split(':').length;
      if (scope === 'state' && partCount !== 2) report('invalid_template_variable', path, `state 模板格式应为 {{state:field}}：${match[0]}`);
      else if (scope === 'state' && !stateFields.has(key)) report('unknown_framing_state_field', path, `模板引用未知 World State：${key}`);
      else if (scope === 'state') playerFacingStateFields.add(key);
      else if (scope === 'memory' && ![2, 3].includes(partCount)) report('invalid_template_variable', path, `memory 模板格式非法：${match[0]}`);
      else if (scope === 'memory' && field && !memoryFields.has(field)) report('unknown_framing_memory_field', path, `Framing 引用未知 Memory 字段：${field}`);
      else if (scope === 'debt' && ![2, 3].includes(partCount)) report('invalid_template_variable', path, `debt 模板格式非法：${match[0]}`);
      else if (scope === 'debt' && field && !debtFields.has(field)) report('unknown_framing_debt_field', path, `Framing 引用未知 Debt 字段：${field}`);
      else if (scope === 'choice' && (partCount !== 2 || !['id', 'label', 'response'].includes(key))) report('unknown_framing_choice_field', path, `Framing 引用未知 Choice 字段：${key}`);
      else if (scope === 'official_terms' && (partCount !== 2 || key !== 'last')) report('unknown_framing_official_terms', path, `Framing 引用非法 official_terms 选择器：${key}`);
      else if (!['state', 'memory', 'debt', 'choice', 'official_terms', 'history'].includes(scope)) report('unknown_framing_template_scope', path, `Framing 引用未知模板 scope：${scope}`);
      else if (scope === 'history' && (partCount !== 2 || key !== 'evaluation')) report('unknown_framing_history_field', path, `Framing 引用未知 History 字段：${key}`);
    }
    const outsideTemplates = [...template].some((_, index) => {
      if (!template.startsWith('{{', index) && !template.startsWith('}}', index)) return false;
      return !matchedRanges.some(([start, end]) => index >= start && index < end);
    });
    if (outsideTemplates) report('malformed_template_variable', path, '模板包含未闭合或格式错误的 {{...}} 变量');
  };
  for (const event of bundle.events) {
    const path = `events.${event.id}`;
    checkTemplate(event.scene, `${path}.scene`);
    for (const choice of event.choices) {
      checkTemplate(choice.label, `${path}.choices.${choice.id}.label`);
      checkTemplate(choice.response, `${path}.choices.${choice.id}.response`);
    }
  }
  for (const framing of bundle.framings) {
    const path = `framings.${framing.id}`;
    const event = bundle.events.find((item) => item.id === framing.eventId);
    if (!event) report('unknown_framing_event', `${path}.eventId`, `Framing 引用未知 event：${framing.eventId}`);
    if (!framingTypes.has(framing.type)) report('unknown_framing_type', `${path}.type`, `未知 framing type：${framing.type}`);
    if (!framingStances.has(framing.stance)) report('unknown_framing_stance', `${path}.stance`, `未知 framing stance：${framing.stance}`);
    if (!framing.source.actorId && !framing.source.institutionId && !framing.source.label) report('missing_framing_source', `${path}.source`, 'Framing 缺少来源');
    if (framing.source.actorId && !actorIds.includes(framing.source.actorId)) report('unknown_framing_actor', `${path}.source.actorId`, `Framing 引用未知 actor：${framing.source.actorId}`);
    if (framing.source.institutionId && !institutionIds.includes(framing.source.institutionId)) report('unknown_framing_institution', `${path}.source.institutionId`, `Framing 引用未知 institution：${framing.source.institutionId}`);
    for (const id of duplicateValues(framing.choiceIds ?? [])) report('duplicate_framing_choice_reference', `${path}.choiceIds`, `Framing 重复引用 choice：${id}`);
    for (const id of framing.choiceIds ?? []) if (event && !event.choices.some((choice) => choice.id === id)) report('unknown_framing_choice', `${path}.choiceIds`, `Framing 引用未知 choice：${id}`);
    checkConditionList(framing.requirements, `${path}.requirements`);
    checkTemplate(framing.eyebrow, `${path}.eyebrow`);
    checkTemplate(framing.title, `${path}.title`);
    checkTemplate(framing.body, `${path}.body`);
    checkTemplate(framing.footer, `${path}.footer`);
  }
  for (const [index, evaluation] of (bundle.scenario.historyEvaluations ?? []).entries()) {
    const path = `scenario.historyEvaluations.${index}`;
    checkConditionList(evaluation.requirements, `${path}.requirements`);
    checkTemplate(evaluation.text, `${path}.text`);
  }

  for (const field of playerFacingStateFields) {
    const possibleValues = new Set<unknown>([bundle.scenario.initialState[field]]);
    for (const event of bundle.events) for (const choice of event.choices) {
      for (const effect of choice.effects) if (effect.field === field && effect.operation === 'set') possibleValues.add(effect.value);
    }
    for (const value of possibleValues) {
      if (typeof value !== 'string' || !machineEnumPattern.test(value)) continue;
      const mapped = bundle.scenario.playerDisplay?.fields?.[field]?.[value] ?? bundle.scenario.playerDisplay?.values?.[value];
      if (!mapped) report('missing_player_display_mapping', `scenario.playerDisplay.fields.${field}.${value}`, `玩家可见字段 ${field} 的机器枚举缺少显示映射：${value}`);
    }
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
  const firstPhase = phaseIds[0];
  if (firstPhase && !bundle.events.some((event) => event.phase === firstPhase && !(event.after?.length) && !(event.afterAny?.length))) {
    report('missing_opening_event', `scenario.phases.${firstPhase}`, '首阶段没有不依赖其他事件的开场事件');
  }
  if (!bundle.events.some((event) => event.type === 'ending')) report('missing_ending', 'events', '剧本没有 ending 事件');
  const finalPhase = phaseIds.at(-1);
  if (finalPhase && !bundle.events.some((event) => event.phase === finalPhase && event.type === 'ending')) {
    report('unreachable_ending_phase', `scenario.phases.${finalPhase}`, '最终阶段没有 ending 事件，剧情会明显死路');
  }
  const structurallyReachable = new Set<string>();
  for (let guard = 0; guard < bundle.events.length; guard += 1) {
    let changed = false;
    for (const event of bundle.events) {
      if (structurallyReachable.has(event.id)) continue;
      const afterReady = !event.after?.length || event.after.every((id) => structurallyReachable.has(id));
      const afterAnyReady = !event.afterAny?.length || event.afterAny.some((id) => structurallyReachable.has(id));
      if (afterReady && afterAnyReady) {
        structurallyReachable.add(event.id);
        changed = true;
      }
    }
    if (!changed) break;
  }
  if (bundle.events.some((event) => event.type === 'ending') && !bundle.events.some((event) => event.type === 'ending' && structurallyReachable.has(event.id))) {
    report('structurally_unreachable_ending', 'events', '所有 ending 都被依赖关系阻断，剧情存在明显死路');
  }
  return issues;
}
