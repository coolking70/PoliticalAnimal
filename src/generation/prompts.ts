const WORLD_RULES = `
你是《政治动物》的架空拟人政治讽刺剧本作者。所有角色必须是拟人动物，国家、机构和冲突完全架空；不要把现实受保护群体替换成动物来影射。
核心不是国家数值模拟或普通选择题小说，而是：制度性荒诞、理性个人行为叠加成荒谬系统结果、承诺的延迟后果、Political Memory、Political Debt，以及同一事实被政府/媒体/反对派/机构/国外观察者解释成不同版本。
你只能返回所要求的 JSON 数据，不得建议、编写或修改项目源码，不得使用 Markdown 代码块。
`;

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function plannerPrompts(theme: string) {
  return {
    systemPrompt: WORLD_RULES,
    userPrompt: `为主题“${theme}”制定短篇 Scenario 计划。规模限制为 5–8 个事件、3–5 个阶段、4–8 个主要角色、3–6 个机构、2–4 个结局。明确玩家身份、政治冲突、制度激励与至少三条可反复回收的讽刺逻辑。ID 使用稳定英文机器值。`,
  };
}

export function structurePrompts(theme: string, planner: unknown, authoringSpec: string) {
  return {
    systemPrompt: WORLD_RULES,
    userPrompt: `根据 Planner 结果设计可执行结构，不写长篇正文。后一阶段只能使用现有引擎能力。\n\n主题：${theme}\n\nPlanner：\n${json(planner)}\n\n引擎 Authoring Spec：\n${authoringSpec}\n\n要求：定义 World State/初始值、5–8 个事件骨架、阶段内可变顺序、合法 after/afterAny、每条关键 Memory/Debt 的创建与回收、Framing 视角、2–4 个可到达 ending 及 playerDisplay 枚举计划。避免所有事件排成唯一链。`,
  };
}

export function contentPrompts(theme: string, planner: unknown, structure: unknown, authoringSpec: string) {
  return {
    systemPrompt: WORLD_RULES,
    userPrompt: `把既定 Planner 与 Structure 补成完整 AiScenarioDraft。不要改变核心角色、阶段、引用 ID 或分支拓扑。\n\n主题：${theme}\n\nPlanner：\n${json(planner)}\n\nStructure：\n${json(structure)}\n\n引擎 Authoring Spec：\n${authoringSpec}\n\n要求：事件正文和选项必须像政治场景而非状态说明；至少一个延迟 Memory 回收、一个影响后续权重的 active Debt、一个 Debt resolve/break、至少三种 Framing 立场且同一事实至少两个版本；历史评价有条件分支和无条件 fallback；所有玩家可见 snake_case 枚举都有 playerDisplay。`,
  };
}

export function criticPrompts(theme: string, planner: unknown, structure: unknown, draft: unknown, authoringSpec: string) {
  return {
    systemPrompt: WORLD_RULES,
    userPrompt: `你是 Critic。检查并直接修复 Draft，但不得发明引擎能力或改变主题。\n\n主题：${theme}\n\nPlanner：\n${json(planner)}\n\nStructure：\n${json(structure)}\n\nDraft：\n${json(draft)}\n\nAuthoring Spec：\n${authoringSpec}\n\n重点检查：逻辑矛盾、无效 ID/phase/dependency、ending 死路、Memory/Debt 没有延迟回收、机器字段泄露、新闻像 state dump、同一笑话重复、所有选项效果同质、普通选择题小说化、现实群体影射。返回问题、改动摘要和完整 repairedDraft。`,
  };
}

export function repairPrompts(theme: string, draft: unknown, issues: unknown, repairNumber: number, authoringSpec: string) {
  return {
    systemPrompt: WORLD_RULES,
    userPrompt: `这是 Validator Repair 第 ${repairNumber} 次。只修复错误列表指出的问题及其直接连带问题，保留已有合法内容与稳定 ID。\n\n主题：${theme}\n\nValidator 错误：\n${json(issues)}\n\n当前 Draft：\n${json(draft)}\n\nAuthoring Spec：\n${authoringSpec}\n\n返回完整 repairedDraft，并逐条概述改动。不要用删除全部分支、清空 Memory/Debt/Framing 或把 ending 改成无条件单结局来逃避校验。`,
  };
}
