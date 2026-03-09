# OpenClaw 多 Agent / 多机器人独立 Skill 需求文档

## 1. 文档目的

本文定义一个**独立于本项目**的 OpenClaw Skill。

这个 Skill 的目标是把多 Agent / 多机器人 / 多账号配置，从“用户自己编辑 `openclaw.json`”改成“用户描述需求，Skill 自动整理、生成、预览并应用配置”。

这里的“独立”有两层含义：

- 它不是 `openclaw-china` 仓库内置功能
- 它的分发、安装、运行不依赖本仓库源码、脚本或 CLI 扩展

本仓库中的[多 Agent / 多机器人配置指南](./openclaw-multi-agent-multi-bot-config.md)可以作为知识来源，但不是运行时依赖。

稳定可交付实现所需的脚本接口、schema、merge 规则和测试要求，见[技术设计文档](./openclaw-bot-config-technical-design.md)。

## 2. 设计定位

该 Skill 应被设计为一个可单独分发的 Skill 包，安装到 OpenClaw 的 skills 目录后即可使用。

它解决的问题是：

- 用户不知道多机器人场景该选什么配置模型
- 用户分不清“DM 会话隔离”和“多 Agent 隔离”
- 用户不会安全地修改 `openclaw.json`
- 用户希望通过自然语言完成复杂拓扑配置

它不应被设计成：

- `openclaw-china` 的一个内部模块
- `openclaw china setup` 的包装壳
- 必须克隆本仓库后才能运行的工具

## 3. 产品目标

### 3.1 核心目标

- 让用户通过自然语言描述多机器人需求
- 让 Skill 自动判断应生成哪些配置块
- 让 Skill 支持 dry-run 和 apply
- 让 Skill 在写入后给出明确验证步骤

### 3.2 体验目标

- 用户无需理解 `bindings`、`dmScope`、`defaultAccount` 等底层概念
- Skill 先问业务问题，再翻译成配置
- 默认增量修改，不覆盖无关配置
- 高风险变更必须先预览

### 3.3 工程目标

- Skill 必须能在没有本仓库代码的环境中运行
- Skill 自带自己的 `SKILL.md`、参考资料和脚本
- 配置生成和写入逻辑必须幂等、可重复执行、可审计
- 配置逻辑不能写死在 prompt 文本里，关键规则应可结构化维护
- 大模型只负责理解需求和填写结构化参数，真实配置修改必须由固定代码完成

## 4. 非目标

首期不覆盖以下内容：

- 替用户去各平台控制台创建机器人应用
- 自动开通平台权限或代填网页表单
- 自动申请域名、HTTPS 证书、公网回调
- 替用户设计 Prompt、人设或工作流
- 覆盖 OpenClaw 全部配置项

首期只聚焦：

- 多账号
- 多机器人
- 多 Agent
- 路由绑定
- DM 会话隔离

## 5. 目标用户

- 使用 OpenClaw，但不想手改配置文件的用户
- 需要一个 Gateway 承载多个机器人入口的用户
- 需要多账号映射多个 Agent 的用户
- 需要在多个渠道中维护统一或独立机器人拓扑的用户

不要求用户来自 `openclaw-china` 项目。

## 6. 适用范围

### 6.1 通用适用范围

Skill 应优先适用于满足以下模式的 OpenClaw 渠道插件：

- 渠道配置位于 `channels.<channel>`
- 支持 `channels.<channel>.accounts.<accountId>`
- 支持 `channels.<channel>.defaultAccount`
- 入站消息可携带 `accountId`
- OpenClaw 路由可使用 `bindings.match.accountId`

### 6.2 首期优先兼容范围

Skill 不应被设计成只支持少数硬编码渠道名。

更合理的定位是：

- **优先支持所有符合统一多账号配置模式的渠道**

也就是满足以下条件的渠道都应尽量走同一套实现逻辑：

- 渠道 id 不同，但配置仍位于 `channels.<channel>`
- 账号配置位于 `channels.<channel>.accounts.<accountId>`
- 默认账号位于 `channels.<channel>.defaultAccount`
- 路由仍通过 `bindings.match.channel + bindings.match.accountId`
- DM 隔离仍通过 `session.dmScope`

因此，对这个 Skill 来说，很多场景下真正变化的主要是：

- `channel` 名称
- 渠道账号字段
- 默认账号与账号列表

而 `agents.list`、`bindings`、`session.dmScope` 的生成逻辑应保持通用。

如果某个渠道不符合这个统一模型，再作为例外规则单独处理。

## 7. 典型用户场景

### 7.1 场景 A：多个账号共用一个 Agent

用户表达：

- “我有两个钉钉机器人，想共用一个人格，但私聊历史不要串。”

期望结果：

- 生成多账号配置
- 设置 `defaultAccount`
- 设置合理的 `session.dmScope`
- 不强制生成多个 Agent

