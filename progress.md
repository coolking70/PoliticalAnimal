Original prompt: 请参考 Political_Animal_Game_Design_v0.1.md，进行项目初始化和前期开发

## 2026-08-20

- 阅读 v0.1 设计文档，确定首轮边界为 Stage 0。
- 初始化 Vite + React + TypeScript + Vitest 工程。
- 完成结构化 Condition / Effect、Mulberry32 Seed RNG、事件筛选与存档序列化核心。
- 录入教育改革 E01–E10 和 Stage 0 总结事件；不同选择会跳过或开启创造力考试路线。
- 完成主场景、历史、政治档案占位、设置、Debug 五页 UI，并提供 render_game_to_text / advanceTime。
- 添加核心引擎、存档、分支和 10,000 局随机 Bot 内容测试。
- 首轮测试：9 项通过，10,000 局无死路；修复构建发现的 Vite/CSS 类型配置。
- 自动截图发现测试客户端只截取装饰 canvas；按 DOM 叙事设计改为 CSS 背景，使 Playwright 能核对完整界面，并补充 A/B/Enter 自动化快捷键。
- 最终验证：`npm run build` 成功，9 项 Vitest 全部通过，内容校验与 10,000 局 Bot 通过。
- Playwright 实测 E01→S0_END 完整链路、A/B 分支、历史状态与 Debug 导航；已目视检查开始后、终局、Debug 截图，控制台无错误。
- 开始 Stage 1：新增 Memory/Debt 数据模型、引擎接口、语义条件 scope 与动态叙事/历史模板；存档升级到 v2 并兼容迁移 v1。
- 为 E01–E10 补充关键公开承诺与政治债务；录入 E11–E20，E17 通过 `{{memory:education_principle}}` 动态引用实际旧话，E19 选项按过去路线解锁。
- 政治档案页改为实际 Memory/Debt 台账，Debug 与 render_game_to_text 同步暴露语义状态；添加旧话插值、债务结清、条件结局和存档迁移测试。
- Stage 1 验证完成：13 项测试、10,000 局 Bot、E16 债务兑现、E17 动态旧话、政治档案与 E20 动态历史评价均通过 Playwright 和截图目视检查，控制台无错误。
- Stage 1.1：事件调度加入 Debt / Memory / Thread / Urgency bonus 与 Repetition penalty，并输出完整权重明细。
- Debt strength 参与压力上限、增长和有效强度；事件通过 debtTopics / memoryTopics 接入调度。
- 以 mandate / design / implementation / backlash / reckoning / ending Phase 替代 story_step 串行控制，同阶段事件可按 Seed 改变顺序。
- Actor / Institution 完全改为 ID 引用；新增 Scenario Registry、v3 通用存档和正式 playing/completed ending 状态。
- Content Validator 覆盖未知/重复引用、状态字段拼写、依赖环、空阶段与 ending；GitHub Actions 执行 build/test/validate-content。
- 第一轮 Stage 1.1 验证：17 项测试通过，10,000 Seed 全部完成 ending 且存在多种事件顺序。
- Playwright 验证 Phase 候选权重 Debug、Actor/Institution 展示和正式 completed 结算页，状态与截图一致且控制台无错误。
- Validator 再加入 actor/institution 归属一致性、condition/effect 类型规则与最终 ending phase 死路检查。
- Stage 2：新增通用 Narrative Framing 数据模型与事件结算后队列，不改变事件调度与回合数。
- 新增 Newspaper / TV News / Government Memo / Internal Memo 四类模板，统一实现、按 framing type 呈现明显不同的视觉语言。
- Framing 模板解析支持 World State、Political Memory、Political Debt、实际 Choice、official_terms 与历史评价。
- 教育 Demo 为 E05 / E12 / E13 / E14 / E16 / E17 / E20 配置 14 个政府、媒体、反对派、机构和国外观察版本。
- Debt 条件查询改为可匹配 paid / broken / expired；事件调度 Debt Bonus 依然显式过滤 active debt。
- 存档升级为 v4 / engine 0.4.0，按 Stage 2 边界不提供旧存档迁移。
- Stage 2 验证：22 项 Vitest、6 项内容校验、10,000 Seed 全部通过，生产构建成功。
- Playwright 实测 Newspaper、TV News、Government Memo、Internal Memo 的展示与连续阅读；截图、render_game_to_text 和控制台状态一致。
- E20 实测为先正常结算 completed，再展示两个历史 framing，读完进入原结算页，无新线性节点或控制台错误。
- Stage 3：新建独立 `content/penguin-strait/` 剧本，包含 20 个事件、5 个阶段、8 个角色、7 个机构、4 个结局与 14 个 framing。
- 企鹅海峡剧本复用 Memory、Political Debt、确定性权重调度、official_terms 和事件后 Framing 队列，没有新增题材专用引擎。
- 军方、渔民、盟友与对方政府债务会推高相关事件权重；公开红线与危机官方措辞会在后续事件和公文中引用。
- Scenario Registry 现同时注册教育与外交剧本；主菜单新增剧本与玩家身份选择，工作区标签从 Scenario JSON 读取。
- 将教育专用的历史评价函数替换为 Scenario JSON 条件文本，教育和海峡结局共用同一渲染逻辑。
- Stage 3 自动验证：29 项 Vitest、9 项内容校验，两个剧本各 10,000 Seed 全部完成且均有事件顺序变化。
- Playwright 已目视检查双剧本菜单、外交部战情室、政府公文 framing、official wording 重复引用、外交结局与教育结局，控制台无错误。

