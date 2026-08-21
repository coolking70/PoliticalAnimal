# Political Animal AI Authoring Spec

本规范描述当前引擎实际支持的内容结构。AI 不应发明新字段、新 operator 或脚本表达式。推荐先生成一个单文件 AI Draft，再用 Importer 拆分、校验并导入正式 `content/` 目录。

## 1. Pipeline

```text
单文件 *.ai-draft.json
  → npm run import-scenario -- <draft路径>
  → 内存标准化（只补安全默认值）
  → Content Validator
  → 0 错误时原子写入 content/<scenario>/
  → Scenario Registry 自动发现
  → build / test / validate-content
```

Importer 不调用在线 LLM，不修补剧情分支，也不猜测 ending、phase、角色引用或状态效果。正式目录已经存在时会拒绝覆盖。

## 2. AI Draft 顶层

```json
{
  "draftVersion": 1,
  "contentDirectory": "energy-crisis",
  "scenario": {},
  "actors": [],
  "institutions": [],
  "events": [],
  "framings": []
}
```

- `draftVersion`：当前固定为 `1`。
- `contentDirectory`：可省略；默认由 `scenario.id` 的下划线转为连字符。只能使用小写字母、数字、单连字符。
- `scenario / actors / institutions / events`：必需。`framings` 可省略并默认为空数组。
- Draft 尽量直接使用正式格式。Importer 只会补下列安全默认值：
  - Actor：`species: "unknown"`、`emoji: "◆"`、`role: "未说明身份"`
  - Institution：缺失说明文字补为 `"未说明"`
  - Event：`type: "core"`、`thread: []`、`priority: 100`、`weight: 1`、`once: true`
  - Choice：`effects: []`
  - Scenario：缺失 `subtitle` 时使用 `"AI 内容管线试作"`

## 3. Scenario

必需字段：

- `id`：稳定机器 ID，例如 `energy_crisis`。
- `title / subtitle / playerRole / workspaceLabel / opening`：玩家可见文字。
- `phases`：有序 `{ "id", "label" }[]`。最后阶段必须包含 `type: "ending"` 的事件。
- `stateSchema`：World State 字段及类型。仅支持 `number / boolean / string / string[]`。
- `initialState`：必须为 `stateSchema` 的每个字段提供同类型初始值。
- `historyEvaluations`：可选；从上到下选择第一条满足 `requirements` 的历史评价，建议最后提供无条件 fallback。
- `playerDisplay`：可选的玩家显示映射。机器值保持不变，只改变模板和普通 UI 的显示。

```json
"playerDisplay": {
  "values": { "active": "尚未兑现" },
  "fields": {
    "energy_policy": {
      "emergency_imports": "紧急进口计划"
    }
  }
}
```

凡是通过 `{{state:field}}` 展示给玩家、且值为 `snake_case` 机器枚举的字段，必须为所有可能值配置映射。

## 4. Actor 与 Institution

Actor：`id / name / species / emoji / role`，可选 `institutionId`。若声明 `institutionId`，必须指向已有 Institution；事件中的 Actor 与 Institution 也必须一致。

Institution：`id / name / mission / institutional_interest`。

所有 ID 必须以字母开头，只能包含字母、数字、下划线、连字符，并在各自集合内唯一。

## 5. Event 与 Choice

Event 必需：`id / title / phase / actorId / institutionId / scene / choices`。

- `type`：`core / reactive / ambient / debt / ending`
- `thread`：主题标签数组，用于近期线程权重。
- `priority / weight`：确定性事件调度的基础分。
- `once`：通常为 `true`。
- `after`：列出的事件必须全部完成。
- `afterAny`：列出的事件至少完成一个。
- `requirements / blockers`：结构化 Condition。
- `debtTopics / memoryTopics`：把相关债务或记忆压力接入事件权重。
- `urgencyFields`：World State 中的数值字段，为事件增加 urgency。

Choice 必需：`id / label / response`；`effects` 可为空。可选 `requirements / memories / debts / debtActions`。

### Effect

```json
{ "field": "public_anger", "operation": "increment", "value": 2 }
```

- `set`：值类型必须匹配 `stateSchema`。
- `increment / decrement`：只用于 `number`。
- `push`：只用于 `string[]`。

### Memory

```json
{
  "speaker": "energy_minister",
  "topic": "blackout_promise",
  "statement": "今晚必须恢复供电。",
  "public": true,
  "importance": 4,
  "tags": ["energy", "promise"]
}
```

`speaker` 必须是 Actor ID。`topic` 是后续模板与 `memoryTopics` 使用的语义键。

### Political Debt

```json
{
  "creditor": "power_utility",
  "type": "bailout_promise",
  "topic": "utility_support",
  "strength": 3,
  "pressure": 2,
  "description": "电力公司等待政府兑现救助。",
  "tags": ["utility", "promise"]
}
```

- `strength` 决定压力上限、增长与有效强度；`pressure` 是当前压力。
- `debtActions` 只支持 `{ "action": "resolve" | "break", "topic": "..." }`。
- Debt Condition 可查询 `active / paid / broken / expired`；事件 Debt Bonus 只计算 active debt。

## 6. Condition

Leaf：

```json
{ "field": "public_anger", "operator": ">=", "value": 3 }
{ "scope": "memory", "field": "topic", "operator": "==", "value": "blackout_promise" }
{ "scope": "debt", "field": "status", "operator": "==", "value": "active" }
```

- `scope`：省略或 `world` 表示 World State；另支持 `memory / debt`。
- `operator`：`== / != / > / >= / < / <= / contains / not_contains / exists`。
- `contains / not_contains` 只用于 World State 的 `string[]`。
- 可用 `{ "all": [Condition...] }` 或 `{ "any": [Condition...] }` 递归组合；不要使用代码字符串或 `eval`。

## 7. Framing

Framing 在事件选择后展示，不占剧情回合。

- `eventId`：已有 Event ID。
- `type`：`newspaper / tv_news / government_memo / internal_memo`。
- `stance`：`government / media / opposition / institution / foreign_observer`。
- `source`：使用一个有效的 `actorId`、`institutionId`，或玩家可见 `label`。
- `choiceIds / requirements`：可选过滤条件。
- `eyebrow / title / body / footer`：玩家文本，`title / body` 必需。

模板变量仅支持：

- `{{state:field}}`
- `{{memory:topic}}` 或 `{{memory:topic:field}}`
- `{{debt:topic}}` 或 `{{debt:topic:field}}`
- `{{choice:id}} / {{choice:label}} / {{choice:response}}`
- `{{official_terms:last}}`
- `{{history:evaluation}}`

Event `scene`、Choice `label/response`、Framing 和历史评价使用同一模板校验。玩家文本不得直接输出未映射机器枚举。

## 8. Import 与排错

```bash
npm run import-scenario -- drafts/energy-crisis.ai-draft.json
```

成功后生成：

```text
content/energy-crisis/
  scenario.json
  actors.json
  institutions.json
  events/events.json
  framings.json
```

失败报告格式为 `[code] path: message`。任何 Draft 格式错误或 Validator 错误都会在写入正式目录前终止。

完整可导入示例见 `drafts/energy-crisis.ai-draft.json`，机器可读约束见 `docs/ai-draft.schema.json`。
