import scenarioJson from '../../content/education-demo/scenario.json';
import actorsJson from '../../content/education-demo/actors.json';
import institutionsJson from '../../content/education-demo/institutions.json';
import eventsJson from '../../content/education-demo/events/events.json';
import framingsJson from '../../content/education-demo/framings.json';
import penguinScenarioJson from '../../content/penguin-strait/scenario.json';
import penguinActorsJson from '../../content/penguin-strait/actors.json';
import penguinInstitutionsJson from '../../content/penguin-strait/institutions.json';
import penguinEventsJson from '../../content/penguin-strait/events/events.json';
import penguinFramingsJson from '../../content/penguin-strait/framings.json';
import type { ScenarioBundle } from '../models/game';

const educationDemo = {
  scenario: scenarioJson,
  actors: actorsJson,
  institutions: institutionsJson,
  events: eventsJson,
  framings: framingsJson,
} as ScenarioBundle;

const penguinStrait = {
  scenario: penguinScenarioJson,
  actors: penguinActorsJson,
  institutions: penguinInstitutionsJson,
  events: penguinEventsJson,
  framings: penguinFramingsJson,
} as ScenarioBundle;

const registry: Record<string, ScenarioBundle> = {
  [educationDemo.scenario.id]: educationDemo,
  [penguinStrait.scenario.id]: penguinStrait,
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

export function listScenarios() {
  return Object.values(registry).map((bundle) => bundle.scenario);
}
