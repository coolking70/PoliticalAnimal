export type Primitive = number | boolean | string | string[];
export type WorldState = Record<string, Primitive>;

export type Operator =
  | '==' | '!=' | '>' | '>=' | '<' | '<='
  | 'contains' | 'not_contains' | 'exists';

export interface LeafCondition {
  field: string;
  operator: Operator;
  value?: Primitive;
  scope?: 'world' | 'memory' | 'debt';
}

export interface ConditionGroup {
  all?: Condition[];
  any?: Condition[];
}

export type Condition = LeafCondition | ConditionGroup;

export interface Effect {
  field: string;
  operation: 'set' | 'increment' | 'decrement' | 'push';
  value: Primitive;
}

export interface Choice {
  id: string;
  label: string;
  response: string;
  effects: Effect[];
  memories?: MemoryTemplate[];
  debts?: DebtTemplate[];
  debtActions?: DebtAction[];
  requirements?: Condition[];
}

export interface MemoryTemplate {
  speaker: string;
  topic: string;
  statement: string;
  public: boolean;
  importance: number;
  tags: string[];
}

export interface PoliticalMemory extends MemoryTemplate {
  id: string;
  createdAtTurn: number;
  sourceEvent: string;
  active: boolean;
}

export interface DebtTemplate {
  creditor: string | string[];
  type: string;
  topic: string;
  strength: number;
  pressure: number;
  description: string;
  tags: string[];
}

export interface PoliticalDebt extends DebtTemplate {
  id: string;
  sourceEvent: string;
  createdAtTurn: number;
  status: 'active' | 'paid' | 'broken' | 'expired';
}

export interface DebtAction {
  action: 'resolve' | 'break';
  topic: string;
}

export interface GameEvent {
  id: string;
  title: string;
  type: 'core' | 'reactive' | 'ambient' | 'debt' | 'ending';
  thread: string[];
  priority: number;
  weight: number;
  once: boolean;
  requirements?: Condition[];
  blockers?: Condition[];
  actor: string;
  actorEmoji: string;
  scene: string;
  choices: Choice[];
}

export interface HistoryEntry {
  turn: number;
  eventId: string;
  title: string;
  choiceId: string;
  choiceLabel: string;
  response: string;
}

export interface GameSave {
  saveVersion: 2;
  engineVersion: '0.2.0';
  scenario: 'education_demo';
  seed: number;
  rngState: number;
  turn: number;
  worldState: WorldState;
  history: HistoryEntry[];
  memories: PoliticalMemory[];
  debts: PoliticalDebt[];
  completedEvents: string[];
  currentEventId: string;
}

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  opening: string;
  initialState: WorldState;
}
