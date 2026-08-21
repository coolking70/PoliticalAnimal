# Political Animal / 政治动物

基于《Political Animal》v0.1 设计文档开发的 Stage 5 浏览器原型。现有三个可完整游玩的独立剧本，并提供由真实 LLM 主题生成合法 AI Draft 的离线内容生产 CLI。

## 已实现

- React + TypeScript + Vite 工程
- JSON 驱动的 Scenario / Actor / Institution / Event / Framing 内容
- 结构化 Condition 与 Effect（无 `eval`），条件可查询 World / Memory / Debt
- Seed RNG、事件筛选、优先级与 `once` 去重
- Political Memory、Political Debt、压力增长、兑现与违约
- Debt `strength` 决定压力上限、增长速度和有效调度强度
- 可解释的事件权重：priority、debt、memory、thread、urgency 与 repetition
- Phase 事件池，同一阶段内的教师、学生、媒体、宗教事件按 Seed 加权调度
- E01–E20 教育改革事件与动态历史评价
- E17 自动引用玩家实际选择产生的总统旧话
- E19 根据标准化、地方自治与专家权力动态开放终局方案
- 事件结果后的 Framing 队列：一个事件可生成 0～多个叙事版本，不占用剧情回合
- Newspaper、TV News、Government Memo、Internal Memo 四类通用视觉模板
- 政府、媒体、反对派、涉事机构与国外观察者等数据配置立场
- Framing 模板可引用 World State、Memory、Debt、实际 Choice 与 `official_terms`
- E05 / E12 / E13 / E14 / E16 / E17 / E20 关键节点共 14 个 framing
- 《企鹅海峡危机》：20 个事件、5 个阶段、8 个角色、7 个机构、4 个结局与 14 个 framing
- 外交剧本中的公开红线、渔业承诺、军方/渔民/盟友/对方债务和危机措辞均复用现有引擎
- `领海侵犯 / 海上摩擦 / 临时航行误会 / 友好国家间技术性地理分歧` 会被后续新闻和公文重复使用
- 外交、军方、渔业、媒体与国内政治事件在同阶段按 Seed 改变顺序
- 历史评价规则移入 Scenario JSON，引擎不再硬编码教育指标
- 主场景、历史、政治档案、设置、Debug 页面
- Scenario Registry / Loader 自动注册三个剧本，主菜单可选择剧本和玩家身份
- 基于 `import.meta.glob` 的自动 Scenario Registry；新增完整内容目录无需修改注册代码
- 与真实内容格式一致的 [AI Authoring Spec](docs/AI_AUTHORING_SPEC.md) 和 AI Draft JSON Schema
- 单文件 AI Draft → 安全默认值整理 → Content Validator → 原子拆分正式目录的 CLI Importer
- Importer 在任何格式或校验错误时先终止，不写入不完整的正式内容，也拒绝覆盖已有 Scenario
- Content Validator 增强 AI 防护：非法 ID/operator/effect/template、未知引用、未来依赖、开场与 ending 结构死路、玩家枚举缺失映射
- “狐狸共和国能源危机”通过 `drafts/energy-crisis.ai-draft.json` 实际导入：8 个事件、4 个阶段、5 个 Framing、3 个结局
- 独立 OpenAI-compatible Provider；API URL、Key、Model 与 timeout 全部通过环境变量配置
- Planner → Structure → Content → Critic 四阶段结构化 JSON 生成，后一阶段显式读取前一阶段结果
- Validator 失败后最多 3 次 LLM Repair；逐轮保留错误与修复记录，失败 Draft 不进入正式内容
- `generate-scenario` CLI 可只保存 Draft，也可继续调用现有 Importer；模型没有源码或文件修改能力
- 固定 fixture 覆盖无网络自动测试，真实 API Smoke Test 使用独立命令且不进入 CI
- Actor / Institution ID 引用与集中内容资料
- 正式 `playing / completed` 状态和可正常结算的 ending
- v4 本地存档/读取与同 Seed 可复现（Stage 2 按需不兼容旧存档）
- `render_game_to_text()` 与 `advanceTime(ms)` 自动测试接口
- Content Validator：事件与 Framing 引用、模板字段、依赖环、空阶段与 ending 校验
- Debt 条件可查询 `active / paid / broken / expired`；调度压力加成仍仅计算 active debt
- Vitest 单元测试、三个剧本各 10,000 局无死路模拟、GitHub Actions CI

## 本地运行

```bash
npm install
npm run dev
```

构建与验证：

```bash
npm run build
npm test
npm run validate-content
```

AI 内容导入：

```bash
# 新 Draft 默认写入 content/<scenario>/
npm run import-scenario -- path/to/scenario.ai-draft.json

# 可指定其他输出根目录，便于检查生成结果
npm run import-scenario -- drafts/energy-crisis.ai-draft.json --output-root /tmp/political-animal-content
```

Importer 只补展示性或调度性的安全默认值，不猜测关键剧情逻辑。完整字段说明、Condition / Effect / Memory / Debt / Framing / `playerDisplay` 用法见 [AI Authoring Spec](docs/AI_AUTHORING_SPEC.md)。

LLM 剧本生成：

```bash
export POLITICAL_ANIMAL_LLM_API_URL="https://api.example.com/v1/chat/completions"
export POLITICAL_ANIMAL_LLM_API_KEY="..."
export POLITICAL_ANIMAL_LLM_MODEL="your-model"

npm run generate-scenario -- "一场因为首都禁止鸽子喂食而引发的政治危机"
# 校验成功后直接继续 Importer：追加 --import
```

配置、阶段产物、Repair 报告和独立真实 API Smoke Test 见 [LLM Generation Pipeline](docs/LLM_GENERATION_PIPELINE.md)。密钥不会写入项目、Draft 或生成报告。

## 操作

- 数字键 `1–4`：选择决策
- 主菜单选择剧本后，`Enter / Space`：开始剧本
- 剧情中 `Enter / Space`：阅读当前 framing 后继续
- `← / →`：切换页面
- `F`：切换全屏
- `Esc`：退出全屏

## 目录

```text
content/education-demo/  教育改革剧本 JSON
content/penguin-strait/  企鹅海峡危机剧本 JSON
content/energy-crisis/    由 AI Draft Importer 生成的能源危机剧本
drafts/                   单文件 AI Draft 源文件
docs/                     Authoring Spec、Draft Schema 与 LLM Pipeline 文档
scripts/                  Scenario Importer 与 LLM Generation CLI
src/generation/           Provider、阶段提示、JSON Schema 与 Repair Pipeline
src/engine/               条件、效果、事件选择、Framing、RNG、存档
src/content/              Scenario Registry 与内容校验器
src/models/               数据类型
src/store/                场景运行状态与推进接口
src/                      React 界面
tests/                    引擎、内容与 LLM Fixture 测试
```

Stage 5 接入命令行真实 LLM 内容生成，但不在游戏运行时调用 AI，不做 NPC 对话、玩家 UI 生成器、数据库或后台服务。
