import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../src/engine/conditionEvaluator';
import { applyEffects } from '../src/engine/effectExecutor';
import { selectEvent } from '../src/engine/eventSelector';
import { parseSave, serializeSave } from '../src/engine/saveEngine';
import { choose, createGame, events, getCurrentEvent } from '../src/store/gameStore';
import { addMemory, findMemory, getPublicPromises } from '../src/engine/memoryEngine';
import { advanceDebtPressure, applyDebtActions, createDebt, getDebtPressure } from '../src/engine/debtEngine';

describe('condition evaluator', () => {
  const state = { score: 2, tags: ['promise'], active: true };

  it('evaluates leaf and nested conditions without eval', () => {
    expect(evaluateCondition({ field: 'score', operator: '>=', value: 2 }, state)).toBe(true);
    expect(evaluateCondition({ field: 'tags', operator: 'contains', value: 'promise' }, state)).toBe(true);
    expect(evaluateCondition({ any: [
      { field: 'score', operator: '<', value: 0 },
      { field: 'active', operator: '==', value: true },
    ] }, state)).toBe(true);
  });
});

describe('effect executor', () => {
  it('returns a new state and supports all Stage 0 operations', () => {
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
  it('stores semantic memories and retrieves the most important public promise', () => {
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

  it('advances debt pressure and records fulfillment', () => {
    let debts = createDebt([], {
      creditor: 'teachers_union', type: 'staffing_promise', topic: 'teacher_support',
      strength: 2, pressure: 1, description: '教师等待行政助理到岗。', tags: ['teachers'],
    }, 'E07', 7);
    debts = advanceDebtPressure(debts);
    expect(getDebtPressure(debts, 'teacher_support')).toBe(2);
    debts = applyDebtActions(debts, [{ action: 'resolve', topic: 'teacher_support' }]);
    expect(debts[0].status).toBe('paid');
    expect(getDebtPressure(debts, 'teacher_support')).toBe(0);
  });
});

describe('deterministic narrative run', () => {
  function run(seed: number, choiceIndex: number) {
    let game = createGame(seed);
    while (game.currentEventId !== 'E20') {
      const event = getCurrentEvent(game);
      game = choose(game, event.choices[choiceIndex % event.choices.length]);
    }
    return game;
  }

  it('same seed and choices produce exactly the same save', () => {
    expect(run(872631, 0)).toEqual(run(872631, 0));
  });

  it('save serialization fully restores world state and history', () => {
    const game = run(22, 1);
    expect(parseSave(serializeSave(game))).toEqual(game);
  });

  it('once events cannot repeat', () => {
    const game = createGame(8);
    const selected = selectEvent(events, game.worldState, ['E01'], game.rngState);
    expect(selected.eligible.map((event) => event.id)).not.toContain('E01');
  });

  it('different E04 choices open and close the creativity route', () => {
    let creativity = createGame(1);
    let satisfaction = createGame(1);
    for (let step = 0; step < 4; step += 1) {
      const a = getCurrentEvent(creativity);
      const b = getCurrentEvent(satisfaction);
      creativity = choose(creativity, a.choices[step === 3 ? 2 : 0]);
      satisfaction = choose(satisfaction, b.choices[0]);
    }
    expect(creativity.currentEventId).toBe('E05');
    expect(satisfaction.currentEventId).toBe('E09');
  });

  it('E17 quotes the actual early statement and E19 unlocks route-dependent choices', () => {
    const decisions: Record<string, string> = {
      E01: 'C', E02: 'A', E03: 'B', E04: 'C', E05: 'A', E06: 'A', E07: 'B', E08: 'A',
      E09: 'A', E10: 'A', E11: 'C', E12: 'C', E13: 'D', E14: 'A', E15: 'C', E16: 'C',
      E17: 'C', E18: 'A',
    };
    let game = createGame(42);
    while (game.currentEventId !== 'E17') {
      const event = getCurrentEvent(game);
      const choice = event.choices.find((item) => item.id === decisions[event.id]) ?? event.choices[0];
      game = choose(game, choice);
    }
    const studentMovement = getCurrentEvent(game);
    expect(studentMovement.scene).toContain('教育不应该由中央统一决定，地方最了解自己的学生。');
    expect(studentMovement.scene).not.toContain('{{memory:');
    game = choose(game, studentMovement.choices.find((choice) => choice.id === 'C')!);
    game = choose(game, getCurrentEvent(game).choices[0]);
    const finalPlan = getCurrentEvent(game);
    expect(finalPlan.id).toBe('E19');
    expect(finalPlan.choices.map((choice) => choice.id)).toContain('B');
  });

  it('migrates a Stage 0 save into the Stage 1 continuation', () => {
    const legacy = {
      saveVersion: 1, engineVersion: '0.1.0', scenario: 'education_demo', seed: 1, rngState: 1,
      turn: 8, worldState: { story_step: 10 }, history: [], completedEvents: ['E10'], currentEventId: 'S0_END',
    };
    const migrated = parseSave(JSON.stringify(legacy));
    expect(migrated.saveVersion).toBe(2);
    expect(migrated.currentEventId).toBe('E11');
    expect(migrated.memories).toEqual([]);
    expect(migrated.debts).toEqual([]);
  });
});
