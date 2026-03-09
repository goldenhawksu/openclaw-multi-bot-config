# OpenClaw Bot Config 安装与使用说明

## 1. 文档目的

本文说明如何在本地安装和使用 `openclaw-bot-config` 这个 Skill。

当前仓库中的相关产物位置：

- Skill 源目录：`D:\work\code\moltbot-china\openclaw-multi-bot-config`
- 可分发包：`D:\work\code\moltbot-china\openclaw-multi-bot-config\.artifacts\dist\openclaw-bot-config.skill`

## 2. 安装方式总览

OpenClaw 对本地 Skill 的实际加载方式是“目录加载”，主要有两种位置：

- 共享安装：`~/.openclaw/skills/<skill-name>`
- 工作区安装：`<workspace>/skills/<skill-name>`

对 `openclaw-bot-config` 来说，推荐优先用共享安装：

- 目录：`C:\Users\Administrator\.openclaw\skills\openclaw-bot-config`

说明：

- `~/.openclaw/skills` 里的 Skill 对同一台机器上的所有 Agent 可见
- `<workspace>/skills` 里的 Skill 只对当前 workspace/agent 生效
- 优先级是：`<workspace>/skills` > `~/.openclaw/skills` > 内置 Skills

## 3. 安装方式 A：直接安装目录

这是开发期和本地调试最简单的方式。

### 3.1 复制 Skill 目录

```powershell
New-Item -ItemType Directory -Force -Path 'C:\Users\Administrator\.openclaw\skills' | Out-Null
Copy-Item -Path 'D:\work\code\moltbot-china\openclaw-multi-bot-config' `
  -Destination 'C:\Users\Administrator\.openclaw\skills\openclaw-bot-config' `
  -Recurse -Force
```

如果目标目录已经存在，可以先删除旧目录再复制，或者直接覆盖。

### 3.2 验证安装

```powershell
openclaw skills info openclaw-bot-config
openclaw skills list
openclaw skills check
```

期望结果：

- `openclaw skills info openclaw-bot-config` 显示 `Ready`
- `Source` 显示为 `openclaw-managed` 或 `openclaw-workspace`
- `openclaw skills check` 在 `Ready to use` 中列出 `openclaw-bot-config`

## 4. 安装方式 B：从 `.skill` 包安装

`.skill` 文件本质上是 zip 格式的分发包。

当前可用包：

- `D:\work\code\moltbot-china\openclaw-multi-bot-config\.artifacts\dist\openclaw-bot-config.skill`

本地安装时，正确方式是先把它解压到 OpenClaw 的 skills 目录。

### 4.1 用 Python 解压到共享 Skills 目录

```powershell
New-Item -ItemType Directory -Force -Path 'C:\Users\Administrator\.openclaw\skills' | Out-Null
python -c "import zipfile; zipfile.ZipFile(r'D:\work\code\moltbot-china\openclaw-multi-bot-config\.artifacts\dist\openclaw-bot-config.skill').extractall(r'C:\Users\Administrator\.openclaw\skills')"
```

解压后目录应为：

```text
C:\Users\Administrator\.openclaw\skills\openclaw-bot-config\
```

### 4.2 验证安装

```powershell
openclaw skills info openclaw-bot-config
openclaw skills check
```

## 5. 已验证的本地状态

当前环境已经完成以下验证：

- 已复制到 `C:\Users\Administrator\.openclaw\skills\openclaw-bot-config`
- `openclaw skills info openclaw-bot-config` 显示 `Ready`
- `openclaw skills check` 已将其列入 `Ready to use`
- 已直接运行安装目录中的 `scripts/plan_config.mjs`
- 已从 `.skill` 包解压到临时目录，并成功执行包内脚本

也就是说：

- 目录安装可用
- `.skill` 分发包可用

## 6. 在 OpenClaw 中如何使用

这个 Skill 的预期使用方式是“自然语言触发”，而不是让用户手动写配置块。

适合的触发语句例如：

- `帮我配置多个机器人`
- `不要让我自己改 openclaw.json，直接帮我配`
- `给钉钉新增一个 work 账号，并绑定到新的 agent`
- `让两个机器人共用一个 Agent，但私聊不要串`
- `给企业微信和钉钉各配一个账号，分别走不同 agent`

Skill 的工作流是：

1. 读取当前 `openclaw.json`
2. 识别已有 `channels.*`
3. 判断是修改已有渠道，还是新增渠道
4. 收集结构化参数
5. 先生成 preview
6. 用户确认后再 apply
7. 输出验证命令和必要风险提示

## 7. 直接调用脚本使用

如果你不想通过聊天触发，也可以直接调用 Skill 自带脚本。

### 7.1 生成计划

```powershell
node .\scripts\plan_config.mjs --request .\request.json --config C:\Users\Administrator\.openclaw\openclaw.json --out .\plan.json
```

### 7.2 应用配置

```powershell
node .\scripts\apply_config.mjs --plan .\plan.json --config C:\Users\Administrator\.openclaw\openclaw.json
```

说明：

- `plan_config` 已内置计划校验和 preview 输出
- `apply_config` 会按 plan 结果再次校验，并在需要时自动创建备份

## 8. `request.json` 应该是什么

`request.json` 由 Skill 内部的大模型工作流生成，约束文件在：

- `scripts/schema.request.json`

一个典型示例如下：

```json
{
  "version": "1",
  "action": "preview",
  "configPath": "C:\\Users\\Administrator\\.openclaw\\openclaw.json",
  "operation": "add-channel",
  "targets": [
    {
      "channel": "dingtalk",
      "mode": "isolated-agents",
      "defaultAccount": "main",
      "accounts": [
        {
          "accountId": "main",
          "credentials": {
            "clientId": "main-id",
            "clientSecret": "main-secret"
          },
          "agentRef": "ding-main"
        },
        {
          "accountId": "work",
          "credentials": {
            "clientId": "work-id",
            "clientSecret": "work-secret"
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
    "allowBindingOverride": false,
    "allowAgentWorkspaceReuse": true
  }
}
```

## 9. 使用时会修改哪些配置

这个 Skill 主要管理这些配置块：

- `agents.list`
- `channels.<channel>.accounts`
- `channels.<channel>.defaultAccount`
- `bindings`
- `session.dmScope`

它不会默认删除用户未明确要求删除的无关配置。

## 10. 常见验证命令

在 preview 或 apply 之后，建议执行：

```powershell
openclaw skills info openclaw-bot-config
openclaw skills check
openclaw agents list --bindings
openclaw channels status --probe
openclaw gateway restart
```

## 11. 开发期重新发布

如果你修改了 `src/` 下的 TypeScript 源码，建议重新执行：

```powershell
pnpm --dir D:\work\code\moltbot-china\openclaw-multi-bot-config build
pnpm --dir D:\work\code\moltbot-china\openclaw-multi-bot-config test
```

如果要重新生成 `.skill` 分发包，当前产物目录是：

- 运行时目录：`D:\work\code\moltbot-china\openclaw-multi-bot-config\.artifacts\runtime\openclaw-bot-config`
- 分发包目录：`D:\work\code\moltbot-china\openclaw-multi-bot-config\.artifacts\dist`

## 12. 一句话总结

最简单的使用方式就是：

1. 把 `openclaw-multi-bot-config` 目录复制到 `C:\Users\Administrator\.openclaw\skills\openclaw-bot-config`
2. 用 `openclaw skills info openclaw-bot-config` 确认它是 `Ready`
3. 在 OpenClaw 里直接说：`帮我配置多个机器人，不要让我自己改 openclaw.json`
