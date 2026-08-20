import scenarioJson from '../../content/education-demo/scenario.json';
import actorsJson from '../../content/education-demo/actors.json';
import institutionsJson from '../../content/education-demo/institutions.json';
import eventsJson from '../../content/education-demo/events/events.json';
import type { ScenarioBundle } from '../models/game';

const educationDemo = {
  scenario: scenarioJson,
  actors: actorsJson,
  institutions: institutionsJson,
  events: eventsJson,
} as ScenarioBundle;

const registry: Record<string, ScenarioBundle> = {
  [educationDemo.scenario.id]: educationDemo,
};

export const defaultScenarioId = educationDemo.scenario.id;

export function getScenarioBundle(scenarioId: string): ScenarioBundle {
  const bundle = registry[scenarioId];
  if (!bundle) throw new Error(`未知剧本：${scenarioId}`);
  return bundle;
}

export function listScenarioIds(): string[] {
  return Object.keys(registry);
}
