# OpenClaw Bot Config 技术设计文档

## 1. 文档目的

本文用于把 [需求文档](./openclaw-multi-agent-multi-bot-skill-requirements.md) 补齐到“可稳定开发、可稳定交付”的程度。

重点回答以下问题：

- 模型最终要产出什么结构化输入
- 固定代码之间如何分工和调用
- `openclaw.json` 应如何安全合并
- 未知渠道、已有配置、冲突和失败应如何处理
- 如何验证实现已经达到可交付标准

本文默认该 Skill 的发布名为 `openclaw-bot-config`。

## 2. 设计结论

这个 Skill 必须采用“模型编排 + 固定代码执行”的架构：

- 模型负责理解用户需求、补齐缺失信息、生成结构化请求
- 固定代码负责读取配置、生成计划、校验、备份、写入、回滚

禁止让模型直接手写最终 `openclaw.json`。

## 3. 设计范围

本文覆盖：

- Skill 内部文件结构
- 请求 schema
- 计划 schema
- 脚本接口
- 配置 merge 规则
- 备份与回滚
- 测试矩阵

本文不覆盖：

- 平台后台自动开通
- OpenClaw 本体源码改造
- 非 `openclaw.json` 配置源

## 4. 总体架构

```text
用户自然语言
    |
    v
SKILL.md 引导模型收集信息
    |
    v
结构化请求 request.json
    |
    v
plan_config -> preview
    |
    v
用户确认
    |
    v
apply_config
    |
    v
验证结果
```

架构约束：

- 真实配置写入只能发生在 `apply_config`
- `plan_config` 必须纯函数化，不修改磁盘配置
- 所有脚本都必须返回统一的结果 envelope
- 所有密钥字段在 preview 和日志中必须掩码

## 5. 推荐目录结构

```text
openclaw-multi-bot-config/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── routing-rules.md
│   ├── channel-fields.md
│   ├── config-strategies.md
│   └── examples.md
├── src/
│   ├── cli/
│   └── lib/
├── test/
│   └── fixtures/
├── dist/
│   ├── src/
│   └── test/
└── scripts/
    ├── schema.request.json
    ├── channel_registry.json
    ├── plan_config.mjs
    └── apply_config.mjs
```

说明：

- `schema.request.json` 约束模型允许输出的结构化字段
- `channel_registry.json` 提供机器可读的渠道字段定义
- `src/cli/*.ts` 提供真实实现
- `scripts/*.mjs` 提供稳定的外部入口
- `apply_config` 负责最终校验、备份和原子写入

注：

- 当前实现使用 TypeScript 源码和 Node CLI 构建产物
- `dist/` 应与 Skill 一起分发，保证复制目录后 `scripts/*.mjs` 可以直接工作

## 6. 端到端流程

### 6.1 发现与收集

1. Skill 被自然语言需求触发
2. 读取当前 `openclaw.json`
3. 枚举当前已有 `channels.*`
4. 判断是“修改已有渠道”还是“新增渠道”
5. 模型补齐缺失字段并输出 `request.json`

### 6.2 计划阶段

1. `plan_config` 读取 `request.json` 和当前配置
2. 根据 `channel_registry.json` 和统一规则生成 `plan.json`
3. `plan_config` 同时检查冲突、缺字段、潜在覆盖风险
4. `mask_secrets` 产出预览可读摘要

### 6.3 应用阶段

1. 用户确认 apply
2. `apply_config` 创建备份
3. `apply_config` 执行 merge 并原子替换
4. 写入后再次解析结果文件，确保 JSON 合法
5. 输出验证命令和变更摘要

## 7. 数据契约

### 7.1 `request.json`

`request.json` 是模型和固定代码之间唯一允许的输入契约。

建议字段如下：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `version` | string | 是 | 当前固定为 `1` |
| `action` | string | 是 | `preview` 或 `apply` |
| `configPath` | string | 是 | 目标 `openclaw.json` 路径 |
| `operation` | string | 是 | `modify-existing-channel` 或 `add-channel` |
| `targets` | array | 是 | 需要处理的渠道列表 |
| `agents` | array | 否 | 需要创建或绑定的 Agent 定义 |
| `sessionPolicy` | object | 否 | `dmScope` 生成策略 |
| `options` | object | 否 | merge、备份、覆盖控制选项 |