### 7.2 场景 B：多个账号对应多个独立 Agent

用户表达：

- “我有两个机器人，一个客服，一个行政，要各自独立记忆和工作区。”

期望结果：

- 生成 `agents.list`
- 生成渠道多账号配置
- 生成 `bindings`
- 设置合理的 `session.dmScope`

### 7.3 场景 C：跨渠道复用 Agent

用户表达：

- “钉钉主号和企业微信主号共用一个 Agent，QQ 机器人单独走另一个 Agent。”

期望结果：

- Skill 能建立跨渠道拓扑
- Skill 能把多个账号映射到同一个 `agentId`
- Skill 能输出清晰的路由摘要

### 7.4 场景 D：在现有配置上增量修改

用户表达：

- “保留当前配置，再新增一个账号，并让它走新的 Agent。”

期望结果：

- 读取现有 `openclaw.json`
- 只做增量修改
- 不覆盖已有无关配置

## 8. 用户输入模型

Skill 至少需要采集以下信息：

| 输入项 | 必填 | 说明 |
| --- | --- | --- |
| 使用的渠道 | 是 | 一个或多个渠道标识，可来自当前配置自动发现或由用户新增指定 |
| 每个渠道的账号数量 | 是 | 例如 1 个、2 个、3 个 |
| 每个账号的 `accountId` | 是 | 如 `main`、`work`、`cs` |
| 每个账号的凭证信息 | 是 | 按渠道字段要求采集 |
| 机器人隔离模式 | 是 | 共用 Agent / 独立 Agent / 部分独立 |
| 默认账号 | 建议 | 多账号时建议显式给出 |
| Agent 命名 | 多 Agent 时必填 | 如 `ding-main` |
| workspace 策略 | 可选 | 自动生成或用户指定 |
| 操作模式 | 可选 | preview / apply |

首期建议维护一份渠道字段表，例如：

| 渠道 | 必填字段 |
| --- | --- |
| `dingtalk` | `clientId`、`clientSecret` |
| `qqbot` | `appId`、`clientSecret` |
| `wecom` | `webhookPath`、`token`、`encodingAESKey` |
| `wecom-app` | `webhookPath`、`token`、`encodingAESKey`、`corpId`、`corpSecret`、`agentId` |
| `feishu-china` | `appId`、`appSecret` |

这份字段表应作为 Skill 自带 reference，而不是依赖本仓库代码读取。

## 9. 交互方式

### 9.1 预期触发方式

以下表达应能触发该 Skill：

- “帮我配置多个机器人”
- “帮我做 OpenClaw 多 Agent 路由”
- “不要让我自己改 `openclaw.json`”
- “把两个账号分别绑定到不同 agent”

### 9.2 推荐交互流程

1. 读取当前 `openclaw.json`
2. 识别当前已经存在的 `channels.*` 配置项
3. 判断用户是要修改已有渠道，还是新增某个渠道配置
4. 把用户自然语言整理成结构化拓扑
5. 对缺失信息发起追问
6. 生成 dry-run 摘要
7. 用户确认后再 apply
8. 输出验证命令和风险提示

### 9.3 交互原则

- 优先问“你要几个机器人、是否共享记忆、是否独立工作区”
- 优先读取并展示当前已配置的渠道，再让用户确认是修改已有渠道还是新增渠道
- 不优先问“你要不要生成 `bindings`”
- Skill 自己负责做配置术语翻译
- 只有在必要时才向用户展示原始 JSON

## 10. 配置决策规则

### 10.1 隔离模式判定

| 用户意图 | Skill 应生成的配置 |
| --- | --- |
| 共用人格、共用工作区 | 多账号配置，必要时只设置 `dmScope` |
| 各机器人独立记忆、独立工作区 | `agents.list` + 多账号配置 + `bindings` |
| 未说明 | 先追问；若只强调“私聊不要串”，优先按 DM 隔离理解 |

### 10.2 `dmScope` 判定

| 场景 | 推荐值 |
| --- | --- |
| 同渠道单账号、多私聊用户 | `per-channel-peer` |
| 同渠道多账号 | `per-account-channel-peer` |
| 单账号且无明确隔离诉求 | 保持现状或不主动改动 |

### 10.3 `bindings` 判定

- 只有在不同账号需要进入不同 Agent 时才生成 `bindings`
- 账号级分流优先使用 `match.channel + match.accountId`
- 只做 DM 会话隔离时，不应误生成 `bindings`
- 绑定顺序要稳定，便于 diff 和复查

### 10.4 `defaultAccount` 判定

- 多账号时建议总是显式生成
- 用户未指定时，Skill 应给出推荐值并说明
- 默认推荐 `main`

### 10.5 workspace 判定

