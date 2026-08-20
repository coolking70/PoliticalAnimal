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

## TODO

- 进入 Stage 2：实现 Newspaper / TV / Government Memo 等 Narrative Framing 模板。
- 增加可访问性与更多内容 Linter 规则（未知 actor/institution、不可达事件图）。
- 为 Memory 冲突加入更严格的“同一语义主题相互矛盾”检测，而不只依赖事件作者标记。
