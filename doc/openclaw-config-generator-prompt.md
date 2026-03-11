# OpenClaw Config Generator Prompt

请严格按以下规则生成 OpenClaw 配置。

任务目标：
我要的是“多账户、多 Agent 完全隔离”模式，不是 `shared-agent`。
请根据我下面提供的账号信息，生成一个完整的 OpenClaw 配置片段，只包含这 4 个顶级块：

- `agents`
- `session`
- `bindings`
- `channels`

## 核心规则

1. 每个 `accountId` 对应一个独立 Agent。
2. 必须显式生成 `agents.list`。
3. 必须显式生成 `bindings`，并使用 `bindings.match.channel + bindings.match.accountId` 做路由。
4. `session.dmScope` 固定使用 `"per-account-channel-peer"`。
5. `channels.<channel>.accounts` 决定这个渠道挂了几个账号。
6. `agents.list` 决定系统里有几个真正独立的 Agent。
7. `bindings` 决定某个账号最终进哪个 Agent。
8. `session.dmScope` 只决定私聊历史怎么分桶，避免串会话，不等于 Agent 隔离。
9. `defaultAccount` 必须显式写出。
10. 如果没有 `bindings`，消息通常会走默认 Agent；因此在“多账户、多 Agent 完全隔离”模式下不能省略 `bindings`。

## Agent 规则

1. OpenClaw 的 `agentId` 必须使用字符串。
2. 不要复用渠道账号里的业务字段作为 OpenClaw 的 `agentId`，除非我明确要求。
3. 默认按下面的规则生成 OpenClaw 的 `agentId`：
   `<channel>-<accountId>-agent`
4. 生成的 `agentId` 要稳定、可读，并保留原始 `accountId` 的主要含义。
5. 必须为每个 Agent 生成独立 `workspace`。
6. `agents.defaults.workspace` 固定使用 Linux 风格路径 `"~/.openclaw/workspace"`。
7. 每个 `agents.list[i].workspace` 的格式固定为：
   `"~/.openclaw/workspace-<agent-id>"`
8. 默认将第一个 Agent 标记为 `"default": true`，除非我明确指定其他默认 Agent。

## Channel 规则

1. `channels` 下保留我提供的真实渠道字段名，不要擅自改字段名，不要发明不存在的字段。
2. 不要省略 `channels.<channel>.accounts`。
3. 如果我给的是完整 `channels.<channel>` 节点，保留其中已有的渠道级字段，例如 `enabled`。
4. 如果我只给的是 `channels.<channel>.accounts` 对象，则自动补出完整的 `channels.<channel>` 结构。
5. 如果我没有明确指定 `defaultAccount`，默认使用第一个账号。

## 字段歧义处理

1. 如果渠道账号对象里本身有一个名为 `agentId` 的字段，请把它当作渠道自己的配置字段，不要和 OpenClaw 的 `bindings[].agentId` 混淆。
2. 不要把 `dmScope` 当成 Agent 隔离手段。
3. 不要生成 `peer` 级复杂 `bindings`。
4. 不要生成 `guildId`、`teamId` 或其他复杂 `bindings`。

## 渠道识别规则

1. 如果我已经明确写出 `channel`，直接使用该值。
2. 如果我只提供 `accounts`，没有明确写出 `channel`：
   - 若账号字段形态包含 `webhookPath`、`token`、`encodingAESKey`、`corpId`、`corpSecret`、`agentId`，默认按 `wecom-app` 处理。
   - 否则只允许先问我一句话：`请确认 channel 名称。`

## 输出要求

1. 输出必须是一个完整 JSON 代码块。
2. 不要输出解释文字。
3. 不要输出 markdown 列表。
4. 不要输出注释。
5. 不要输出示例前缀或后缀。
6. 不要省略字段。
7. 只允许输出这 4 个顶级块：
   - `agents`
   - `session`
   - `bindings`
   - `channels`
8. 不要生成以下无关配置：
   - `providers`
   - `models`
   - `plugins`
   - `gateway`
   - `tools`
   - `commands`
   - 其他任何无关顶级块

## 缺失信息处理

1. 如果我给出的字段已经足够，请直接生成。
2. 只有在字段明显缺失、无法生成合法配置时，才先提问。
3. 如果必须提问，只问最少的问题，并且一次尽量只问 1 个问题。

## 最终输出形态

你的最终输出必须是一个 JSON 代码块，并且整体形状如下：

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace"
    },
    "list": []
  },
  "session": {
    "dmScope": "per-account-channel-peer"
  },
  "bindings": [],
  "channels": {}
}
```

下面是账号信息：

```json
<把你的 channels.<channel>.accounts 信息粘贴到这里>
```
