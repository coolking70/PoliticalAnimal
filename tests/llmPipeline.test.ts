import { describe, expect, it, vi } from 'vitest';
import energyDraft from '../drafts/energy-crisis.ai-draft.json';
import { OpenAiCompatibleProvider, readOpenAiCompatibleConfig } from '../src/generation/openAiCompatibleProvider';
import { generateScenarioPipeline } from '../src/generation/scenarioGenerationPipeline';
import type { LlmProvider, StructuredJsonRequest } from '../src/generation/types';
import { plannerFixture, structureFixture } from './fixtures/llmGeneration';

class FixtureProvider implements LlmProvider {
  readonly name = 'fixture:stage-5';
  readonly calls: StructuredJsonRequest[] = [];

  constructor(private readonly responses: unknown[]) {}

  async generateJson<T>(request: StructuredJsonRequest): Promise<T> {
    this.calls.push(request);
    if (!this.responses.length) throw new Error(`缺少 ${request.stage} fixture`);
    return this.responses.shift() as T;
  }
}

function critic(draft: unknown) {
  return { summary: '已检查结构与叙事质量。', issues: [], changes: [], repairedDraft: draft };
}

function brokenDraft() {
  const draft = structuredClone(energyDraft);
  for (const event of draft.events) if (event.type === 'ending') event.type = 'core';
  return draft;
}

const pipelineOptions = {
  authoringSpec: 'fixture authoring spec',
  now: () => new Date('2026-08-21T00:00:00.000Z'),
};

describe('LLM scenario generation pipeline', () => {
  it('runs Planner → Structure → Content → Critic → Validator with a playable 5–8 event fixture', async () => {
    const provider = new FixtureProvider([plannerFixture, structureFixture, energyDraft, critic(energyDraft)]);
    const result = await generateScenarioPipeline('狐狸共和国能源危机', provider, pipelineOptions);

    expect(result.status).toBe('success');
    expect((result.draft as typeof energyDraft).events).toHaveLength(8);
    expect(provider.calls.map((call) => call.stage)).toEqual(['planner', 'structure', 'content', 'critic']);
    expect(provider.calls[1].userPrompt).toContain(plannerFixture.politicalConflict);
    expect(provider.calls[2].userPrompt).toContain(structureFixture.memoryDesign[0].topic);
    expect(result.report.validationAttempts).toEqual([{ attempt: 0, issues: [] }]);
  });

  it('repairs Validator errors and records the error plus repair history', async () => {
    const broken = brokenDraft();
    const provider = new FixtureProvider([
      plannerFixture,
      structureFixture,
      broken,
      critic(broken),
      { summary: '恢复正式结局。', changes: ['恢复三个 ending 类型'], repairedDraft: energyDraft },
    ]);
    const result = await generateScenarioPipeline('狐狸共和国能源危机', provider, pipelineOptions);

    expect(result.status).toBe('success');
    expect(provider.calls.map((call) => call.stage)).toEqual(['planner', 'structure', 'content', 'critic', 'repair']);
    expect(result.report.validationAttempts).toHaveLength(2);
    expect(result.report.validationAttempts[0].issues.map((issue) => issue.code)).toContain('missing_ending');
    expect(result.report.validationAttempts[0].repair?.changes).toContain('恢复三个 ending 类型');
    expect(result.report.validationAttempts[1].issues).toEqual([]);
  });

  it('stops after at most three repair calls and retains the final failed draft/report', async () => {
    const broken = brokenDraft();
    const failedRepair = { summary: '未能修复。', changes: ['保留原状'], repairedDraft: broken };
    const provider = new FixtureProvider([
      plannerFixture,
      structureFixture,
      broken,
      critic(broken),
      failedRepair,
      failedRepair,
      failedRepair,
    ]);
    const result = await generateScenarioPipeline('狐狸共和国能源危机', provider, { ...pipelineOptions, maxRepairAttempts: 99 });

    expect(result.status).toBe('failed');
    expect(provider.calls.filter((call) => call.stage === 'repair')).toHaveLength(3);
    expect(result.report.validationAttempts).toHaveLength(4);
    expect(result.report.validationAttempts.at(-1)?.issues.length).toBeGreaterThan(0);
    expect(result.draft).toEqual(broken);
  });
});

describe('OpenAI-compatible provider', () => {
  it('reads all sensitive configuration from environment values', () => {
    const config = readOpenAiCompatibleConfig({
      POLITICAL_ANIMAL_LLM_API_URL: 'https://example.test/v1/chat/completions',
      POLITICAL_ANIMAL_LLM_API_KEY: 'test-secret',
      POLITICAL_ANIMAL_LLM_MODEL: 'fixture-model',
    });
    expect(config).toMatchObject({ apiUrl: 'https://example.test/v1/chat/completions', apiKey: 'test-secret', model: 'fixture-model' });
    expect(() => readOpenAiCompatibleConfig({})).toThrow('POLITICAL_ANIMAL_LLM_API_URL');
  });

  it('sends JSON Schema to a Chat Completions endpoint without exposing the key in provider metadata', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 }));
    const provider = new OpenAiCompatibleProvider({
      apiUrl: 'https://example.test/v1/chat/completions',
      apiKey: 'test-secret',
      model: 'fixture-model',
    }, fetchMock as unknown as typeof fetch);
    const output = await provider.generateJson<{ ok: boolean }>({
      stage: 'planner',
      schemaName: 'fixture_schema',
      schema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } },
      systemPrompt: 'system',
      userPrompt: 'user',
    });

    expect(output).toEqual({ ok: true });
    expect(provider.name).toBe('openai-compatible:fixture-model');
    expect(provider.name).not.toContain('test-secret');
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(request.body as string);
    expect((request.headers as Record<string, string>).Authorization).toBe('Bearer test-secret');
    expect(body.response_format.json_schema).toMatchObject({ name: 'fixture_schema', schema: { type: 'object' } });
  });

  it('also supports OpenAI-compatible Responses endpoints', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ output_text: '{"ok":true}' }), { status: 200 }));
    const provider = new OpenAiCompatibleProvider({
      apiUrl: 'https://example.test/v1/responses',
      apiKey: 'test-secret',
      model: 'fixture-model',
    }, fetchMock as unknown as typeof fetch);
    const output = await provider.generateJson<{ ok: boolean }>({
      stage: 'critic',
      schemaName: 'fixture_schema',
      schema: { type: 'object' },
      systemPrompt: 'system',
      userPrompt: 'user',
    });
    expect(output.ok).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.text.format.type).toBe('json_schema');
    expect(body.store).toBe(false);
  });
});