`targets[*]` 结构：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `channel` | string | 是 | 渠道 id，例如 `dingtalk` |
| `mode` | string | 是 | `shared-agent`、`isolated-agents`、`hybrid` |
| `defaultAccount` | string | 否 | 渠道默认账号 |
| `credentialFields` | object | 否 | 新渠道或自定义适配器显式提供的字段集合 |
| `accounts` | array | 是 | 账号配置列表 |

`targets[*].accounts[*]` 结构：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `accountId` | string | 是 | 账号标识 |
| `credentials` | object | 是 | 渠道凭证字典 |
| `agentRef` | string | 否 | 指向 `agents[*].id` |
| `enabled` | boolean | 否 | 账号级启用标记，缺省视为 `true` |

`targets[*].credentialFields` 结构：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `requiredFields` | array | 是 | 用户确认过的必填字段名 |
| `optionalFields` | array | 否 | 用户确认过的可选字段名 |

`agents[*]` 结构：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | agent id |
| `default` | boolean | 否 | 是否为默认 agent |
| `workspaceMode` | string | 否 | `auto`、`custom`、`existing` |
| `workspace` | string | 否 | `custom` 时必填 |

`sessionPolicy` 结构：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `mode` | string | 是 | `preserve`、`recommended`、`explicit` |
| `dmScope` | string | 否 | `explicit` 时必填 |

`options` 结构：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `createBackup` | boolean | 否 | 缺省为 `true` |
| `preserveUnknownFields` | boolean | 否 | 缺省为 `true` |
| `allowBindingOverride` | boolean | 否 | 缺省为 `false` |
| `allowAgentWorkspaceReuse` | boolean | 否 | 缺省为 `true` |

### 7.2 `request.json` 示例

```json
{
  "version": "1",
  "action": "preview",
  "configPath": "C:\\Users\\Administrator\\.openclaw\\openclaw.json",
  "operation": "modify-existing-channel",
  "targets": [
    {
      "channel": "dingtalk",
      "mode": "isolated-agents",
      "defaultAccount": "main",
      "accounts": [
        {
          "accountId": "main",
          "credentials": {
            "clientId": "your-main-client-id",
            "clientSecret": "your-main-client-secret"
          },
          "agentRef": "ding-main"
        },
        {
          "accountId": "work",
          "credentials": {
            "clientId": "your-work-client-id",
            "clientSecret": "your-work-client-secret"
          },
          "agentRef": "ding-work"
        }
      ]
    }
  ],
  "agents": [
    {
      "id": "ding-main",
      "default": true,
      "workspaceMode": "auto"
    },
    {
      "id": "ding-work",
      "workspaceMode": "auto"
    }
  ],
  "sessionPolicy": {
    "mode": "recommended"
  },
  "options": {
    "createBackup": true,
    "preserveUnknownFields": true,
    "allowBindingOverride": false
  }
}
```

### 7.3 `plan.json`

`plan.json` 是固定代码生成的标准执行计划，供预览、校验和应用复用。

建议字段如下：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `version` | string | 是 | 当前固定为 `1` |
| `configPath` | string | 是 | 目标配置路径 |
| `summary` | object | 是 | 面向用户的结构化摘要 |
| `resolved` | object | 是 | 归一化后的渠道、账号、agent、dmScope 决策 |
| `patch` | object | 是 | 计划写入的目标配置片段 |
| `operations` | array | 是 | 逐项操作列表 |
| `warnings` | array | 否 | 风险但不阻断执行 |
| `errors` | array | 否 | 阻断执行的错误 |

`summary` 应至少包含：

- 将新增的渠道
- 将新增或更新的账号
- 将新增或更新的 agent
- 将新增或替换的 bindings
- 最终 `dmScope`
- 需要用户关注的风险点

`operations[*]` 应至少包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | `create-agent`、`update-channel-account`、`set-binding` 等 |
| `target` | string | 稳定可读的目标标识 |
| `status` | string | `create`、`update`、`replace`、`noop` |
| `reason` | string | 决策原因 |

### 7.4 统一结果 envelope

所有脚本都必须使用统一输出结构：

```json
{
  "ok": true,
  "code": "OK",
  "message": "Plan generated",
  "data": {}
}
```

建议错误码：

| `code` | 含义 |
| --- | --- |
| `OK` | 成功 |
| `INVALID_REQUEST` | 请求结构不合法 |
| `CONFIG_NOT_FOUND` | 配置文件不存在 |
| `CONFIG_INVALID_JSON` | 配置文件不是合法 JSON |
| `CHANNEL_UNSUPPORTED` | 未知渠道且无法推断字段 |
| `CHANNEL_FIELDS_MISSING` | 渠道必填字段缺失 |
| `PLAN_CONFLICT` | 计划与现有配置冲突 |
| `WRITE_BLOCKED` | 写入被保护规则阻止 |
| `APPLY_FAILED` | 写入失败 |
| `ROLLBACK_FAILED` | 回滚失败 |
| `INTERNAL_ERROR` | 未知内部错误 |

