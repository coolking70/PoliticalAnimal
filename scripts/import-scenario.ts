import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { normalizeAiDraft } from '../src/content/aiDraft.ts';
import { validateScenarioBundle } from '../src/content/contentValidator.ts';

function usage(): never {
  console.error('用法：npm run import-scenario -- <draft.json> [--output-root <content目录>]');
  process.exit(2);
}

function parseArguments(argv: string[]) {
  const draftPath = argv[0];
  if (!draftPath) usage();
  let outputRoot = path.resolve('content');
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] !== '--output-root' || !argv[index + 1]) usage();
    outputRoot = path.resolve(argv[index + 1]);
    index += 1;
  }
  return { draftPath: path.resolve(draftPath), outputRoot };
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(target: string, value: unknown) {
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const { draftPath, outputRoot } = parseArguments(process.argv.slice(2));
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(draftPath, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取 Draft JSON：${error instanceof Error ? error.message : String(error)}`);
  }

  const { contentDirectory, bundle } = normalizeAiDraft(parsed);
  const issues = validateScenarioBundle(bundle);
  if (issues.length) {
    console.error(`导入已取消：内容校验发现 ${issues.length} 个问题。`);
    for (const issue of issues) console.error(`- [${issue.code}] ${issue.path}: ${issue.message}`);
    process.exitCode = 1;
    return;
  }

  const destination = path.join(outputRoot, contentDirectory);
  if (await exists(destination)) throw new Error(`目标目录已存在，拒绝覆盖：${destination}`);
  await mkdir(outputRoot, { recursive: true });
  const temporary = path.join(outputRoot, `.${contentDirectory}.import-${process.pid}`);
  try {
    await mkdir(path.join(temporary, 'events'), { recursive: true });
    await Promise.all([
      writeJson(path.join(temporary, 'scenario.json'), bundle.scenario),
      writeJson(path.join(temporary, 'actors.json'), bundle.actors),
      writeJson(path.join(temporary, 'institutions.json'), bundle.institutions),
      writeJson(path.join(temporary, 'events', 'events.json'), bundle.events),
      writeJson(path.join(temporary, 'framings.json'), bundle.framings),
    ]);
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }

  console.log(`导入成功：${bundle.scenario.title}`);
  console.log(`已写入：${destination}`);
  console.log(`事件 ${bundle.events.length} 个，Framing ${bundle.framings.length} 个，Validator 0 错误。`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
