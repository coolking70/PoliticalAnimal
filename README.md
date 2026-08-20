# Political Animal / 政治动物

基于《Political Animal》v0.1 设计文档开发的 Stage 2 浏览器原型。当前垂直切片为“狐狸共和国：伟大的教育改革”。

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
- 主场景、历史、政治档案、设置、Debug 页面
- Scenario Registry / Loader，运行时不写死教育剧本 ID
- Actor / Institution ID 引用与集中内容资料
- 正式 `playing / completed` 状态和可正常结算的 ending
- v4 本地存档/读取与同 Seed 可复现（Stage 2 按需不兼容旧存档）
- `render_game_to_text()` 与 `advanceTime(ms)` 自动测试接口
- Content Validator：事件与 Framing 引用、模板字段、依赖环、空阶段与 ending 校验
- Debt 条件可查询 `active / paid / broken / expired`；调度压力加成仍仅计算 active debt
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
- `Enter / Space`：阅读当前 framing 后继续
- `← / →`：切换页面
- `F`：切换全屏
- `Esc`：退出全屏

## 目录

```text
content/education-demo/  剧本 JSON，独立于引擎
src/engine/              条件、效果、事件选择、Framing、RNG、存档
src/content/             Scenario Registry 与内容校验器
src/models/              数据类型
src/store/               场景运行状态与推进接口
src/                     React 界面
tests/                   引擎与内容测试
```

Stage 2 仅增加数据驱动的叙事表现层；不扩展新剧本，不调用实时 AI 生成，也不把 framing 变成新的线性事件。
