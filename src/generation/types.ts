import type { AiScenarioDraft } from '../content/aiDraft';
import type { ContentIssue } from '../content/contentValidator';

export type GenerationStage = 'planner' | 'structure' | 'content' | 'critic' | 'repair';

export type JsonSchema = Record<string, unknown>;

export interface StructuredJsonRequest {
  stage: GenerationStage;
  schemaName: string;
  schema: JsonSchema;
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmProvider {
  readonly name: string;
  generateJson<T>(request: StructuredJsonRequest): Promise<T>;
}

export interface CriticOutput {
  summary: string;
  issues: Array<{
    severity: 'error' | 'warning';
    path: string;
    problem: string;
    suggestion: string;
  }>;
  changes: string[];
  repairedDraft: unknown;
}

export interface RepairOutput {
  summary: string;
  changes: string[];
  repairedDraft: unknown;
}

export interface ValidationAttempt {
  attempt: number;
  issues: ContentIssue[];
  repair?: {
    summary: string;
    changes: string[];
  };
}

export interface GenerationReport {
  reportVersion: 1;
  theme: string;
  provider: string;
  status: 'success' | 'failed';
  startedAt: string;
  completedAt: string;
  stages: {
    planner: unknown;
    structure: unknown;
    content: unknown;
    critic: Omit<CriticOutput, 'repairedDraft'>;
  };
  validationAttempts: ValidationAttempt[];
}

export interface ScenarioGenerationResult {
  status: 'success' | 'failed';
  draft: AiScenarioDraft | unknown;
  report: GenerationReport;
}