建议退出码：

- `0`：成功
- `2`：请求错误
- `3`：配置读取错误
- `4`：计划校验失败
- `5`：写入失败
- `6`：回滚失败
- `10`：未分类内部错误

## 8. 脚本接口设计

### 8.1 `plan_config`

职责：

- 读取当前配置
- 归一化 `request.json`
- 按统一规则生成 `plan.json`
- 生成掩码后的 preview 数据

输入参数建议：

```text
node ./scripts/plan_config.mjs --request <path> --config <path> [--out <path>]
```

输出：

- 标准 envelope
- `data.plan`
- `data.preview`
- `data.previewConfig`

约束：

- 不允许写入 `openclaw.json`
- 同一输入必须生成稳定顺序的计划结果
- 同时完成字段完整性、唯一性和覆盖风险校验

### 8.2 `apply_config`

职责：

- 读取当前配置和 plan
- 重新执行最终校验
- 在写入前为目标配置创建带时间戳的备份
- 执行 merge
- 先写入临时文件，再原子替换
- 写入后重新解析并验证结果

输入参数建议：

```text
node ./scripts/apply_config.mjs --plan <path> --config <path> [--backup <path>]
```

硬性规则：

- 不允许在没有 plan 的情况下直接改配置
- 不允许删除不在 patch 管理范围内的现有配置
- 写入后若 JSON 校验失败，必须返回错误并保留备份路径

### 8.6 `mask_secrets`

职责：

- 对 preview、日志和错误输出进行脱敏

默认掩码字段建议：

- `clientSecret`
- `appSecret`
- `corpSecret`
- `token`
- `encodingAESKey`
- `apiKey`
- 任何 key 名中包含 `secret`、`token`、`key` 的字段

## 9. 配置 merge 规则

## 9.1 总体原则

- 只增量修改，不整体重写
- 未受管理字段一律保留
- 顺序稳定，保证重复执行 diff 最小
- 同一请求重复执行，结果必须幂等

## 9.2 `agents.list`

规则：

- 以 `id` 作为 upsert key
- 已存在 agent 时，仅更新本 Skill 管理的字段
- 未声明为默认 agent 的现有 agent 不得被误删
- 若请求中存在 `default: true`，最终只能保留一个默认 agent

`workspace` 决策：

- `workspaceMode = auto` 时，默认生成：

```text
<config-dir>/workspace-<agentId>
```

- `workspaceMode = custom` 时使用用户提供路径
- `workspaceMode = existing` 时沿用当前 agent 的 `workspace`
- 若目标路径已被其他 agent 使用，默认报冲突

## 9.3 `bindings`

MVP 只管理账号级 bindings：

```json
{
  "agentId": "ding-main",
  "match": {
    "channel": "dingtalk",
    "accountId": "main"
  }
}
```

规则：

- 以 `channel + accountId` 作为管理键
- 若同键已有 binding 指向其他 agent，缺省报冲突
- 只有模式为 `isolated-agents` 或 `hybrid` 才生成 bindings
- `shared-agent` 模式默认不生成账号级 bindings
- 输出顺序按 `channel`、`accountId`、`agentId` 稳定排序

## 9.4 `channels.<channel>`

规则：

- 若渠道节点不存在，则创建
- `enabled` 缺省设置为 `true`
- 仅更新目标渠道，不影响其他渠道

`accounts` merge 规则：

- 以 `accountId` 作为 upsert key
- 已存在账号时，更新已知凭证字段并保留未知字段
- 不在本次请求中的账号默认保留，不自动删除

`defaultAccount` 规则：

- 用户显式提供则直接使用
- 未显式提供但新增了首个账号，则该账号为默认账号
- 多账号且未指定时，优先保留现有默认账号；否则使用第一个新增账号

## 9.5 `session.dmScope`

规则：

- `sessionPolicy.mode = preserve` 时不主动修改
- `recommended` 时按决策表生成
- `explicit` 时使用用户指定值

推荐表：

