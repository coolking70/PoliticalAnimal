import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../src/engine/conditionEvaluator';
import { applyEffects } from '../src/engine/effectExecutor';
import { selectEvent } from '../src/engine/eventSelector';
import { parseSave, serializeSave } from '../src/engine/saveEngine';
import { choose, createGame, events, getCurrentEvent, getEligible } from '../src/store/gameStore';
import { addMemory, findMemory, getPublicPromises } from '../src/engine/memoryEngine';
import { advanceDebtPressure, applyDebtActions, createDebt, getDebtIntensity, getDebtPressure, getDebtPressureCap } from '../src/engine/debtEngine';
import { defaultScenarioId, getScenarioBundle, listScenarioIds } from '../src/content/scenarioRegistry';

describe('condition and effect engines', () => {
  const state = { score: 2, tags: ['promise'], active: true };

  it('evaluates leaf and nested conditions without eval', () => {
    expect(evaluateCondition({ field: 'score', operator: '>=', value: 2 }, state)).toBe(true);
    expect(evaluateCondition({ field: 'tags', operator: 'contains', value: 'promise' }, state)).toBe(true);
    expect(evaluateCondition({ any: [
      { field: 'score', operator: '<', value: 0 },
      { field: 'active', operator: '==', value: true },
    ] }, state)).toBe(true);
  });

  it('applies effects immutably', () => {
    const original = { pressure: 1, terms: ['调整期'] };
    const next = applyEffects(original, [
      { field: 'pressure', operation: 'increment', value: 2 },
      { field: 'pressure', operation: 'decrement', value: 1 },
      { field: 'terms', operation: 'push', value: '深化阶段' },
      { field: 'active', operation: 'set', value: true },
    ]);
    expect(next).toEqual({ pressure: 2, terms: ['调整期', '深化阶段'], active: true });
    expect(original).toEqual({ pressure: 1, terms: ['调整期'] });
  });
});

describe('political memory and debt', () => {
  it('retrieves the most important semantic public promise', () => {
    let memories = addMemory([], {
      speaker: 'president', topic: 'education_principle', statement: '地方最了解自己的学生。',
      public: true, importance: 4, tags: ['promise', 'autonomy'],
    }, 'E01', 1);
    memories = addMemory(memories, {
      speaker: 'president', topic: 'education_principle', statement: '政府不能替大家定义思想。',
      public: true, importance: 5, tags: ['promise', 'freedom'],
    }, 'E02', 2);
    expect(findMemory(memories, 'education_principle')?.statement).toBe('政府不能替大家定义思想。');
    expect(getPublicPromises(memories)).toHaveLength(2);
  });

  it('uses strength for pressure caps, growth, and effective intensity', () => {
    let debts = createDebt([], {
      creditor: 'teachers_union', type: 'staffing_promise', topic: 'teacher_support',
      strength: 2, pressure: 1, description: '教师等待行政助理到岗。', tags: ['teachers'],
    }, 'E07', 7);
    expect(getDebtPressureCap(debts[0])).toBe(4);
    debts = advanceDebtPressure(debts);
    expect(debts[0].pressure).toBe(2);
    expect(getDebtIntensity(debts[0])).toBe(3);
    expect(getDebtPressure(debts, 'teacher_support')).toBe(3);
    debts = applyDebtActions(debts, [{ action: 'resolve', topic: 'teacher_support' }]);
    expect(debts[0].status).toBe('paid');
    expect(getDebtPressure(debts, 'teacher_support')).toBe(0);
  });
});

describe('reactive event selector', () => {
  it('exposes debt, memory, urgency, thread, and repetition weight components', () => {
    const debt = createDebt([], {
      creditor: 'teachers_union', type: 'staffing_promise', topic: 'teacher_support', strength: 4,
      pressure: 3, description: '教师等待支持。', tags: ['teachers'],
    }, 'E07', 7);
    const memory = addMemory([], {
      speaker: 'president', topic: 'education_principle', statement: '教育必须自由。', public: true,
      importance: 5, tags: ['promise'],
    }, 'E01', 1);
    const selected = selectEvent(
      events,
      { ...getScenarioBundle(defaultScenarioId).scenario.initialState, phase: 'backlash', teacher_unrest: 4, student_unrest: 3 },
      ['E01', 'E07', 'E11', 'E12', 'E15'],
      42,
      memory,
      debt,
      [{ turn: 1, eventId: 'E07', title: '教师行政负担', choiceId: 'A', choiceLabel: '减少表格', response: '', threads: ['Teachers'] }],
    );
    const strike = selected.weighted.find((candidate) => candidate.event.id === 'E16');
    const movement = selected.weighted.find((candidate) => candidate.event.id === 'E17');
    expect(strike?.debtBonus).toBeGreaterThan(0);
    expect(strike?.urgencyBonus).toBeGreaterThan(0);
    expect(strike?.repetitionPenalty).toBeGreaterThan(0);
    expect(movement?.memoryBonus).toBeGreaterThan(0);
    expect(movement?.threadBonus).toBeGreaterThan(0);
  });

  it('same seed and state remain deterministic', () => {
    const game = createGame(872631);
    const first = selectEvent(events, game.worldState, [], game.rngState);
    const second = selectEvent(events, game.worldState, [], game.rngState);
    expect(first.event?.id).toBe(second.event?.id);
    expect(first.rngState).toBe(second.rngState);
  });

  it('higher pressure strictly raises the related debt event weight', () => {
    const template = {
      creditor: 'teachers_union', type: 'staffing_promise', topic: 'teacher_support', strength: 4,
      description: '教师等待支持。', tags: ['teachers'],
    };
    const low = createDebt([], { ...template, pressure: 1 }, 'E07', 7);
    const high = createDebt([], { ...template, pressure: 7 }, 'E07', 7);
    const state = { ...getScenarioBundle(defaultScenarioId).scenario.initialState, phase: 'backlash', teacher_unrest: 4 };
    const completed = ['E01', 'E07', 'E11', 'E12', 'E15'];
    const lowWeight = selectEvent(events, state, completed, 5, [], low).weighted.find((item) => item.event.id === 'E16')!.finalWeight;
    const highWeight = selectEvent(events, state, completed, 5, [], high).weighted.find((item) => item.event.id === 'E16')!.finalWeight;
    expect(highWeight).toBeGreaterThan(lowWeight);
  });
});

