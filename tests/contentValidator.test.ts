import { describe, expect, it } from 'vitest';
import { choose, createGame, getCurrentEvent } from '../src/store/gameStore';
import { defaultScenarioId, getScenarioBundle, listScenarioIds } from '../src/content/scenarioRegistry';
import { validateScenarioBundle } from '../src/content/contentValidator';
import { formatPlayerValue } from '../src/engine/historyEngine';
import { normalizeAiDraft } from '../src/content/aiDraft';
import energyDraft from '../drafts/energy-crisis.ai-draft.json';

describe('education demo content', () => {
  it('passes actor, institution, framing, state, dependency, and ending validation for every registered scenario', () => {
    for (const scenarioId of listScenarioIds()) {
      expect(validateScenarioBundle(getScenarioBundle(scenarioId)), scenarioId).toEqual([]);
    }
  });

  it('reports unknown ids, misspelled fields, and duplicate references', () => {
    const broken = structuredClone(getScenarioBundle(defaultScenarioId));
    broken.events[0].actorId = 'missing_actor';
    broken.events[0].after = ['E02', 'E02'];
    broken.events[0].choices[0].effects.push({ field: 'teacher_unrst', operation: 'increment', value: 1 });
    const codes = validateScenarioBundle(broken).map((issue) => issue.code);
    expect(codes).toContain('unknown_actor');
    expect(codes).toContain('duplicate_event_reference');
    expect(codes).toContain('unknown_effect_field');
  });

  it('reports actor/institution mismatches and invalid effect types', () => {
    const broken = structuredClone(getScenarioBundle(defaultScenarioId));
    broken.events[1].institutionId = 'ministry_finance';
    broken.events[1].choices[0].effects.push({ field: 'official_terms', operation: 'increment', value: 1 });
    const codes = validateScenarioBundle(broken).map((issue) => issue.code);
    expect(codes).toContain('actor_institution_mismatch');
    expect(codes).toContain('invalid_numeric_effect');
  });

  it('validates framing event, source, choice, and template references', () => {
    const broken = structuredClone(getScenarioBundle(defaultScenarioId));
    broken.framings[0].eventId = 'E404';
    broken.framings[0].source.actorId = 'missing_publisher';
    broken.framings[0].choiceIds = ['Z'];
    broken.framings[0].body = '{{state:student_unrst}}';
    const codes = validateScenarioBundle(broken).map((issue) => issue.code);
    expect(codes).toContain('unknown_framing_event');
    expect(codes).toContain('unknown_framing_actor');
    expect(codes).toContain('unknown_framing_state_field');
  });

  it('rejects player display mappings for unknown world fields', () => {
    const broken = structuredClone(getScenarioBundle(defaultScenarioId));
    broken.scenario.playerDisplay!.fields!.teacher_unrst = { high: '教师不满高涨' };
    expect(validateScenarioBundle(broken).map((issue) => issue.code)).toContain('unknown_player_display_field');
  });

  it('contains E01–E20 and a formal ending', () => {
    const events = getScenarioBundle(defaultScenarioId).events;
    for (let index = 1; index <= 20; index += 1) {
      expect(events.some((event) => event.id === `E${String(index).padStart(2, '0')}`)).toBe(true);
    }
    expect(events.some((event) => event.type === 'ending')).toBe(true);
    const framings = getScenarioBundle(defaultScenarioId).framings;
    expect(new Set(framings.map((framing) => framing.type))).toEqual(new Set(['newspaper', 'tv_news', 'government_memo', 'internal_memo']));
    for (const eventId of ['E05', 'E12', 'E13', 'E14', 'E16', 'E17', 'E20']) {
      expect(framings.some((framing) => framing.eventId === eventId), `${eventId} lacks framing`).toBe(true);
    }
  });

  it('10,000 seeded bots reach a completed ending with varied event order', () => {
    for (const scenarioId of listScenarioIds()) {
      const sequences = new Set<string>();
      for (let seed = 1; seed <= 10_000; seed += 1) {
        let game = createGame(seed, scenarioId);
        let steps = 0;
        const sequence: string[] = [];
        while (game.status === 'playing' && steps < 50) {
          const event = getCurrentEvent(game);
          expect(event, `${scenarioId} seed ${seed} has no current event`).not.toBeNull();
          sequence.push(event!.id);
          const choice = event!.choices[(seed + steps * 7) % event!.choices.length];
          game = choose(game, choice);
          steps += 1;
        }
        expect(game.status, `${scenarioId} seed ${seed} dead-ended`).toBe('completed');
        expect(steps, `${scenarioId} seed ${seed} looped`).toBeLessThan(50);
        if (sequences.size < 100) sequences.add(sequence.join(','));
      }
      expect(sequences.size, `${scenarioId} lacks order variation`).toBeGreaterThan(5);
    }
  }, 30_000);
});

