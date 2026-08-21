import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../src/engine/conditionEvaluator';
import { applyEffects } from '../src/engine/effectExecutor';
import { selectEvent } from '../src/engine/eventSelector';
import { parseSave, serializeSave } from '../src/engine/saveEngine';
import { choose, createGame, dismissCurrentFraming, getCurrentEvent, getCurrentFraming, getEligible } from '../src/store/gameStore';
import { addMemory, findMemory, getPublicPromises } from '../src/engine/memoryEngine';
import { advanceDebtPressure, applyDebtActions, createDebt, getDebtIntensity, getDebtPressure, getDebtPressureCap } from '../src/engine/debtEngine';
import { defaultScenarioId, getScenarioBundle, listScenarioIds } from '../src/content/scenarioRegistry';
import { formatPlayerValue, renderNarrativeTemplate } from '../src/engine/historyEngine';

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

  it('queries paid, broken, and expired debt statuses while pressure stays active-only', () => {
    const template = {
      creditor: 'teachers_union', type: 'staffing_promise', topic: 'teacher_support',
      strength: 2, pressure: 1, description: '教师等待支持。', tags: ['teachers'],
    };
    const active = createDebt([], template, 'E07', 7);
    const paid = applyDebtActions(active, [{ action: 'resolve', topic: 'teacher_support' }]);
    const broken = applyDebtActions(active, [{ action: 'break', topic: 'teacher_support' }]);
    const expired = [{ ...active[0], status: 'expired' as const }];
    for (const [debts, status] of [[paid, 'paid'], [broken, 'broken'], [expired, 'expired']] as const) {
      expect(evaluateCondition({ scope: 'debt', field: 'status', operator: '==', value: status }, {}, [], debts)).toBe(true);
      expect(getDebtPressure(debts, 'teacher_support')).toBe(0);
    }
  });
});

describe('reactive event selector', () => {
  const educationEvents = getScenarioBundle(defaultScenarioId).events;
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
      educationEvents,
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
    const first = selectEvent(educationEvents, game.worldState, [], game.rngState);
    const second = selectEvent(educationEvents, game.worldState, [], game.rngState);
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
    const lowWeight = selectEvent(educationEvents, state, completed, 5, [], low).weighted.find((item) => item.event.id === 'E16')!.finalWeight;
    const highWeight = selectEvent(educationEvents, state, completed, 5, [], high).weighted.find((item) => item.event.id === 'E16')!.finalWeight;
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
    expect(listScenarioIds()).toEqual(['education_demo', 'penguin_strait']);
    const game = createGame(1, defaultScenarioId);
    expect(game.scenarioId).toBe(defaultScenarioId);
  });

  it('renders common and scenario-specific machine values as player-facing language', () => {
    const penguin = getScenarioBundle('penguin_strait').scenario;
    expect(formatPlayerValue('active', penguin, 'debt.status')).toBe('尚未兑现');
    expect(formatPlayerValue('paid', penguin, 'debt.status')).toBe('已兑现');
    expect(formatPlayerValue('broken', penguin, 'debt.status')).toBe('已违约');
    expect(formatPlayerValue('expired', penguin, 'debt.status')).toBe('已失效');
    expect(formatPlayerValue('mutual_withdrawal', penguin, 'agreement_type')).toBe('双方同步撤离');
    const save = { ...createGame(4, 'penguin_strait'), worldState: { ...penguin.initialState, agreement_type: 'mutual_withdrawal' } };
    expect(renderNarrativeTemplate('安排如下：{{state:agreement_type}}。', save, undefined, penguin)).toBe('安排如下：双方同步撤离。');
    expect(renderNarrativeTemplate('旧话：{{memory:missing_topic}}。', save, undefined, penguin)).toBe('旧话：没有可供引用的相关记录。');
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
    expect(game.pendingFramingIds.slice(-2)).toEqual(['F-E20-ARCHIVE', 'F-E20-FOREIGN']);
  });

  it('queues and renders multiple post-choice framings without consuming a turn', () => {
    const bundle = getScenarioBundle(defaultScenarioId);
    const game = {
      ...createGame(42),
      worldState: { ...bundle.scenario.initialState, phase: 'implementation', reform_metric: 'creativity' },
      completedEvents: ['E01', 'E02', 'E03', 'E04'],
      currentEventId: 'E05',
    };
    const next = choose(game, getCurrentEvent(game)!.choices.find((choice) => choice.id === 'A')!);
    expect(next.turn).toBe(game.turn + 1);
    expect(next.pendingFramingIds).toEqual(['F-E05-GOV', 'F-E05-PRESS']);
    const governmentMemo = getCurrentFraming(next)!;
    expect(governmentMemo.type).toBe('government_memo');
    expect(governmentMemo.renderedBody).toContain('批准全国考试');
    const dismissed = dismissCurrentFraming(next);
    expect(dismissed.turn).toBe(next.turn);
    expect(getCurrentFraming(dismissed)?.type).toBe('newspaper');
    expect(dismissed.seenFramingIds).toContain('F-E05-GOV');
  });

  it('serializes Stage 2 saves and deliberately rejects old save versions', () => {
    const completed = run(22, 1);
    expect(parseSave(serializeSave(completed))).toEqual(completed);
    expect(() => parseSave(JSON.stringify({ ...completed, saveVersion: 3, engineVersion: '0.3.0' }))).toThrow('存档版本不受支持');
  });
});