- 用户未指定时，自动生成稳定路径
- 推荐命名：`~/.openclaw/workspace-<agentId>`
- 遇到路径冲突时必须提示

### 10.6 目标配置原则

Skill 的最终目标不是让模型直接输出一整段最终 JSON，而是把当前 `openclaw.json` **增量修改到目标状态**。

以“钉钉多账号 + 多 Agent 完全隔离”为例，目标状态通常会包含以下核心配置块：

- `agents.list`
- `session.dmScope`
- `bindings`
- `channels.dingtalk.defaultAccount`
- `channels.dingtalk.accounts`

典型目标形态如下：

```json
{
  "agents": {
    "list": [
      {
        "id": "ding-main",
        "default": true,
        "workspace": "C:\\Users\\Administrator\\.openclaw\\workspace-ding-main"
      },
      {
        "id": "ding-work",
        "workspace": "C:\\Users\\Administrator\\.openclaw\\workspace-ding-work"
      }
    ]
  },
  "session": {
    "dmScope": "per-account-channel-peer"
  },
  "bindings": [
    {
      "agentId": "ding-main",
      "match": {
        "channel": "dingtalk",
        "accountId": "main"
      }
    },
    {
      "agentId": "ding-work",
      "match": {
        "channel": "dingtalk",
        "accountId": "work"
      }
    }
  ],
  "channels": {
    "dingtalk": {
      "defaultAccount": "main",
      "enabled": true,
      "enableAICard": false,
      "accounts": {
        "main": {
          "clientId": "your-main-client-id",
          "clientSecret": "your-main-client-secret"
        },
        "work": {
          "clientId": "your-work-client-id",
          "clientSecret": "your-work-client-secret"
        }
      }
    }
  }
}
```

但要注意：

- 这只是某一类场景的目标状态，不是所有场景都必须生成完整同构配置
- 如果用户选择“多个账号共用一个 Agent”，通常不需要生成完整的 `agents.list + bindings`
- 实现目标应始终是“把现有配置安全合并到该目标状态”，而不是“覆盖写入这段 JSON”

## 11. 功能需求

### 11.1 配置理解

- 能把自然语言需求转成标准拓扑模型
- 能先从当前配置中发现已有渠道列表
- 能区分“修改已有渠道配置”和“新增渠道配置”
- 拓扑模型至少包含：渠道、账号、Agent、路由关系、会话隔离策略

### 11.2 配置生成

Skill 应能生成以下配置块中的任意组合：

- `agents.defaults`
- `agents.list`
- `channels.<channel>.defaultAccount`
- `channels.<channel>.accounts`
- `bindings`
- `session.dmScope`

### 11.3 参数填写与代码执行边界

必须明确区分“大模型负责什么”和“固定代码负责什么”：

- 大模型负责理解自然语言需求、补齐缺失信息、选择配置策略、填写结构化参数
- 固定代码负责校验参数、生成配置补丁、合并 `openclaw.json`、备份、回滚和输出 diff

禁止的实现方式：

- 让大模型直接生成最终 `openclaw.json`
- 让大模型直接拼接 JSON 文本并写回配置文件
- 让大模型决定底层字段合并细节

推荐的实现方式：

1. 大模型输出受约束的结构化输入
2. 固定脚本读取该输入
3. 固定脚本按既定规则生成目标配置补丁
4. 固定脚本执行校验、预览、写盘与回滚

### 11.4 配置写入

- 先读取现有配置，再做结构化合并
- 不删除用户未明确要求删除的配置
- 支持 preview 和 apply
- 写入前输出变更摘要

### 11.5 冲突检测

- 检测重复 `agentId`
- 检测重复 `accountId`
- 检测 binding 覆盖风险
- 检测凭证缺失
- 检测 workspace 路径冲突

### 11.6 结果输出

- 写入前输出“将新增/修改的配置”
- 写入后输出摘要
- 输出验证命令：
  - `openclaw gateway restart`
  - `openclaw agents list --bindings`
  - `openclaw channels status --probe`

### 11.7 错误处理

- 缺字段时明确指出具体字段
- 需求模糊时先追问
- 可能覆盖已有配置时先确认

## 12. 非功能需求

### 12.1 独立性

- Skill 必须可以单独复制到 `~/.openclaw/skills` 或 workspace `./skills`
- Skill 不得依赖 `openclaw-china` 仓库路径存在
- Skill 不得依赖 `@openclaw-china/shared` 等项目内部包
- Skill 的核心逻辑必须包含在 Skill 自身目录中

### 12.2 安全

- 不在输出中明文回显完整密钥
- 变更摘要中对敏感字段做掩码
- 不把真实凭证写入示例文件

### 12.3 可维护性

- 渠道字段要求和决策规则应放在 reference 或脚本中
- 不能只靠长 prompt 维护复杂规则

