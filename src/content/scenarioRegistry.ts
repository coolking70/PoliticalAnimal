import type { Actor, GameEvent, Institution, NarrativeFraming, Scenario, ScenarioBundle } from '../models/game';

type JsonModule<T> = { default: T };

const scenarioModules = import.meta.glob('../../content/*/scenario.json', { eager: true }) as Record<string, JsonModule<Scenario>>;
const actorModules = import.meta.glob('../../content/*/actors.json', { eager: true }) as Record<string, JsonModule<Actor[]>>;
const institutionModules = import.meta.glob('../../content/*/institutions.json', { eager: true }) as Record<string, JsonModule<Institution[]>>;
const eventModules = import.meta.glob('../../content/*/events/events.json', { eager: true }) as Record<string, JsonModule<GameEvent[]>>;
const framingModules = import.meta.glob('../../content/*/framings.json', { eager: true }) as Record<string, JsonModule<NarrativeFraming[]>>;

function directoryFromScenarioPath(modulePath: string): string {
  const match = modulePath.match(/\/content\/([^/]+)\/scenario\.json$/);
  if (!match) throw new Error(`无法识别 Scenario 内容目录：${modulePath}`);
  return match[1];
}

function requiredModule<T>(modules: Record<string, JsonModule<T>>, modulePath: string): T {
  const module = modules[modulePath];
  if (!module) throw new Error(`Scenario 内容目录缺少文件：${modulePath}`);
  return module.default;
}

const registry: Record<string, ScenarioBundle> = {};
for (const [scenarioPath, scenarioModule] of Object.entries(scenarioModules)) {
  const directory = directoryFromScenarioPath(scenarioPath);
  const root = `../../content/${directory}`;
  const bundle: ScenarioBundle = {
    scenario: scenarioModule.default,
    actors: requiredModule(actorModules, `${root}/actors.json`),
    institutions: requiredModule(institutionModules, `${root}/institutions.json`),
    events: requiredModule(eventModules, `${root}/events/events.json`),
    framings: requiredModule(framingModules, `${root}/framings.json`),
  };
  if (registry[bundle.scenario.id]) throw new Error(`重复注册 Scenario：${bundle.scenario.id}`);
  registry[bundle.scenario.id] = bundle;
}

export const defaultScenarioId = 'education_demo';
if (!registry[defaultScenarioId]) throw new Error(`默认 Scenario 未注册：${defaultScenarioId}`);

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
