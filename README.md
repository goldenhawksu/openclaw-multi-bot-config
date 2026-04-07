请先阅读这篇文档，并严格按文档里的规则生成 OpenClaw 配置：
https://raw.githubusercontent.com/BytePioneer-AI/openclaw-multi-bot-config/main/doc/openclaw-multi-agent-multi-bot-config.md

任务目标：
我要的是“多账户、多 Agent 完全隔离”模式，不是 shared-agent。
请根据我下面提供的账号信息，生成一个完整的 OpenClaw 配置片段，只包含这 4 个顶级块：

- agents
- session
- bindings
- channels

生成要求：
1. 每个 accountId 对应一个独立 agent。
2. 必须显式生成 agents.list。
3. 必须显式生成 bindings，并使用 bindings.match.channel + bindings.match.accountId 做路由。
4. session.dmScope 固定使用 "per-account-channel-peer"。
5. channels 下保留我提供的真实渠道字段名，不要擅自改字段名，不要发明不存在的字段。
6. 必须显式写 defaultAccount。
7. workspace 使用 Linux 风格路径，格式为：
   ~/.openclaw/workspace-<agent-id>
8. OpenClaw 的 agentId 请使用字符串，不要复用渠道账号里的业务字段作为 OpenClaw agentId，除非我明确要求。
9. 如果渠道账号对象里本身有一个名为 agentId 的字段，请把它当作渠道自己的配置字段，不要和 OpenClaw 的 bindings[].agentId 混淆。
10. 输出必须是一个完整 JSON 代码块，不要输出解释文字，不要输出 markdown 列表，不要省略字段。
11. 如果我给出的字段已经足够，请直接生成；只有在字段明显缺失、无法生成合法配置时，才先提问。

补充约束：
- 不要生成 providers、models、plugins、gateway、tools 等无关配置。
- 不要生成 peer 级复杂 bindings。
- 不要把 dmScope 当成 Agent 隔离手段。
- 不要省略 channels.<channel>.accounts。
- 默认按“一个账户对应一个 Agent”处理。

下面是账号信息：
<把你的 channels.<channel>.accounts 信息粘贴到这里>比如：
 "dingtalk": 
      "defaultAccount": "bot1",
      "accounts": {
        "bot1": {
          "clientId": "xxx",
          "clientSecret": "xxx"
        },
        "bot2": {
          "clientId": "xxx",
          "clientSecret": "xxx"
        }
      }
    },
