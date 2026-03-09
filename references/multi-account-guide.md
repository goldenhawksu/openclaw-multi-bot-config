# OpenClaw Multi-Account Guide

Use this file when the user asks how OpenClaw multi-account or multi-bot config works, what to configure, or which model to choose before changing files.

Scope:

- answer questions about multi-account config
- help the user choose a routing scheme
- confirm field names before configuration
- modify only `agents`, `channels`, `bindings`, and `session.dmScope`

Out of scope:

- persona design
- prompt design
- provider or model setup
- gateway, plugin, or auth configuration outside the four managed config areas

## Core concepts

- `channels.<channel>.accounts`: defines how many bot or account entries a channel has
- `channels.<channel>.defaultAccount`: defines the default account inside that channel
- `agents.list`: defines how many truly separate agents exist
- `bindings`: routes channel/account traffic to a specific `agentId`
- `session.dmScope`: isolates direct-message history; it does not choose the target agent

## What users usually mean

- "多个机器人共用一个人格，但聊天别串"
  Usually means `shared-agent` plus `session.dmScope = per-account-channel-peer`
- "每个机器人都要独立记忆和工作区"
  Usually means `isolated-agents` plus `agents.list` and account-level `bindings`
- "有的账号共用一个 agent，有的单独分开"
  Usually means `hybrid`

## What to present first

If the user has not chosen a topology yet, present these options first:

1. `isolated-agents`
   Default recommendation for multi-account and multi-bot setups
2. `shared-agent`
   Use only when the user explicitly wants one shared memory or persona
3. `hybrid`
   Use when some accounts should share and others should split

Default `dmScope` recommendation for multi-account in one channel:

- `per-account-channel-peer`

Default workspace naming when creating multiple agents:

- use folder names `bot1`, `bot2`, `bot3`, ...
- tell the user these are default names and can be changed later

## Shared agent vs isolated agents

### Shared agent

Use when:

- multiple accounts should share one memory or persona
- the user mainly wants DM isolation
- separate workspaces are not required

Typical result:

- multi-account channel config
- explicit `defaultAccount`
- `session.dmScope = per-account-channel-peer`
- no account-level `bindings` by default

### Isolated agents

Use when:

- different bots should have different memory, workspace, or auth state
- different accounts must route to different agents
- the user describes separate roles such as support, ops, or admin bots

Typical result:

- multi-account channel config
- `agents.list`
- one binding per account
- `session.dmScope = per-account-channel-peer`

## `dmScope` vs `bindings`

- `dmScope` solves "will DM history mix together?"
- `bindings` solves "which agent receives this account's traffic?"
- Multi-account DM isolation alone does not create separate agents
- Separate agents usually require both `agents.list` and `bindings`

## Information to collect before execution

- target channel or channels
- whether the user is modifying an existing channel or adding a new one
- account ids such as `main`, `work`, `support`
- credentials required by that channel
- mapping from user-facing labels to canonical config field names when the user says `Bot ID`, `Secret`, or similar
- whether accounts share one agent or map to different agents
- default account
- whether workspaces should be auto-generated or custom

The channel list bundled with the skill is not exhaustive.
When the user is using another adapter, the important thing is to confirm the exact field names that should appear under `credentials`.

## Common recommendations

- when there are multiple accounts, prefer setting `defaultAccount` explicitly
- when there are multiple accounts in one channel, prefer `per-account-channel-peer`
- when the user has not chosen a routing model, recommend one account per agent first
- if the user is unsure, ask business questions first instead of asking for low-level JSON fields
- if the user has already pasted credential values, confirm the exact field names instead of asking them to re-explain the whole topology
- show current discovered channels before proposing a change when an existing config is available