| 场景 | 推荐值 |
| --- | --- |
| 单渠道单账号 | 保持现状 |
| 单渠道多账号 | `per-account-channel-peer` |
| 多渠道共用一个 agent | `per-account-channel-peer` |
| 多 agent 完全隔离 | `per-account-channel-peer` |

## 10. 渠道字段注册表

`channel_registry.json` 必须是机器可读文件，不能只靠 Markdown 文档。

建议结构：

```json
{
  "dingtalk": {
    "requiredFields": ["clientId", "clientSecret"],
    "optionalFields": ["enabled", "enableAICard"],
    "supportsAccounts": true
  },
  "wecom-app": {
    "requiredFields": ["webhookPath", "token", "encodingAESKey", "corpId", "corpSecret", "agentId"],
    "optionalFields": ["enabled"],
    "supportsAccounts": true
  }
}
```

处理策略：

- 已注册渠道：严格校验 `requiredFields`
- 未注册但当前配置中已存在的渠道：允许从现有账号对象推断字段集合，校验级别为“兼容模式”
- 未注册且为新增渠道：允许用户在请求中通过 `credentialFields` 显式提供字段集合
- 未注册且为新增渠道但未提供 `credentialFields`：返回 `CHANNEL_UNSUPPORTED`

这样可以同时满足：

- 已知渠道强校验
- 已配置渠道可增量修改
- 新渠道不因硬编码白名单被完全阻断

## 11. 校验与冲突策略

阻断类错误：

- 目标配置文件不存在
- 当前配置不是合法 JSON
- 请求不满足 schema
- 渠道必填字段缺失
- 同一渠道内 `accountId` 重复
- `defaultAccount` 指向不存在账号
- 目标 binding 会覆盖现有不同 agent 绑定，且未允许 override
- 目标 workspace 与其他 agent 冲突

警告类错误：

- 将修改已有账号凭证
- 将改变 `defaultAccount`
- 将新增多个 agent
- `dmScope` 将从现有值切换到推荐值

设计要求：

- 错误和警告都必须带可读原因
- 错误信息必须可直接回显给用户
- 同一错误码的 message 应保持稳定，便于后续测试快照

## 12. 备份、写入与回滚

写入流程必须是：

1. 读取当前配置
2. 创建备份
3. 合并生成目标 JSON
4. 写入临时文件
5. 重新解析临时文件
6. 原子替换正式配置
7. 返回备份路径和写入摘要

补充要求：

- 临时文件应位于目标目录，避免跨盘替换失败
- 写入前后都应保留换行和缩进风格一致，默认使用 2 空格缩进
- 回滚不依赖 plan，只依赖 `config` 与 `backup`

## 13. 安全要求

- 所有 preview 和日志都必须脱敏
- 不把完整密钥直接写进错误信息
- 不执行任意用户命令
- 不从网络动态下载 schema 或规则
- 不依赖当前仓库源码 import

## 14. 测试设计

建议至少覆盖以下测试层：

### 14.1 schema 测试

- 合法 `request.json` 通过
- 缺少必填字段失败
- 枚举值非法失败

### 14.2 plan 测试

- 单渠道多账号共用一个 agent
- 单渠道多账号多 agent 完全隔离
- 多渠道共用一个 agent
- 混合模式
- 修改已有渠道
- 新增渠道

### 14.3 merge 测试

- 不覆盖无关顶层字段
- 不删除无关账号
- 幂等执行两次结果一致
- `bindings` 排序稳定

### 14.4 apply 与 rollback 测试

- apply 成功后 JSON 可解析
- apply 失败后备份存在
- rollback 成功后恢复原始内容

### 14.5 建议 fixture 组织

```text
tests/
├── fixtures/
│   ├── configs/
│   ├── requests/
│   ├── plans/
│   └── results/
└── cases/
```

## 15. MVP 实现边界

为避免设计过大，MVP 应坚持以下边界：

- 只处理 `openclaw.json`
- 只处理账号级 bindings
- 只处理统一多账号模型渠道
- 只支持 preview / apply / rollback
- 不处理平台后台自动创建机器人

## 16. 交付定义

以下条件同时满足时，视为“技术上可稳定交付”：

1. 模型输出被 `schema.request.json` 严格约束。
2. `plan_config`、`apply_config` 的接口已经固定。
3. `agents`、`bindings`、`channels`、`session.dmScope` 的 merge 规则已经写死并可测试。
4. 脱敏、备份、原子写入、回滚路径已经定义完整。
5. 至少有一组 fixture 可以证明多账号共用、多 agent 隔离和增量修改都可重复通过。
