import { AiDraftFormatError, normalizeAiDraft, type AiScenarioDraft } from '../content/aiDraft.ts';
import { validateScenarioBundle, type ContentIssue } from '../content/contentValidator.ts';
import { contentPrompts, criticPrompts, plannerPrompts, repairPrompts, structurePrompts } from './prompts.ts';
import { aiDraftSchema, criticSchema, plannerSchema, repairSchema, structureSchema } from './schemas.ts';
import type { CriticOutput, GenerationReport, LlmProvider, RepairOutput, ScenarioGenerationResult } from './types';

export interface ScenarioGenerationOptions {
  authoringSpec: string;
  maxRepairAttempts?: number;
  now?: () => Date;
  onStage?: (message: string) => void;
}

function formatIssues(candidate: unknown): { draft: AiScenarioDraft | unknown; issues: ContentIssue[] } {
  try {
    const normalized = normalizeAiDraft(candidate);
    return { draft: candidate as AiScenarioDraft, issues: validateScenarioBundle(normalized.bundle) };
  } catch (error) {
    if (error instanceof AiDraftFormatError) {
      return {
        draft: candidate,
        issues: error.problems.map((message, index) => ({ code: 'ai_draft_format', path: `draft.${index}`, message })),
      };
    }
    throw error;
  }
}

function requireObject(value: unknown, stage: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`LLM ${stage} 阶段没有返回 JSON 对象`);
  return value as Record<string, unknown>;
}

export async function generateScenarioPipeline(
  theme: string,
  provider: LlmProvider,
  options: ScenarioGenerationOptions,
): Promise<ScenarioGenerationResult> {
  if (!theme.trim()) throw new Error('剧本主题不能为空');
  if (!options.authoringSpec.trim()) throw new Error('AI Authoring Spec 不能为空');
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const stage = options.onStage ?? (() => undefined);
  const maxRepairAttempts = Math.min(3, Math.max(0, options.maxRepairAttempts ?? 3));

  stage('Planner：整理政治冲突与讽刺逻辑');
  const plannerPrompt = plannerPrompts(theme);
  const planner = requireObject(await provider.generateJson<unknown>({ stage: 'planner', schemaName: 'political_animal_planner', schema: plannerSchema, ...plannerPrompt }), 'Planner');

  stage('Structure：设计状态、事件骨架与延迟后果');
  const structurePrompt = structurePrompts(theme, planner, options.authoringSpec);
  const structure = requireObject(await provider.generateJson<unknown>({ stage: 'structure', schemaName: 'political_animal_structure', schema: structureSchema, ...structurePrompt }), 'Structure');

  stage('Content：生成完整 AI Draft');
  const contentPrompt = contentPrompts(theme, planner, structure, options.authoringSpec);
  const content = await provider.generateJson<unknown>({ stage: 'content', schemaName: 'political_animal_draft', schema: aiDraftSchema, ...contentPrompt });

  stage('Critic：检查政治逻辑与玩家文本');
  const criticPrompt = criticPrompts(theme, planner, structure, content, options.authoringSpec);
  const critic = requireObject(await provider.generateJson<unknown>({ stage: 'critic', schemaName: 'political_animal_critic', schema: criticSchema, ...criticPrompt }), 'Critic') as unknown as CriticOutput;
  if (!('repairedDraft' in critic)) throw new Error('LLM Critic 阶段缺少 repairedDraft');
  let candidate: unknown = critic.repairedDraft;
  const validationAttempts: GenerationReport['validationAttempts'] = [];

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
    stage(`Validator：第 ${attempt + 1} 次校验`);
    const validation = formatIssues(candidate);
    const record: GenerationReport['validationAttempts'][number] = { attempt, issues: validation.issues };
    validationAttempts.push(record);
    if (!validation.issues.length) {
      const report: GenerationReport = {
        reportVersion: 1,
        theme,
        provider: provider.name,
        status: 'success',
        startedAt,
        completedAt: now().toISOString(),
        stages: {
          planner,
          structure,
          content,
          critic: { summary: critic.summary, issues: critic.issues ?? [], changes: critic.changes ?? [] },
        },
        validationAttempts,
      };
      return { status: 'success', draft: validation.draft, report };
    }
    if (attempt === maxRepairAttempts) break;

    const repairNumber = attempt + 1;
    stage(`Repair：根据 ${validation.issues.length} 个 Validator 问题进行第 ${repairNumber} 次修复`);
    const repairPrompt = repairPrompts(theme, candidate, validation.issues, repairNumber, options.authoringSpec);
    const repair = requireObject(await provider.generateJson<unknown>({ stage: 'repair', schemaName: 'political_animal_repair', schema: repairSchema, ...repairPrompt }), 'Repair') as unknown as RepairOutput;
    if (!('repairedDraft' in repair)) throw new Error(`LLM Repair 第 ${repairNumber} 次缺少 repairedDraft`);
    record.repair = { summary: repair.summary, changes: repair.changes ?? [] };
    candidate = repair.repairedDraft;
  }

  const report: GenerationReport = {
    reportVersion: 1,
    theme,
    provider: provider.name,
    status: 'failed',
    startedAt,
    completedAt: now().toISOString(),
    stages: {
      planner,
      structure,
      content,
      critic: { summary: critic.summary, issues: critic.issues ?? [], changes: critic.changes ?? [] },
    },
    validationAttempts,
  };
  return { status: 'failed', draft: candidate, report };
}