describe('penguin strait cross-scenario runtime', () => {
  const scenarioId = 'penguin_strait';
  const bundle = getScenarioBundle(scenarioId);

  it('varies diplomacy, navy, fishing, and media order within the posture phase', () => {
    const firstPostureEvents = new Set<string>();
    for (let seed = 1; seed <= 50; seed += 1) {
      let game = createGame(seed, scenarioId);
      game = choose(game, getCurrentEvent(game)!.choices[0]);
      firstPostureEvents.add(game.currentEventId!);
    }
    expect(firstPostureEvents.size).toBeGreaterThan(2);
    expect([...firstPostureEvents].every((id) => ['P02', 'P03', 'P04', 'P05'].includes(id))).toBe(true);
  });

  it('raises the fishing pressure event weight from active fisher debt', () => {
    const debtTemplate = {
      creditor: 'strait_fishers', type: 'protection_promise', topic: 'fisher_protection', strength: 4,
      description: '渔民等待捕鱼权保护。', tags: ['fisheries'],
    };
    const state = { ...bundle.scenario.initialState, phase: 'settlement', fisher_pressure: 4, domestic_pressure: 3 };
    const completed = Array.from({ length: 11 }, (_, index) => `P${String(index + 1).padStart(2, '0')}`);
    const low = createDebt([], { ...debtTemplate, pressure: 1 }, 'P04', 4);
    const high = createDebt([], { ...debtTemplate, pressure: 7 }, 'P04', 4);
    const lowWeight = selectEvent(bundle.events, state, completed, 9, [], low).weighted.find((item) => item.event.id === 'P13')!.finalWeight;
    const highWeight = selectEvent(bundle.events, state, completed, 9, [], high).weighted.find((item) => item.event.id === 'P13')!.finalWeight;
    expect(highWeight).toBeGreaterThan(lowWeight);
  });

  it('reuses selected official wording and the actual public red line later', () => {
    const decisions: Record<string, string> = { P02: 'D', P07: 'B' };
    let game = createGame(73, scenarioId);
    let sawOpponentWording = false;
    while (game.currentEventId !== 'P09') {
      const event = getCurrentEvent(game)!;
      if (event.id === 'P06') {
        expect(event.scene).toContain('友好国家间技术性地理分歧');
        sawOpponentWording = true;
      }
      game = choose(game, event.choices.find((choice) => choice.id === decisions[event.id]) ?? event.choices[0]);
    }
    expect(sawOpponentWording).toBe(true);
    expect(getCurrentEvent(game)!.scene).toContain('共和国的红线是任何对我国渔民的实际伤害');
  });

  it('reaches all four configured endings through the shared ending mechanism', () => {
    const expected: Record<string, string> = { A: 'P17', B: 'P18', C: 'P19', D: 'P20' };
    for (const [accordChoice, endingId] of Object.entries(expected)) {
      let game = createGame(91, scenarioId);
      let guard = 0;
      while (game.status === 'playing' && guard < 40) {
        const event = getCurrentEvent(game)!;
        if (event.type === 'ending') {
          expect(event.scene).not.toContain('{{history:evaluation}}');
          expect(event.scene).not.toContain('历史尚未收到');
        }
        const desired = event.id === 'P15' ? event.choices.find((choice) => choice.id === accordChoice) : undefined;
        expect(event.id !== 'P15' || desired, `P15 choice ${accordChoice} should be eligible`).toBeTruthy();
        game = choose(game, desired ?? event.choices[0]);
        guard += 1;
      }
      expect(game.status).toBe('completed');
      expect(game.completedEvents).toContain(endingId);
    }
  });
});
