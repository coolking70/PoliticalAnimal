# Stage 5 LLM Scenario Generation Pipeline

Stage 5 在 Stage 4 的 AI Draft / Importer / Content Validator 前增加真实 LLM 生成层。模型只生成结构化 JSON，不获得文件、终端或源码修改能力。

## 配置

所有 Provider 配置只从进程环境读取：

```bash
export POLITICAL_ANIMAL_LLM_API_URL="https://api.example.com/v1/chat/completions"
export POLITICAL_ANIMAL_LLM_API_KEY="..."
export POLITICAL_ANIMAL_LLM_MODEL="your-model"

# 可选，默认 120000 ms
export POLITICAL_ANIMAL_LLM_TIMEOUT_MS="120000"

# 可选，默认 16384；Chat 映射为 max_tokens，Responses 映射为 max_output_tokens
export POLITICAL_ANIMAL_LLM_MAX_OUTPUT_TOKENS="16384"
```

- `API_URL` 必须是完整、无内嵌账号密码的 HTTP(S) endpoint。
- URL 路径以 `/responses` 结尾时使用 Responses 请求/响应包；其他 URL 使用 OpenAI-compatible Chat Completions 请求/响应包。
- 两种模式优先发送 JSON Schema response format。若 Chat Completions endpoint 明确以 HTTP 400/422 拒绝该格式，或 200 响应仍无法解析成 JSON，Provider 会重试一次 `json_object`，同时把 Schema 加入提示；最终仍由本地 Draft Normalizer / Validator 决定是否合法。Responses endpoint 不做协议降级，任何模式都不会无限重试。
- API Key 只放在 `Authorization` 请求头，不写入 Draft、报告、日志或仓库。
- `.env`、`.env.*` 与 `drafts/generated/` 已加入 `.gitignore`。

OpenAI Responses 的结构化输出参数可参考[官方 OpenAI API 文档](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)。兼容服务的字段支持情况由相应服务商决定。

## 分阶段流程

```text
用户主题
  → Planner JSON
  → Structure JSON（读取 Planner）
  → Content JSON（读取 Planner + Structure，输出 AiScenarioDraft）
  → Critic JSON（检查并返回 repairedDraft）
  → normalizeAiDraft + Content Validator
      ├─ 0 错误：保存合法 Draft
      └─ 有错误：Validator issues + 当前 Draft → Repair JSON（最多 3 次）
  → 可选调用 Stage 4 Importer
```

每一阶段都通过独立 JSON Schema 请求结构化输出。Pipeline 会把上一阶段 JSON 明确传给下一阶段；模型不能执行工具，也不能直接修改 `src/`、`content/` 或任何项目文件。

### Planner

确定架空主题、玩家身份、政治冲突、3–5 个阶段、主要角色与机构，以及制度性荒诞的核心机制。

### Structure

定义 World State、5–8 个事件骨架、非完全线性的依赖、Memory/Debt 的创建与延迟回收、Framing 视角、2–4 个 ending 和 `playerDisplay` 计划。

### Content

按现有 `AiScenarioDraft` 补全事件、选项、效果、正文、Framing、历史评价与玩家显示映射，不允许发明新引擎字段。

### Critic / Repair

Critic 在 Validator 前检查逻辑矛盾、现实群体影射、机器字段泄露、state dump 式新闻、笑话重复、选项同质和普通选择题小说化。Validator 失败后，Repair 只处理明确错误及直接连带问题，最多调用 3 次。

## CLI

只生成 Draft：

```bash
npm run generate-scenario -- "一场因为首都禁止鸽子喂食而引发的政治危机"
```

生成并继续调用现有 Importer：

```bash
npm run generate-scenario -- "一场因为首都禁止鸽子喂食而引发的政治危机" --import
```

可选参数：

- `--output-root <目录>`：Draft / 报告输出目录，默认 `drafts/generated/`。
- `--content-root <目录>`：`--import` 的正式内容根目录，默认 `content/`。
- 目标 Draft 文件已存在时自动使用递增后缀，避免覆盖旧生成记录。

成功产物：

```text
drafts/generated/<scenario>.ai-draft.json
drafts/generated/<scenario>.generation-report.json
```

连续 3 次 Repair 后仍失败时：

```text
drafts/generated/<scenario>.failed.ai-draft.json
drafts/generated/<scenario>.generation-report.json
```

失败报告保留 Planner、Structure、原始 Content、Critic 摘要，以及每轮 Validator 错误和 Repair 改动；不会调用 Importer，也不会写入正式 `content/`。

## 测试

普通测试使用固定 Provider fixture，不访问网络：

```bash
npm test
```

它覆盖完整四阶段生成、一次成功 Repair、三次失败上限、错误历史、Chat Completions 与 Responses 请求格式。Fixture 的最终 Draft 有 8 个事件并可通过真实 Content Validator。

真实 API Smoke Test 独立运行，不属于 CI：

```bash
npm run smoke:llm
```

Smoke Test 使用“首都禁止鸽子喂食引发政治危机”的小型主题，执行真实四阶段调用与 Validator/Repair，但不会自动导入 `content/`。缺少环境变量时会在发出网络请求前清晰失败。

能力较弱或推理文本较长的兼容模型可能需要显式提高 `POLITICAL_ANIMAL_LLM_TIMEOUT_MS` 与 `POLITICAL_ANIMAL_LLM_MAX_OUTPUT_TOKENS`。即使模型完成所有阶段，只要三次 Repair 后仍有格式、引用或剧情结构错误，Smoke Test 也会以失败状态保存 Draft/报告并拒绝导入；这属于预期的安全结果。