describe('penguin strait content', () => {
  const bundle = getScenarioBundle('penguin_strait');

  it('meets the cross-scenario content scale and ending targets', () => {
    expect(bundle.events).toHaveLength(20);
    expect(bundle.scenario.phases).toHaveLength(5);
    expect(bundle.actors.length).toBeGreaterThanOrEqual(6);
    expect(bundle.institutions.length).toBeGreaterThanOrEqual(5);
    expect(bundle.events.filter((event) => event.type === 'ending')).toHaveLength(4);
    expect(bundle.framings.length).toBeGreaterThanOrEqual(10);
    expect(bundle.framings.length).toBeLessThanOrEqual(15);
  });

  it('covers all required diplomatic framing viewpoints and formats', () => {
    expect(new Set(bundle.framings.map((framing) => framing.type))).toEqual(new Set(['newspaper', 'tv_news', 'government_memo', 'internal_memo']));
    expect(new Set(bundle.framings.map((framing) => framing.stance))).toEqual(new Set(['government', 'media', 'opposition', 'institution', 'foreign_observer']));
  });

  it('uses the selected official wording in later events and framings', () => {
    expect(bundle.events.some((event) => event.id !== 'P02' && event.scene.includes('{{official_terms:last}}'))).toBe(true);
    expect(bundle.framings.some((framing) => framing.body.includes('{{official_terms:last}}') || framing.title.includes('{{official_terms:last}}'))).toBe(true);
  });

  it('maps machine-like state values referenced by player-facing framings', () => {
    for (const scenarioId of listScenarioIds()) {
      const scenarioBundle = getScenarioBundle(scenarioId);
      const templates = scenarioBundle.framings.flatMap((framing) => [framing.eyebrow, framing.title, framing.body, framing.footer].filter(Boolean) as string[]);
      const referencedFields = new Set(templates.flatMap((template) => [...template.matchAll(/\{\{state:([^}]+)\}\}/g)].map((match) => match[1])));
      for (const field of referencedFields) {
        const possibleValues = new Set<unknown>([scenarioBundle.scenario.initialState[field]]);
        for (const event of scenarioBundle.events) for (const choice of event.choices) {
          for (const effect of choice.effects.filter((item) => item.field === field && item.operation === 'set')) possibleValues.add(effect.value);
        }
        for (const value of possibleValues) {
          if (typeof value === 'string' && (value.includes('_') || ['active', 'paid', 'broken', 'expired'].includes(value))) {
            expect(formatPlayerValue(value, scenarioBundle.scenario, field), `${scenarioId}.${field}.${value}`).not.toBe(value);
          }
        }
      }
    }
  });
});

describe('AI content pipeline', () => {
  it('normalizes the single-file energy draft into the exact imported bundle', () => {
    const normalized = normalizeAiDraft(energyDraft);
    expect(normalized.contentDirectory).toBe('energy-crisis');
    expect(normalized.bundle).toEqual(getScenarioBundle('energy_crisis'));
    expect(normalized.bundle.scenario.subtitle).toBe('AI 内容管线试作');
    expect(normalized.bundle.events[0]).toMatchObject({ weight: 1, once: true });
  });

  it('rejects malformed optional AI arrays before they can crash validation', () => {
    const broken = structuredClone(energyDraft);
    broken.events[0].requirements = { field: 'grid_stability', operator: '>=', value: 1 } as never;
    (broken.events[0].choices[0] as unknown as { effects: unknown }).effects = { field: 'grid_stability', operation: 'increment', value: 1 };
    expect(() => normalizeAiDraft(broken)).toThrow(/requirements 必须是数组/);
    expect(() => normalizeAiDraft(broken)).toThrow(/effects 必须是数组/);
  });

  it('imports a small playable scenario with three formal endings', () => {
    const bundle = getScenarioBundle('energy_crisis');
    expect(bundle.events).toHaveLength(8);
    expect(bundle.framings).toHaveLength(5);
    expect(bundle.events.filter((event) => event.type === 'ending')).toHaveLength(3);
  });

  it('reports AI-style reference, template, phase, ending, and display mapping mistakes together', () => {
    const broken = structuredClone(getScenarioBundle('energy_crisis'));
    broken.actors.push(structuredClone(broken.actors[0]));
    broken.events[0].actorId = 'invented_actor';
    broken.events[1].after = ['EN04'];
    broken.framings[0].body = '{{state:energy_policy}} and {{state:missing_field}} and {{memory:unfinished';
    delete broken.scenario.playerDisplay!.fields!.energy_policy.emergency_imports;
    for (const event of broken.events) if (event.type === 'ending') event.type = 'core';
    const codes = validateScenarioBundle(broken).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining([
      'duplicate_actor',
      'unknown_actor',
      'future_phase_reference',
      'unknown_framing_state_field',
      'malformed_template_variable',
      'missing_player_display_mapping',
      'missing_ending',
      'unreachable_ending_phase',
    ]));
  });

  it('reports malformed AI condition containers instead of throwing', () => {
    const broken = structuredClone(getScenarioBundle('energy_crisis'));
    broken.events[0].requirements = { field: 'grid_stability', operator: '>=', value: 1 } as never;
    broken.events[1].requirements = [{ all: { field: 'public_anger', operator: '>=', value: 2 } as never }];
    expect(() => validateScenarioBundle(broken)).not.toThrow();
    const codes = validateScenarioBundle(broken).map((issue) => issue.code);
    expect(codes).toContain('invalid_condition_container');
  });
});
