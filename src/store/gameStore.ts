import scenarioJson from '../../content/education-demo/scenario.json';
import eventsJson from '../../content/education-demo/events/events.json';
import type { Choice, GameEvent, GameSave, Scenario } from '../models/game';
import { applyEffects } from '../engine/effectExecutor';
import { eligibleEvents, selectEvent } from '../engine/eventSelector';
import { normalizeSeed } from '../engine/rng';
import { addMemory } from '../engine/memoryEngine';
import { advanceDebtPressure, applyDebtActions, createDebt } from '../engine/debtEngine';
import { renderNarrativeTemplate } from '../engine/historyEngine';
import { allConditionsMatch } from '../engine/conditionEvaluator';

export const scenario = scenarioJson as Scenario;
export const events = eventsJson as GameEvent[];

export function createGame(seed: number): GameSave {
  const rngState = normalizeSeed(seed);
  const selected = selectEvent(events, scenario.initialState, [], rngState);
  if (!selected.event) throw new Error('场景没有合法的开场事件');
  return {
    saveVersion: 2,
    engineVersion: '0.2.0',
    scenario: 'education_demo',
    seed: normalizeSeed(seed),
    rngState: selected.rngState,
    turn: 0,
    worldState: structuredClone(scenario.initialState),
    history: [],
    memories: [],
    debts: [],
    completedEvents: [],
    currentEventId: selected.event.id,
  };
}

export function choose(save: GameSave, choice: Choice): GameSave {
  const current = events.find((event) => event.id === save.currentEventId);
  if (!current) throw new Error(`找不到当前事件：${save.currentEventId}`);

  const worldState = applyEffects(save.worldState, choice.effects);
  let memories = save.memories;
  for (const [index, template] of (choice.memories ?? []).entries()) {
    memories = addMemory(memories, template, current.id, save.turn + 1, index);
  }
  let debts = applyDebtActions(advanceDebtPressure(save.debts), choice.debtActions);
  for (const [index, template] of (choice.debts ?? []).entries()) {
    debts = createDebt(debts, template, current.id, save.turn + 1, index);
  }
  const completedEvents = [...save.completedEvents, current.id];
  const history = [...save.history, {
    turn: save.turn + 1,
    eventId: current.id,
    title: current.title,
    choiceId: choice.id,
    choiceLabel: choice.label,
    response: choice.response,
  }];
  const selected = selectEvent(events, worldState, completedEvents, save.rngState, memories, debts);
  if (!selected.event) throw new Error('剧情进入死路：没有合法事件');

  return {
    ...save,
    turn: save.turn + 1,
    rngState: selected.rngState,
    worldState,
    history,
    memories,
    debts,
    completedEvents,
    currentEventId: selected.event.id,
  };
}

export function getCurrentEvent(save: GameSave): GameEvent {
  const event = events.find((item) => item.id === save.currentEventId);
  if (!event) throw new Error(`事件 ${save.currentEventId} 不存在`);
  return {
    ...event,
    scene: renderNarrativeTemplate(event.scene, save),
    choices: event.choices.filter((choice) => allConditionsMatch(choice.requirements, save.worldState, save.memories, save.debts)),
  };
}

export function getEligible(save: GameSave): GameEvent[] {
  return eligibleEvents(events, save.worldState, save.completedEvents, save.memories, save.debts);
}
