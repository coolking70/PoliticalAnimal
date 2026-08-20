import type { Choice, GameSave, ResolvedGameEvent, ScenarioBundle, WorldState } from '../models/game';
import { applyEffects } from '../engine/effectExecutor';
import { eligibleEvents, scoreEvents, selectEvent } from '../engine/eventSelector';
import { normalizeSeed } from '../engine/rng';
import { addMemory } from '../engine/memoryEngine';
import { advanceDebtPressure, applyDebtActions, createDebt } from '../engine/debtEngine';
import { renderNarrativeTemplate } from '../engine/historyEngine';
import { allConditionsMatch } from '../engine/conditionEvaluator';
import { defaultScenarioId, getScenarioBundle } from '../content/scenarioRegistry';

export const scenario = getScenarioBundle(defaultScenarioId).scenario;
export const events = getScenarioBundle(defaultScenarioId).events;

function advancePhase(
  bundle: ScenarioBundle,
  state: WorldState,
  completedEvents: string[],
  memories: GameSave['memories'],
  debts: GameSave['debts'],
): WorldState {
  const next = structuredClone(state);
  for (let guard = 0; guard < bundle.scenario.phases.length; guard += 1) {
    const currentIndex = bundle.scenario.phases.findIndex((phase) => phase.id === next.phase);
    if (currentIndex < 0) throw new Error(`未知剧情阶段：${String(next.phase)}`);
    if (eligibleEvents(bundle.events, next, completedEvents, memories, debts).length) return next;
    if (currentIndex === bundle.scenario.phases.length - 1) return next;
    next.phase = bundle.scenario.phases[currentIndex + 1].id;
  }
  return next;
}

export function createGame(seed: number, scenarioId = defaultScenarioId): GameSave {
  const bundle = getScenarioBundle(scenarioId);
  const rngState = normalizeSeed(seed);
  const selected = selectEvent(bundle.events, bundle.scenario.initialState, [], rngState);
  if (!selected.event) throw new Error('场景没有合法的开场事件');
  return {
    saveVersion: 3,
    engineVersion: '0.3.0',
    scenarioId,
    status: 'playing',
    seed: normalizeSeed(seed),
    rngState: selected.rngState,
    turn: 0,
    worldState: structuredClone(bundle.scenario.initialState),
    history: [],
    memories: [],
    debts: [],
    completedEvents: [],
    currentEventId: selected.event.id,
  };
}

export function choose(save: GameSave, choice: Choice): GameSave {
  if (save.status !== 'playing' || !save.currentEventId) throw new Error('本局已经结束');
  const bundle = getScenarioBundle(save.scenarioId);
  const current = bundle.events.find((event) => event.id === save.currentEventId);
  if (!current) throw new Error(`找不到当前事件：${save.currentEventId}`);

  let worldState = applyEffects(save.worldState, choice.effects);
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
    threads: current.thread,
  }];
  const base = { ...save, turn: save.turn + 1, worldState, history, memories, debts, completedEvents };
  if (current.type === 'ending') return { ...base, status: 'completed', currentEventId: null };

  worldState = advancePhase(bundle, worldState, completedEvents, memories, debts);
  const selected = selectEvent(bundle.events, worldState, completedEvents, save.rngState, memories, debts, history);
  if (!selected.event) throw new Error(`剧情在 ${String(worldState.phase)} 阶段进入死路：没有合法事件`);
  return { ...base, rngState: selected.rngState, worldState, currentEventId: selected.event.id };
}

export function getCurrentEvent(save: GameSave): ResolvedGameEvent | null {
  if (!save.currentEventId) return null;
  const bundle = getScenarioBundle(save.scenarioId);
  const event = bundle.events.find((item) => item.id === save.currentEventId);
  if (!event) throw new Error(`事件 ${save.currentEventId} 不存在`);
  const actor = bundle.actors.find((item) => item.id === event.actorId);
  const institution = bundle.institutions.find((item) => item.id === event.institutionId);
  if (!actor || !institution) throw new Error(`事件 ${event.id} 的角色或机构引用无效`);
  return {
    ...event,
    actorName: actor.name,
    actorEmoji: actor.emoji,
    actorRole: actor.role,
    institutionName: institution.name,
    scene: renderNarrativeTemplate(event.scene, save),
    choices: event.choices.filter((choice) => allConditionsMatch(choice.requirements, save.worldState, save.memories, save.debts)),
  };
}

export function getEligible(save: GameSave) {
  const bundle = getScenarioBundle(save.scenarioId);
  return eligibleEvents(bundle.events, save.worldState, save.completedEvents, save.memories, save.debts);
}

export function getWeightedCandidates(save: GameSave) {
  const bundle = getScenarioBundle(save.scenarioId);
  return scoreEvents(getEligible(save), save.worldState, save.memories, save.debts, save.history);
}
