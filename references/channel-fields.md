# Channel Fields

## Field source

This skill does not rely on a prebuilt channel registry.

Field names come from one of these sources:

- the user's explicit confirmation
- `targets[*].credentialFields` in the structured request
- an existing channel account object already present in `openclaw.json`

## Field confirmation rule

Do not assume that the user's labels match the canonical config keys.

When the user says things like:

- `Bot ID`
- `Secret`
- `AppKey`
- `Webhook`
- `Corp ID`

the skill should restate the target field names and confirm the mapping before generating `request.json`.

Example:

- user says `Bot ID + Secret` for a channel
- do not guess whether `Bot ID` means `agentId`, app id from another adapter, or a user-facing label
- ask the user which canonical fields these values map to in their adapter or existing config

For existing configured channels:

- compare the user's labels with the existing account object keys in `openclaw.json`
- if there is a clear match, propose the mapping and ask for confirmation before apply

For new channels:

- require the user to name the exact fields explicitly
- store those names in `request.json` as `targets[*].credentialFields`
- do not infer a brand new field set from loose labels alone

## Compatibility mode

If a channel already exists in `openclaw.json`, the planner can infer account fields from the existing account objects.

Compatibility mode is intended for:

- extending an already-configured channel
- preserving unknown fields during merge

Compatibility mode is not intended for:

- creating a brand new channel with unknown credential fields

For a brand new channel, the user must provide the field set explicitly before the planner can proceed.
