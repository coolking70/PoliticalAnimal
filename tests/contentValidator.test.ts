import { describe, expect, it } from 'vitest';
import eventsJson from '../content/education-demo/events/events.json';
import actorsJson from '../content/education-demo/actors.json';
import institutionsJson from '../content/education-demo/institutions.json';
import { choose, createGame, getCurrentEvent } from '../src/store/gameStore';
import type { GameEvent } from '../src/models/game';

const events = eventsJson as GameEvent[];

describe('education demo content', () => {
  it('has unique ids and valid structural references', () => {
    const ids = events.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(actorsJson.length).toBeGreaterThanOrEqual(6);
    expect(institutionsJson.length).toBeGreaterThanOrEqual(5);
    for (const event of events) {
      expect(event.id).toMatch(/^(E\d{2}|S0_END)$/);
      expect(event.title.length).toBeGreaterThan(0);
      expect(event.scene.length).toBeGreaterThan(20);
      expect(event.choices.length).toBeGreaterThan(0);
      expect(event.weight).toBeGreaterThan(0);
      for (const choice of event.choices) {
        expect(choice.effects.length).toBeGreaterThan(0);
        for (const effect of choice.effects) {
          expect(['set', 'increment', 'decrement', 'push']).toContain(effect.operation);
        }
        for (const memory of choice.memories ?? []) {
          expect(memory.topic.length).toBeGreaterThan(0);
          expect(memory.statement.length).toBeGreaterThan(5);
          expect(memory.importance).toBeGreaterThan(0);
        }
        for (const debt of choice.debts ?? []) {
          expect(debt.topic.length).toBeGreaterThan(0);
          expect(debt.pressure).toBeGreaterThan(0);
        }
      }
    }
  });

  it('contains the first ten specified core events', () => {
    for (let index = 1; index <= 20; index += 1) {
      expect(events.some((event) => event.id === `E${String(index).padStart(2, '0')}`)).toBe(true);
    }
  });

  it('10,000 seeded bots always reach the Stage 1 ending without loops or dead ends', () => {
    for (let seed = 1; seed <= 10_000; seed += 1) {
      let game = createGame(seed);
      let steps = 0;
      while (game.currentEventId !== 'E20' && steps < 30) {
        const event = getCurrentEvent(game);
        const choice = event.choices[(seed + steps * 7) % event.choices.length];
        game = choose(game, choice);
        steps += 1;
      }
      expect(game.currentEventId, `seed ${seed} dead-ended`).toBe('E20');
      expect(steps, `seed ${seed} looped`).toBeLessThan(30);
    }
  });
});
