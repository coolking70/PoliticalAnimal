import { describe, expect, it } from 'vitest';
import { choose, createGame, getCurrentEvent } from '../src/store/gameStore';
import { defaultScenarioId, getScenarioBundle } from '../src/content/scenarioRegistry';
import { validateScenarioBundle } from '../src/content/contentValidator';

describe('education demo content', () => {
  it('passes actor, institution, state field, dependency, and ending validation', () => {
    expect(validateScenarioBundle(getScenarioBundle(defaultScenarioId))).toEqual([]);
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
    const sequences = new Set<string>();
    for (let seed = 1; seed <= 10_000; seed += 1) {
      let game = createGame(seed);
      let steps = 0;
      const sequence: string[] = [];
      while (game.status === 'playing' && steps < 50) {
        const event = getCurrentEvent(game);
        expect(event, `seed ${seed} has no current event`).not.toBeNull();
        sequence.push(event!.id);
        const choice = event!.choices[(seed + steps * 7) % event!.choices.length];
        game = choose(game, choice);
        steps += 1;
      }
      expect(game.status, `seed ${seed} dead-ended`).toBe('completed');
      expect(game.completedEvents.some((id) => id === 'E20')).toBe(true);
      expect(steps, `seed ${seed} looped`).toBeLessThan(50);
      if (sequences.size < 100) sequences.add(sequence.join(','));
    }
    expect(sequences.size).toBeGreaterThan(5);
  }, 20_000);
});