## 2026-08-21

- Stage 3.1：新增统一玩家显示层，通用翻译债务状态、布尔值与空值；Scenario 可按字段声明自己的枚举显示名称，底层存档与 Debug 原始值保持不变。
- 清理两套剧本全部 Framing 的状态转储式措辞，将考试批准、改革指标、红线兑现、巡航授权、政治债务与协议类型改写为自然的新闻、公文和内部备忘录语言。
- 普通界面移除 Stage、Scenario Complete、事件类型枚举、线程 ID、事件 ID 与政治档案内部 topic/id；阶段、事件类别、来源立场和债权人均改用玩家可读名称。
- 顶部、设置与完成页增加返回剧本选择入口；进行中的剧本会弹出确认框，继续游戏可关闭，放弃返回只清除当前运行状态且不删除手动存档。
- 第一轮回归验证：生产构建、29 项既有测试、9 项内容校验均通过。
- Stage 3.1 浏览器验证完成：目视检查首页、事件页、返回确认框、政府文件、政治档案和完成页；双剧本重选、继续游戏、放弃返回、手动存档恢复及完成后直接返回均正常，控制台无错误。
- 新增内容测试检查所有 Framing 引用的机器式字符串均有玩家显示映射，避免后续内容再次把带下划线的枚举直接展示给玩家。
- Stage 3.1 最终验证：生产构建、32 项 Vitest 与 11 项内容校验全部通过；两套剧本各 10,000 Seed 的完成性回归保持通过。
- Stage 3.1 合并前验收修正：历史时间线移除 Event ID；普通政治档案将 Debt pressure/strength 改为定性描述，精确值仅留在 Debug；缺失 Memory 的模板回退文案改为题材无关表述。
- Stage 3.1 合并前复验：生产构建、32 项 Vitest、11 项内容校验通过；目视确认历史页与政治档案的新文案，试玩状态一致且无新增控制台错误。
- Stage 4：整理当前真实 JSON 能力为 `docs/AI_AUTHORING_SPEC.md`，并提供单文件 AI Draft JSON Schema；规范覆盖 Condition、Effect、Memory、Debt、Framing、模板与 playerDisplay。
- 新增 `import-scenario` CLI：只补安全默认值，先在内存调用现有 Content Validator，0 错误后再原子拆分五个正式 JSON；已有目标目录拒绝覆盖。
- Content Validator 增强 AI 内容保护：非法 ID/operator/effect/debt action、未知引用与模板、未来依赖、开场/ending 结构死路、玩家可见 snake_case 枚举缺失映射。
- Scenario Registry 改为自动发现完整 `content/*/` 目录，未来导入新剧本不再修改手工 import 列表。
- 《狐狸共和国能源危机》完全由 `drafts/energy-crisis.ai-draft.json` 经 Importer 生成：8 个事件、4 阶段、5 个 Framing、3 个 ending。
- Importer 失败安全实测：含未知 actor、未知 state 模板与缺失 ending 的 Draft 一次报告 4 个问题，目标目录未创建；有效 Draft 的标准化结果与正式目录逐字段一致。
- Stage 4 浏览器验收完成：能源危机 Demo 从开场完整进入 ending，五个事件后 Framing 均可正常阅读并回到调度；结局后无刷新返回三剧本首页，控制台无错误或警告。

## TODO

- 后续可增加可访问性与更精细的不可达事件图分析。
- 为 Memory 冲突加入更严格的“同一语义主题相互矛盾”检测，而不只依赖事件作者标记。