### 12.4 可扩展性

- 后续可新增更多渠道字段映射
- 后续可新增更细粒度的 binding 规则
- 后续可加入回滚能力

## 13. 与本项目的关系

### 13.1 关系定义

本 Skill 与 `openclaw-china` 的关系应为：

- **参考关系**，不是**依赖关系**

可以参考的内容：

- 配置指南
- 渠道字段说明
- 多账号示例
- 典型错误案例

不应依赖的内容：

- 仓库内 TypeScript 模块
- `openclaw china setup`
- 本仓库的目录结构
- 本仓库安装后的扩展路径

### 13.2 文档来源定位

本仓库中的[配置指南](./openclaw-multi-agent-multi-bot-config.md)应被视为：

- 规则来源
- 场景样例来源
- 需求梳理参考

而不是：

- Skill 的运行时 reference 唯一来源

如果最终发布为独立 Skill，建议把必要规则摘取后放进 Skill 自己的 `references/` 目录。

## 14. 建议的 Skill 结构

建议把该能力做成一个完整的独立 Skill 包。当前仓库中的落地目录已经采用如下结构：

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
    ├── plan_config.mjs
    └── apply_config.mjs
```

说明：

- `SKILL.md` 负责触发描述和主流程
- `references/` 负责承载规则和示例
- `src/` 负责 TypeScript 源码实现
- `scripts/` 负责对外暴露稳定脚本入口
- `dist/` 负责提供可直接执行的 Node 构建产物

其中建议职责分工如下：

- `schema.request.json`：约束模型允许输出的结构化字段
- `src/cli/plan-config.ts`：把结构化输入转成配置计划
- `src/cli/apply-config.ts`：执行真实配置写入
- `src/cli/rollback-config.ts`：在失败或用户要求时回滚

脚本语言可选 Python 或 Node，但必须做到：

- 用户机器上容易运行
- 不依赖本仓库源码 import
- 能独立处理 JSON 配置文件

当前实现采用：

- TypeScript 源码
- Node CLI 构建产物
- `scripts/*.mjs` 作为复制到 OpenClaw skills 目录后的稳定入口

## 15. MVP 范围

首期建议覆盖：

- 读取本地 `openclaw.json`
- 自动识别当前已存在的 `channels.*`
- 支持用户确认“修改已有渠道”或“新增渠道”
- 支持单渠道多账号
- 支持多账号共用一个 Agent
- 支持多账号映射多个 Agent
- 支持 dry-run / apply
- 支持输出验证命令
- 对所有符合统一多账号模型的渠道复用同一套拓扑生成逻辑

首期不要求覆盖：

- 自动配置各平台后台
- 不符合统一多账号模型的特殊渠道例外逻辑
- 非账号维度的复杂 `bindings`

## 16. 验收标准

满足以下条件时，视为 MVP 可交付：

1. 在没有本仓库源码的环境中，Skill 仍可工作。
2. Skill 能读取当前配置中的已有渠道，并让用户确认是修改已有渠道还是新增渠道。
3. 用户只通过自然语言和必要补充信息，就能完成多账号或多 Agent 配置。
4. Skill 能正确区分“DM 隔离”和“多 Agent 隔离”。
5. 生成后的 `openclaw.json` 可被 OpenClaw 正常读取。
6. Skill 不会覆盖无关配置。
7. Skill 会输出清晰的预览摘要和验证命令。
8. Skill 目录复制到 OpenClaw skills 路径后，`scripts/plan_config.mjs` 等入口仍可正常执行。

## 17. 示例需求输入

### 示例 1

输入：

“帮我配置两个钉钉机器人，`main` 和 `work`。两个都接入 OpenClaw，`main` 继续走默认 Agent，`work` 单独一个 Agent，私聊不要串。”

期望行为：

- 识别为单渠道、多账号、部分独立 Agent
- 读取当前配置
- 追问 `work` 的凭证与 `agentId`
- 生成 `accounts`
- 生成必要的 `bindings`
- 设置 `session.dmScope = per-account-channel-peer`

### 示例 2

输入：

“我有两个企业微信自建应用，一个客服，一个售后，要完全独立，各自主动发消息，帮我直接配好。”

期望行为：

- 识别渠道为 `wecom-app`
- 追问两组账号凭证
- 生成两个账号配置
- 生成两个独立 Agent 和 workspace
- 生成 `bindings`
- 输出验证步骤

## 18. 建议结论

你要的不是“本项目里再多一个 setup 功能”，而是一个可独立安装、可单独分发的 OpenClaw Skill。

它的核心价值是把这三件事合起来：

- 理解用户需求
- 决策配置模型
- 安全修改配置文件

如果按这个定位实现，这个 Skill 即使最初参考了 `openclaw-china` 的文档，也不会被绑定在本项目里。
