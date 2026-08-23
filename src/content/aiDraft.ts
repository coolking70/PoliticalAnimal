import type {
  Actor,
  Choice,
  GameEvent,
  Institution,
  NarrativeFraming,
  Scenario,
  ScenarioBundle,
} from '../models/game';

export interface AiScenarioDraft {
  draftVersion?: 1;
  contentDirectory?: string;
  scenario: Partial<Scenario>;
  actors?: Partial<Actor>[];
  institutions?: Partial<Institution>[];
  events?: Array<Partial<GameEvent> & { choices?: Partial<Choice>[] }>;
  framings?: Partial<NarrativeFraming>[];
}

export interface NormalizedAiDraft {
  contentDirectory: string;
  bundle: ScenarioBundle;
}

export class AiDraftFormatError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`AI Draft 格式错误：\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
    this.problems = problems;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(source: Record<string, unknown>, key: string, path: string, problems: string[]): string {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim()) {
    problems.push(`${path}.${key} 必须是非空字符串`);
    return '';
  }
  return value;
}

function requiredArray(source: Record<string, unknown>, key: string, path: string, problems: string[]): unknown[] {
  const value = source[key];
  if (!Array.isArray(value) || !value.length) {
    problems.push(`${path}.${key} 必须是非空数组`);
    return [];
  }
  return value;
}

function optionalArray(source: Record<string, unknown>, key: string, path: string, problems: string[]): unknown[] | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    problems.push(`${path}.${key} 必须是数组`);
    return [];
  }
  return value;
}

function optionalStringArray(source: Record<string, unknown>, key: string, path: string, problems: string[]): string[] | undefined {
  const value = optionalArray(source, key, path, problems);
  if (!value) return undefined;
  if (value.some((item) => typeof item !== 'string')) problems.push(`${path}.${key} 的每一项都必须是字符串`);
  return value.filter((item): item is string => typeof item === 'string');
}

function optionalRecordArray(source: Record<string, unknown>, key: string, path: string, problems: string[]): Record<string, unknown>[] | undefined {
  const value = optionalArray(source, key, path, problems);
  if (!value) return undefined;
  if (value.some((item) => !isRecord(item))) problems.push(`${path}.${key} 的每一项都必须是对象`);
  return value.filter(isRecord);
}

function normalizeActor(value: unknown, index: number, problems: string[]): Actor {
  const path = `actors[${index}]`;
  if (!isRecord(value)) problems.push(`${path} 必须是对象`);
  const source = isRecord(value) ? value : {};
  return {
    ...source,
    id: requiredString(source, 'id', path, problems),
    name: requiredString(source, 'name', path, problems),
    species: typeof source.species === 'string' && source.species ? source.species : 'unknown',
    emoji: typeof source.emoji === 'string' && source.emoji ? source.emoji : '◆',
    role: typeof source.role === 'string' && source.role ? source.role : '未说明身份',
  } as Actor;
}

function normalizeInstitution(value: unknown, index: number, problems: string[]): Institution {
  const path = `institutions[${index}]`;
  if (!isRecord(value)) problems.push(`${path} 必须是对象`);
  const source = isRecord(value) ? value : {};
  return {
    ...source,
    id: requiredString(source, 'id', path, problems),
    name: requiredString(source, 'name', path, problems),
    mission: typeof source.mission === 'string' && source.mission ? source.mission : '未说明',
    institutional_interest: typeof source.institutional_interest === 'string' && source.institutional_interest
      ? source.institutional_interest
      : '未说明',
  } as Institution;
}

function normalizeChoice(value: unknown, eventIndex: number, choiceIndex: number, problems: string[]): Choice {
  const path = `events[${eventIndex}].choices[${choiceIndex}]`;
  if (!isRecord(value)) problems.push(`${path} 必须是对象`);
  const source = isRecord(value) ? value : {};
  const effects = optionalRecordArray(source, 'effects', path, problems) ?? [];
  const requirements = optionalRecordArray(source, 'requirements', path, problems);
  const memories = optionalRecordArray(source, 'memories', path, problems);
  const debts = optionalRecordArray(source, 'debts', path, problems);
  const debtActions = optionalRecordArray(source, 'debtActions', path, problems);
  return {
    ...source,
    id: requiredString(source, 'id', path, problems),
    label: requiredString(source, 'label', path, problems),
    response: requiredString(source, 'response', path, problems),
    effects,
    requirements,
    memories,
    debts,
    debtActions,
  } as unknown as Choice;
}

function normalizeEvent(value: unknown, index: number, problems: string[]): GameEvent {
  const path = `events[${index}]`;
  if (!isRecord(value)) problems.push(`${path} 必须是对象`);
  const source = isRecord(value) ? value : {};
  const choices = requiredArray(source, 'choices', path, problems)
    .map((choice, choiceIndex) => normalizeChoice(choice, index, choiceIndex, problems));
  const after = optionalStringArray(source, 'after', path, problems);
  const afterAny = optionalStringArray(source, 'afterAny', path, problems);
  const requirements = optionalRecordArray(source, 'requirements', path, problems);
  const blockers = optionalRecordArray(source, 'blockers', path, problems);
  const debtTopics = optionalStringArray(source, 'debtTopics', path, problems);
  const memoryTopics = optionalStringArray(source, 'memoryTopics', path, problems);
  const urgencyFields = optionalStringArray(source, 'urgencyFields', path, problems);
  return {
    ...source,
    id: requiredString(source, 'id', path, problems),
    title: requiredString(source, 'title', path, problems),
    type: typeof source.type === 'string' ? source.type : 'core',
    thread: Array.isArray(source.thread) ? source.thread : [],
    priority: typeof source.priority === 'number' ? source.priority : 100,
    weight: typeof source.weight === 'number' ? source.weight : 1,
    once: typeof source.once === 'boolean' ? source.once : true,
    phase: requiredString(source, 'phase', path, problems),
    actorId: requiredString(source, 'actorId', path, problems),
    institutionId: requiredString(source, 'institutionId', path, problems),
    scene: requiredString(source, 'scene', path, problems),
    after,
    afterAny,
    requirements,
    blockers,
    debtTopics,
    memoryTopics,
    urgencyFields,
    choices,
  } as unknown as GameEvent;
}

function normalizeFraming(value: unknown, index: number, problems: string[]): NarrativeFraming {
  const path = `framings[${index}]`;
  if (!isRecord(value)) problems.push(`${path} 必须是对象`);
  const source = isRecord(value) ? value : {};
  if (!isRecord(source.source)) problems.push(`${path}.source 必须是对象`);
  const choiceIds = optionalStringArray(source, 'choiceIds', path, problems);
  const requirements = optionalRecordArray(source, 'requirements', path, problems);
  return {
    ...source,
    id: requiredString(source, 'id', path, problems),
    eventId: requiredString(source, 'eventId', path, problems),
    type: requiredString(source, 'type', path, problems),
    stance: requiredString(source, 'stance', path, problems),
    source: isRecord(source.source) ? source.source : {},
    choiceIds,
    requirements,
    title: requiredString(source, 'title', path, problems),
    body: requiredString(source, 'body', path, problems),
  } as unknown as NarrativeFraming;
}

export function normalizeAiDraft(input: unknown): NormalizedAiDraft {
  const problems: string[] = [];
  if (!isRecord(input)) throw new AiDraftFormatError(['根节点必须是对象']);
  if (input.draftVersion !== undefined && input.draftVersion !== 1) problems.push('draftVersion 目前只支持 1');
  if (!isRecord(input.scenario)) problems.push('scenario 必须是对象');
  const source = isRecord(input.scenario) ? input.scenario : {};
  const scenarioId = requiredString(source, 'id', 'scenario', problems);
  const phases = requiredArray(source, 'phases', 'scenario', problems);
  const stateSchema = isRecord(source.stateSchema) ? source.stateSchema : {};
  const initialState = isRecord(source.initialState) ? source.initialState : {};
  if (!isRecord(source.stateSchema)) problems.push('scenario.stateSchema 必须是对象');
  if (!isRecord(source.initialState)) problems.push('scenario.initialState 必须是对象');

  const scenario = {
    ...source,
    id: scenarioId,
    title: requiredString(source, 'title', 'scenario', problems),
    subtitle: typeof source.subtitle === 'string' && source.subtitle ? source.subtitle : 'AI 内容管线试作',
    playerRole: requiredString(source, 'playerRole', 'scenario', problems),
    workspaceLabel: requiredString(source, 'workspaceLabel', 'scenario', problems),
    opening: requiredString(source, 'opening', 'scenario', problems),
    phases,
    stateSchema,
    initialState,
    historyEvaluations: optionalRecordArray(source, 'historyEvaluations', 'scenario', problems),
  } as Scenario;

  const directory = typeof input.contentDirectory === 'string' && input.contentDirectory
    ? input.contentDirectory
    : scenarioId.replaceAll('_', '-');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(directory)) {
    problems.push('contentDirectory 必须是小写字母、数字和单连字符组成的安全目录名');
  }

  const actors = requiredArray(input, 'actors', 'draft', problems).map((actor, index) => normalizeActor(actor, index, problems));
  const institutions = requiredArray(input, 'institutions', 'draft', problems)
    .map((institution, index) => normalizeInstitution(institution, index, problems));
  const events = requiredArray(input, 'events', 'draft', problems).map((event, index) => normalizeEvent(event, index, problems));
  const framings = (Array.isArray(input.framings) ? input.framings : [])
    .map((framing, index) => normalizeFraming(framing, index, problems));

  if (problems.length) throw new AiDraftFormatError(problems);
  return { contentDirectory: directory, bundle: { scenario, actors, institutions, events, framings } };
}
