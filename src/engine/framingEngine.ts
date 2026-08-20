import type {
  GameSave,
  NarrativeFraming,
  ResolvedNarrativeFraming,
  ScenarioBundle,
} from '../models/game';
import { allConditionsMatch } from './conditionEvaluator';
import { renderNarrativeTemplate } from './historyEngine';

export function selectFramings(
  framings: NarrativeFraming[],
  eventId: string,
  choiceId: string,
  save: GameSave,
): NarrativeFraming[] {
  return framings.filter((framing) =>
    framing.eventId === eventId
    && !save.seenFramingIds.includes(framing.id)
    && (!framing.choiceIds?.length || framing.choiceIds.includes(choiceId))
    && allConditionsMatch(framing.requirements, save.worldState, save.memories, save.debts));
}

export function resolveFraming(
  framing: NarrativeFraming,
  bundle: ScenarioBundle,
  save: GameSave,
): ResolvedNarrativeFraming {
  const actor = framing.source.actorId
    ? bundle.actors.find((item) => item.id === framing.source.actorId)
    : undefined;
  const institution = framing.source.institutionId
    ? bundle.institutions.find((item) => item.id === framing.source.institutionId)
    : undefined;
  const history = [...save.history].reverse().find((entry) => entry.eventId === framing.eventId);
  const render = (template: string | undefined) => template
    ? renderNarrativeTemplate(template, save, history)
    : undefined;
  return {
    ...framing,
    sourceName: framing.source.label ?? actor?.name ?? institution?.name ?? '未署名来源',
    sourceEmoji: actor?.emoji,
    renderedEyebrow: render(framing.eyebrow),
    renderedTitle: render(framing.title) ?? framing.title,
    renderedBody: render(framing.body) ?? framing.body,
    renderedFooter: render(framing.footer),
  };
}
