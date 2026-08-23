import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { normalizeAiDraft } from '../src/content/aiDraft.ts';
import { OpenAiCompatibleProvider, readOpenAiCompatibleConfig } from '../src/generation/openAiCompatibleProvider.ts';
import { generateScenarioPipeline } from '../src/generation/scenarioGenerationPipeline.ts';

const SMOKE_THEME = '一场因为首都禁止鸽子喂食而引发的政治危机';

function usage(): never {
  console.error('用法：npm run generate-scenario -- "<剧本主题>" [--import] [--output-root <draft目录>] [--content-root <content目录>]');
  console.error('真实 API Smoke Test：npm run smoke:llm');
  process.exit(2);
}

function parseArguments(argv: string[]) {
  let shouldImport = false;
  let smoke = false;
  let outputRoot = path.resolve('drafts/generated');
  let contentRoot = path.resolve('content');
  const themeParts: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--import') shouldImport = true;
    else if (argument === '--smoke') smoke = true;
    else if (argument === '--output-root' && argv[index + 1]) outputRoot = path.resolve(argv[++index]);
    else if (argument === '--content-root' && argv[index + 1]) contentRoot = path.resolve(argv[++index]);
    else if (argument.startsWith('--')) usage();
    else themeParts.push(argument);
  }
  const theme = smoke && !themeParts.length ? SMOKE_THEME : themeParts.join(' ').trim();
  if (!theme) usage();
  if (smoke && shouldImport) throw new Error('真实 API Smoke Test 不导入正式 content，请移除 --import');
  return { theme, shouldImport, outputRoot, contentRoot, smoke };
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function safeStem(draft: unknown): string {
  if (draft && typeof draft === 'object') {
    const scenario = (draft as { scenario?: unknown }).scenario;
    if (scenario && typeof scenario === 'object') {
      const id = (scenario as { id?: unknown }).id;
      if (typeof id === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) return id.replaceAll('_', '-').toLowerCase();
    }
  }
  return `failed-scenario-${Date.now()}`;
}

async function uniquePath(root: string, basename: string): Promise<string> {
  const extensionIndex = basename.indexOf('.');
  const stem = extensionIndex === -1 ? basename : basename.slice(0, extensionIndex);
  const extension = extensionIndex === -1 ? '' : basename.slice(extensionIndex);
  let candidate = path.join(root, basename);
  for (let suffix = 2; await exists(candidate); suffix += 1) candidate = path.join(root, `${stem}-${suffix}${extension}`);
  return candidate;
}

async function writeJsonAtomic(target: string, value: unknown) {
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, target);
}

async function runImporter(draftPath: string, contentRoot: string): Promise<void> {
  const importer = fileURLToPath(new URL('./import-scenario.ts', import.meta.url));
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', importer, draftPath, '--output-root', contentRoot], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Importer 退出码：${code ?? 'unknown'}`)));
  });
}

async function main() {
  const { theme, shouldImport, outputRoot, contentRoot, smoke } = parseArguments(process.argv.slice(2));
  const authoringSpec = await readFile(new URL('../docs/AI_AUTHORING_SPEC.md', import.meta.url), 'utf8');
  const config = readOpenAiCompatibleConfig(process.env);
  const provider = new OpenAiCompatibleProvider(config);
  console.log(`${smoke ? '真实 API Smoke Test' : 'LLM Scenario Generation'}：${theme}`);
  console.log(`Provider：${provider.name}`);
  const result = await generateScenarioPipeline(theme, provider, {
    authoringSpec,
    maxRepairAttempts: 3,
    onStage: (message) => console.log(`→ ${message}`),
  });

  await mkdir(outputRoot, { recursive: true });
  const stem = result.status === 'success' ? normalizeAiDraft(result.draft).contentDirectory : safeStem(result.draft);
  const draftBasename = result.status === 'success' ? `${stem}.ai-draft.json` : `${stem}.failed.ai-draft.json`;
  const draftPath = await uniquePath(outputRoot, draftBasename);
  const reportPath = await uniquePath(outputRoot, `${stem}.generation-report.json`);
  await writeJsonAtomic(draftPath, result.draft);
  await writeJsonAtomic(reportPath, result.report);
  console.log(`Draft：${draftPath}`);
  console.log(`报告：${reportPath}`);

  if (result.status === 'failed') {
    const lastIssues = result.report.validationAttempts.at(-1)?.issues ?? [];
    console.error(`生成失败：经过最多 3 次 Repair 后仍有 ${lastIssues.length} 个 Validator 问题；未写入正式 content。`);
    process.exitCode = 1;
    return;
  }
  console.log(`生成成功：Validator 0 错误，共使用 ${result.report.validationAttempts.length - 1} 次 Repair。`);
  if (shouldImport) await runImporter(draftPath, contentRoot);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
