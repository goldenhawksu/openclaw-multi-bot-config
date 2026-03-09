# Agent Notes

## Project layout

- `agents/`
  UI-facing skill metadata. `openai.yaml` defines display name, short description, and default prompt.

- `doc/`
  Design and background documents for developers. These files explain requirements, technical design, and install/use notes. They are not the main runtime references for the skill.

- `references/`
  Runtime reference material for the skill. `SKILL.md` should load these files as needed for routing rules, channel field mapping, topology strategies, and examples.

- `scripts/`
  Stable external entrypoints and schemas. The `*.mjs` wrappers are what users or OpenClaw call directly; they delegate to compiled code under `dist/`. This directory now focuses on two public commands: `plan_config` and `apply_config`, plus `schema.request.json`.

- `src/`
  TypeScript source code for the skill implementation.

- `src/cli/`
  CLI entrypoint source files such as `plan-config.ts`, `validate-plan.ts`, `apply-config.ts`, `backup-config.ts`, and `rollback-config.ts`.

- `src/lib/`
  Core library code: request validation, channel definition resolution, planning, merge logic, masking, output formatting, file IO, and rollback/apply helpers.

- `test/`
  Automated test source files.

- `test/fixtures/`
  Fixture data used by tests, including sample configs and sample requests.

- `dist/`
  Compiled JavaScript output. This is a required runtime/distribution directory in the current project design because `scripts/*.mjs` import `dist/src/cli/*.js`.

- `artifacts/`
  Local working output directory for temporary files created during manual runs. This is not a source directory.

- `.artifacts/`
  Packaging/distribution output directory. It contains packaged `.skill` artifacts and runtime copies used for distribution workflows, not source code.

## Important root files

- `SKILL.md`
  The primary skill definition. Frontmatter, especially `description`, controls when the skill triggers.

- `package.json`
  Node package metadata, scripts, and dev dependencies.

- `tsconfig.json`
  TypeScript compiler configuration for this repository.

- `pnpm-lock.yaml`
  Dependency lockfile and should be committed.

- `.gitignore`
  Git ignore rules for local dependencies, temporary files, backups, and editor-specific files.

## Tracking guidance

- Keep under version control:
  `SKILL.md`, `agents/`, `references/`, `scripts/`, `src/`, `test/`, `doc/`, `dist/`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`.

- Usually ignore:
  `node_modules/`, `artifacts/`, `.artifacts/`, coverage output, temp files, backup files, and local editor/environment files.

## Functional scope

This skill is intentionally narrow:

- answer user questions by reading bundled reference documents
- offer a small set of routing/configuration options
- confirm actual credential field names before planning
- modify only `agents`, `channels`, `bindings`, and `session.dmScope` in the local `openclaw.json`

It should not expand into persona setup, prompt design, provider configuration, or unrelated OpenClaw settings.