describe('scenario runtime', () => {
  function run(seed: number, choiceIndex: number) {
    let game = createGame(seed);
    let guard = 0;
    while (game.status === 'playing' && guard < 50) {
      const event = getCurrentEvent(game);
      expect(event).not.toBeNull();
      game = choose(game, event!.choices[choiceIndex % event!.choices.length]);
      guard += 1;
    }
    expect(guard).toBeLessThan(50);
    return game;
  }

  it('loads scenarios through the registry without hard-coded save ids', () => {
    expect(listScenarioIds()).toContain(defaultScenarioId);
    const game = createGame(1, defaultScenarioId);
    expect(game.scenarioId).toBe(defaultScenarioId);
  });

  it('same seed and choices produce exactly the same completed save', () => {
    expect(run(872631, 0)).toEqual(run(872631, 0));
  });

  it('different seeds vary event order inside the design phase', () => {
    const nextEvents = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      let game = createGame(seed);
      game = choose(game, getCurrentEvent(game)!.choices[0]);
      nextEvents.add(game.currentEventId!);
    }
    expect(nextEvents.size).toBeGreaterThan(1);
    expect([...nextEvents].every((id) => ['E02', 'E03', 'E04'].includes(id))).toBe(true);
  });

  it('different metric choices open and close the creativity route', () => {
    const playToImplementation = (metricChoiceId: string) => {
      let game = createGame(7);
      while (String(game.worldState.phase) !== 'implementation') {
        const event = getCurrentEvent(game)!;
        const choice = event.id === 'E04'
          ? event.choices.find((item) => item.id === metricChoiceId)!
          : event.choices[0];
        game = choose(game, choice);
      }
      return getEligible(game).map((event) => event.id);
    };
    expect(playToImplementation('C')).toContain('E05');
    expect(playToImplementation('A')).not.toContain('E05');
  });

  it('E17 quotes the actual early statement and E19 unlocks route choices', () => {
    const decisions: Record<string, string> = {
      E01: 'C', E02: 'A', E03: 'B', E04: 'C', E05: 'A', E06: 'A', E07: 'B', E08: 'A',
      E09: 'A', E10: 'A', E11: 'C', E12: 'C', E13: 'D', E14: 'A', E15: 'C', E16: 'C',
      E17: 'C', E18: 'A',
    };
    let game = createGame(42);
    while (game.currentEventId !== 'E17') {
      const event = getCurrentEvent(game)!;
      game = choose(game, event.choices.find((item) => item.id === decisions[event.id]) ?? event.choices[0]);
    }
    const movement = getCurrentEvent(game)!;
    expect(movement.scene).toContain('教育不应该由中央统一决定，地方最了解自己的学生。');
    game = choose(game, movement.choices.find((choice) => choice.id === 'C')!);
    while (game.currentEventId !== 'E19') {
      const event = getCurrentEvent(game)!;
      game = choose(game, event.choices.find((item) => item.id === decisions[event.id]) ?? event.choices[0]);
    }
    expect(getCurrentEvent(game)!.choices.map((choice) => choice.id)).toContain('B');
  });

  it('choosing an ending completes normally without a dead-end exception', () => {
    const game = run(9, 0);
    expect(game.status).toBe('completed');
    expect(game.currentEventId).toBeNull();
    expect(game.completedEvents).toContain('E20');
  });

  it('serializes completed saves and migrates legacy saves to v3', () => {
    const completed = run(22, 1);
    expect(parseSave(serializeSave(completed))).toEqual(completed);
    const legacy = {
      saveVersion: 2, engineVersion: '0.2.0', scenario: 'education_demo', seed: 1, rngState: 1,
      turn: 8, worldState: { story_step: 10 }, history: [], memories: [], debts: [], completedEvents: ['E10'], currentEventId: 'E11',
    };
    const migrated = parseSave(JSON.stringify(legacy));
    expect(migrated.saveVersion).toBe(3);
    expect(migrated.scenarioId).toBe('education_demo');
    expect(migrated.worldState.phase).toBe('backlash');
  });
});
