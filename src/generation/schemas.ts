import type { JsonSchema } from './types';

const id = { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]*$' };
const nonEmpty = { type: 'string', minLength: 1 };
const objectArray = { type: 'array', items: { type: 'object' } };

export const plannerSchema: JsonSchema = {
  type: 'object',
  required: ['scenarioId', 'contentDirectory', 'title', 'subtitle', 'playerRole', 'workspaceLabel', 'politicalConflict', 'satireEngine', 'phases', 'actors', 'institutions', 'corePressures', 'safetyNotes'],
  properties: {
    scenarioId: id,
    contentDirectory: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
    title: nonEmpty,
    subtitle: nonEmpty,
    playerRole: nonEmpty,
    workspaceLabel: nonEmpty,
    politicalConflict: nonEmpty,
    satireEngine: { type: 'array', minItems: 3, items: nonEmpty },
    phases: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'object', required: ['id', 'label', 'purpose'], properties: { id, label: nonEmpty, purpose: nonEmpty } } },
    actors: { type: 'array', minItems: 4, items: { type: 'object', required: ['id', 'name', 'species', 'role', 'institutionId', 'politicalNeed'], properties: { id, name: nonEmpty, species: nonEmpty, role: nonEmpty, institutionId: id, politicalNeed: nonEmpty } } },
    institutions: { type: 'array', minItems: 3, items: { type: 'object', required: ['id', 'name', 'mission', 'institutionalInterest'], properties: { id, name: nonEmpty, mission: nonEmpty, institutionalInterest: nonEmpty } } },
    corePressures: { type: 'array', minItems: 3, items: nonEmpty },
    safetyNotes: { type: 'array', items: nonEmpty },
  },
};

export const structureSchema: JsonSchema = {
  type: 'object',
  required: ['scenario', 'actors', 'institutions', 'eventSkeletons', 'memoryDesign', 'debtDesign', 'framingPlan', 'endingPlan', 'playerDisplayPlan'],
  properties: {
    scenario: { type: 'object', required: ['id', 'contentDirectory', 'phases', 'stateSchema', 'initialState'], properties: { id, contentDirectory: { type: 'string' }, phases: objectArray, stateSchema: { type: 'object' }, initialState: { type: 'object' } } },
    actors: objectArray,
    institutions: objectArray,
    eventSkeletons: { type: 'array', minItems: 5, maxItems: 8, items: { type: 'object', required: ['id', 'title', 'phase', 'type', 'actorId', 'institutionId', 'after', 'afterAny', 'thread', 'plotFunction', 'choices'], properties: { id, title: nonEmpty, phase: id, type: { enum: ['core', 'reactive', 'ambient', 'debt', 'ending'] }, actorId: id, institutionId: id, after: { type: 'array', items: id }, afterAny: { type: 'array', items: id }, thread: { type: 'array', items: nonEmpty }, plotFunction: nonEmpty, choices: objectArray } } },
    memoryDesign: objectArray,
    debtDesign: objectArray,
    framingPlan: objectArray,
    endingPlan: { type: 'array', minItems: 2, items: { type: 'object' } },
    playerDisplayPlan: { type: 'object' },
  },
};

export const aiDraftSchema: JsonSchema = {
  type: 'object',
  required: ['draftVersion', 'contentDirectory', 'scenario', 'actors', 'institutions', 'events', 'framings'],
  properties: {
    draftVersion: { const: 1 },
    contentDirectory: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
    scenario: { type: 'object', required: ['id', 'title', 'playerRole', 'workspaceLabel', 'opening', 'phases', 'stateSchema', 'initialState'] },
    actors: { type: 'array', minItems: 1, items: { type: 'object', required: ['id', 'name'] } },
    institutions: { type: 'array', minItems: 1, items: { type: 'object', required: ['id', 'name'] } },
    events: { type: 'array', minItems: 5, maxItems: 8, items: { type: 'object', required: ['id', 'title', 'phase', 'actorId', 'institutionId', 'scene', 'choices'] } },
    framings: { type: 'array', items: { type: 'object', required: ['id', 'eventId', 'type', 'stance', 'source', 'title', 'body'] } },
  },
};

export const criticSchema: JsonSchema = {
  type: 'object',
  required: ['summary', 'issues', 'changes', 'repairedDraft'],
  properties: {
    summary: nonEmpty,
    issues: { type: 'array', items: { type: 'object', required: ['severity', 'path', 'problem', 'suggestion'], properties: { severity: { enum: ['error', 'warning'] }, path: nonEmpty, problem: nonEmpty, suggestion: nonEmpty } } },
    changes: { type: 'array', items: nonEmpty },
    repairedDraft: aiDraftSchema,
  },
};

export const repairSchema: JsonSchema = {
  type: 'object',
  required: ['summary', 'changes', 'repairedDraft'],
  properties: {
    summary: nonEmpty,
    changes: { type: 'array', items: nonEmpty },
    repairedDraft: aiDraftSchema,
  },
};
