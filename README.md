# Political Animal / 政治动物

基于《Political Animal》v0.1 设计文档开发的 Stage 1.1 浏览器原型。当前垂直切片为“狐狸共和国：伟大的教育改革”。

## 已实现

- React + TypeScript + Vite 工程
- JSON 驱动的 Scenario / Actor / Institution / Event 内容
- 结构化 Condition 与 Effect（无 `eval`），条件可查询 World / Memory / Debt
- Seed RNG、事件筛选、优先级与 `once` 去重
- Political Memory、Political Debt、压力增长、兑现与违约
- Debt `strength` 决定压力上限、增长速度和有效调度强度
- 可解释的事件权重：priority、debt、memory、thread、urgency 与 repetition
- Phase 事件池，同一阶段内的教师、学生、媒体、宗教事件按 Seed 加权调度
- E01–E20 教育改革事件与动态历史评价
- E17 自动引用玩家实际选择产生的总统旧话
- E19 根据标准化、地方自治与专家权力动态开放终局方案
- 主场景、历史、政治档案、设置、Debug 页面
- Scenario Registry / Loader，运行时不写死教育剧本 ID
- Actor / Institution ID 引用与集中内容资料
- 正式 `playing / completed` 状态和可正常结算的 ending
- v3 本地存档/读取、旧存档迁移、同 Seed 可复现
- `render_game_to_text()` 与 `advanceTime(ms)` 自动测试接口
- Content Validator：引用、字段、依赖环、空阶段与 ending 校验
- Vitest 单元测试、10,000 局无死路模拟、GitHub Actions CI

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

## 操作

- 数字键 `1–4`：选择决策
- `← / →`：切换页面
- `F`：切换全屏
- `Esc`：退出全屏

## 目录

```text
content/education-demo/  剧本 JSON，独立于引擎
src/engine/              条件、效果、事件选择、RNG、存档
src/content/             Scenario Registry 与内容校验器
src/models/              数据类型
src/store/               场景运行状态与推进接口
src/                     React 界面
tests/                   引擎与内容测试
```

Stage 1.1 的目标是先保证反应式叙事闭环稳定；当前版本不包含 Stage 2 的 Newspaper / TV / Memo 表现层扩展。
