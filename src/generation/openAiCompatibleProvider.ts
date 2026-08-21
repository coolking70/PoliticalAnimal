import type { LlmProvider, StructuredJsonRequest } from './types';

export interface OpenAiCompatibleConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

export class LlmProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmProviderError';
  }
}

function requiredEnvironmentValue(environment: Record<string, string | undefined>, key: string): string {
  const value = environment[key]?.trim();
  if (!value) throw new LlmProviderError(`缺少环境变量 ${key}`);
  return value;
}

export function readOpenAiCompatibleConfig(environment: Record<string, string | undefined>): OpenAiCompatibleConfig {
  const apiUrl = requiredEnvironmentValue(environment, 'POLITICAL_ANIMAL_LLM_API_URL');
  const apiKey = requiredEnvironmentValue(environment, 'POLITICAL_ANIMAL_LLM_API_KEY');
  const model = requiredEnvironmentValue(environment, 'POLITICAL_ANIMAL_LLM_MODEL');
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new LlmProviderError('POLITICAL_ANIMAL_LLM_API_URL 必须是完整的 HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new LlmProviderError('POLITICAL_ANIMAL_LLM_API_URL 必须是无内嵌凭据的 HTTP(S) URL');
  }
  const rawTimeout = environment.POLITICAL_ANIMAL_LLM_TIMEOUT_MS;
  const timeoutMs = rawTimeout === undefined ? 120_000 : Number(rawTimeout);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new LlmProviderError('POLITICAL_ANIMAL_LLM_TIMEOUT_MS 必须是正数');
  }
  return { apiUrl, apiKey, model, timeoutMs };
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : trimmed;
}

function extractChatText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices.length || !choices[0] || typeof choices[0] !== 'object') return undefined;
  const content = (choices[0] as { message?: { content?: unknown } }).message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((item) => item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string'
      ? (item as { text: string }).text
      : '').join('');
  }
  return undefined;
}

function extractResponsesText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === 'string') return direct;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return undefined;
  const texts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object' || !Array.isArray((item as { content?: unknown }).content)) continue;
    for (const content of (item as { content: unknown[] }).content) {
      if (content && typeof content === 'object' && typeof (content as { text?: unknown }).text === 'string') {
        texts.push((content as { text: string }).text);
      }
    }
  }
  return texts.join('') || undefined;
}

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;
  private readonly fetchFn: typeof fetch;
  private readonly config: OpenAiCompatibleConfig;

  constructor(config: OpenAiCompatibleConfig, fetchFn: typeof fetch = fetch) {
    this.config = config;
    this.fetchFn = fetchFn;
    this.name = `openai-compatible:${config.model}`;
  }

  async generateJson<T>(request: StructuredJsonRequest): Promise<T> {
    const responsesMode = new URL(this.config.apiUrl).pathname.replace(/\/$/, '').endsWith('/responses');
    const jsonSchema = {
      name: request.schemaName,
      strict: false,
      schema: request.schema,
    };
    const body = responsesMode
      ? {
          model: this.config.model,
          instructions: request.systemPrompt,
          input: request.userPrompt,
          text: { format: { type: 'json_schema', ...jsonSchema } },
          store: false,
        }
      : {
          model: this.config.model,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
          response_format: { type: 'json_schema', json_schema: jsonSchema },
        };

    let response: Response;
    try {
      response = await this.fetchFn(this.config.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 120_000),
      });
    } catch (error) {
      throw new LlmProviderError(`LLM ${request.stage} 请求失败：${error instanceof Error ? error.message : String(error)}`);
    }

    const responseText = await response.text();
    if (!response.ok) {
      throw new LlmProviderError(`LLM ${request.stage} 返回 HTTP ${response.status}：${responseText.slice(0, 500)}`);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new LlmProviderError(`LLM ${request.stage} 返回的响应包不是 JSON`);
    }
    const generatedText = responsesMode ? extractResponsesText(payload) : extractChatText(payload);
    if (!generatedText) throw new LlmProviderError(`LLM ${request.stage} 响应中缺少结构化文本`);
    try {
      return JSON.parse(stripJsonFence(generatedText)) as T;
    } catch {
      throw new LlmProviderError(`LLM ${request.stage} 输出不是合法 JSON`);
    }
  }
}
