import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRequest } from "../src/lib/request.js";
import { generatePlan } from "../src/lib/planner.js";
import { readJsonFile, writeJsonFileAtomic } from "../src/lib/files.js";
import { validatePlan } from "../src/lib/validator.js";
import { mergeConfig } from "../src/lib/merge.js";
import { applyPlan, rollbackConfig } from "../src/lib/apply.js";
const testRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../test/fixtures");
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
async function loadFixtureJson(...parts) {
    return readJsonFile(path.join(testRoot, ...parts), "INVALID_REQUEST");
}
test("shared-agent planning preserves existing channel fields and avoids bindings", async () => {
    const requestFixture = await loadFixtureJson("requests", "request-shared.json");
    const config = await loadFixtureJson("configs", "existing-dingtalk.json");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-bot-config-shared-"));
    const configPath = path.join(tempDir, "openclaw.json");
    await writeJsonFileAtomic(configPath, config);
    const requestPath = path.join(tempDir, "request.json");
    await writeJsonFileAtomic(requestPath, { ...requestFixture, configPath });
    const { request, issues } = await loadRequest(requestPath);
    assert.equal(issues.length, 0);
    const plan = await generatePlan(request, config);
    assert.equal(plan.summary.dmScope, "per-account-channel-peer");
    assert.equal(plan.resolved.bindings.length, 0);
    assert.equal(plan.patch.channels?.dingtalk?.accounts?.main?.label, "preserve-me");
    assert.equal(plan.patch.channels?.dingtalk?.accounts?.work?.clientId, "work-id");
});
test("isolated-agent planning generates agents and stable bindings", async () => {
    const requestFixture = await loadFixtureJson("requests", "request-isolated.json");
    const config = await loadFixtureJson("configs", "empty-openclaw.json");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-bot-config-isolated-"));
    const configPath = path.join(tempDir, "openclaw.json");
    await writeJsonFileAtomic(configPath, config);
    const requestPath = path.join(tempDir, "request.json");
    await writeJsonFileAtomic(requestPath, { ...requestFixture, configPath });
    const { request, issues } = await loadRequest(requestPath);
    assert.equal(issues.length, 0);
    const plan = await generatePlan(request, config);
    assert.equal(plan.resolved.agents.length, 2);
    assert.equal(plan.resolved.bindings.length, 2);
    assert.equal(plan.resolved.agents[0]?.workspace?.endsWith("bot1"), true);
    assert.equal(plan.resolved.agents[1]?.workspace?.endsWith("bot2"), true);
    assert.deepEqual(plan.summary.bindings.map((binding) => `${binding.channel}:${binding.accountId}:${binding.agentId}`), ["dingtalk:main:ding-main", "dingtalk:work:ding-work"]);
    assert.equal(plan.warnings.some((entry) => entry.message.includes("Auto workspace")), true);
    const mergedOnce = mergeConfig(config, plan);
    const mergedTwice = mergeConfig(mergedOnce, plan);
    assert.deepEqual(mergedOnce, mergedTwice);
});
test("existing unregistered channel is handled in compatibility mode", async () => {
    const requestFixture = await loadFixtureJson("requests", "request-unregistered-existing.json");
    const config = await loadFixtureJson("configs", "existing-unregistered.json");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-bot-config-compat-"));
    const configPath = path.join(tempDir, "openclaw.json");
    await writeJsonFileAtomic(configPath, config);
    const requestPath = path.join(tempDir, "request.json");
    await writeJsonFileAtomic(requestPath, { ...requestFixture, configPath });
    const { request, issues } = await loadRequest(requestPath);
    assert.equal(issues.length, 0);
    const plan = await generatePlan(request, config);
    assert.equal(plan.errors.length, 0);
    assert.equal(plan.resolved.targets[0]?.compatibilityMode, true);
    assert.equal(plan.patch.channels?.["custom-chat"]?.accounts?.beta?.region, "cn");
});
test("validation blocks binding conflicts", async () => {
    const requestFixture = await loadFixtureJson("requests", "request-binding-conflict.json");
    const config = await loadFixtureJson("configs", "binding-conflict.json");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-bot-config-conflict-"));
    const configPath = path.join(tempDir, "openclaw.json");
    await writeJsonFileAtomic(configPath, config);
    const requestPath = path.join(tempDir, "request.json");
    await writeJsonFileAtomic(requestPath, { ...requestFixture, configPath });
    const { request, issues } = await loadRequest(requestPath);
    assert.equal(issues.length, 0);
    const plan = await generatePlan(request, config);
    const validation = await validatePlan(plan, config);
    assert.equal(validation.issues.some((entry) => entry.code === "PLAN_CONFLICT"), true);
});
test("new unregistered channels are rejected during planning", async () => {
    const requestFixture = await loadFixtureJson("requests", "request-invalid-new-channel.json");
    const config = await loadFixtureJson("configs", "empty-openclaw.json");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-bot-config-invalid-"));
    const configPath = path.join(tempDir, "openclaw.json");
    await writeJsonFileAtomic(configPath, config);
    const requestPath = path.join(tempDir, "request.json");
    await writeJsonFileAtomic(requestPath, { ...requestFixture, configPath });
    const { request, issues } = await loadRequest(requestPath);
    assert.equal(issues.length, 0);
    const plan = await generatePlan(request, config);
    assert.equal(plan.errors.some((entry) => entry.code === "CHANNEL_UNSUPPORTED"), true);
});
test("new unregistered channels can be planned when credential fields are provided explicitly", async () => {
    const requestFixture = await loadFixtureJson("requests", "request-explicit-new-channel.json");
    const config = await loadFixtureJson("configs", "empty-openclaw.json");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-bot-config-explicit-"));
    const configPath = path.join(tempDir, "openclaw.json");
    await writeJsonFileAtomic(configPath, config);
    const requestPath = path.join(tempDir, "request.json");
    await writeJsonFileAtomic(requestPath, { ...requestFixture, configPath });
    const { request, issues } = await loadRequest(requestPath);
    assert.equal(issues.length, 0);
    const plan = await generatePlan(request, config);
    assert.equal(plan.errors.length, 0);
    assert.equal(plan.resolved.targets[0]?.definitionSource, "request");
    assert.deepEqual(plan.resolved.targets[0]?.requiredFields, ["botId", "secret", "callbackToken"]);
    assert.equal(plan.patch.channels?.["custom-wecom-adapter"]?.accounts?.main?.botId, "bot-main");
});
test("apply creates a backup and rollback restores the original file", async () => {
    const requestFixture = await loadFixtureJson("requests", "request-isolated.json");
    const config = await loadFixtureJson("configs", "empty-openclaw.json");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-bot-config-apply-"));
    const configPath = path.join(tempDir, "openclaw.json");
    await writeJsonFileAtomic(configPath, config);
    const requestPath = path.join(tempDir, "request.json");
    await writeJsonFileAtomic(requestPath, { ...requestFixture, configPath });
    const { request } = await loadRequest(requestPath);
    const plan = await generatePlan(request, config);
    const planPath = path.join(tempDir, "plan.json");
    await writeJsonFileAtomic(planPath, plan);
    const applyResult = await applyPlan(plan, configPath);
    assert.equal(applyResult.ok, true);
    const appliedConfig = await readJsonFile(configPath);
    assert.equal(appliedConfig.channels?.dingtalk?.accounts?.work?.clientId, "work-id");
    assert.ok(applyResult.data?.backupPath);
    const rollbackResult = await rollbackConfig(configPath, String(applyResult.data?.backupPath));
    assert.equal(rollbackResult.ok, true);
    const rolledBackConfig = await readJsonFile(configPath);
    assert.deepEqual(rolledBackConfig, config);
});
test("merge only changes agents channels bindings and session", async () => {
    const requestFixture = await loadFixtureJson("requests", "request-isolated.json");
    const config = {
        meta: { keep: true },
        gateway: { port: 18789 },
        models: { providers: { demo: { enabled: true } } },
        channels: {},
        bindings: [],
        session: {}
    };
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-bot-config-scope-"));
    const configPath = path.join(tempDir, "openclaw.json");
    await writeJsonFileAtomic(configPath, config);
    const requestPath = path.join(tempDir, "request.json");
    await writeJsonFileAtomic(requestPath, { ...requestFixture, configPath });
    const { request, issues } = await loadRequest(requestPath);
    assert.equal(issues.length, 0);
    const plan = await generatePlan(request, config);
    const merged = mergeConfig(config, plan);
    assert.deepEqual(merged.meta, config.meta);
    assert.deepEqual(merged.gateway, config.gateway);
    assert.deepEqual(merged.models, config.models);
    assert.ok(merged.agents?.list);
    assert.ok(merged.channels?.dingtalk);
    assert.ok(merged.bindings);
    assert.equal(merged.session?.dmScope, "per-account-channel-peer");
});
test("copied skill directory can still execute plan_config wrapper", async () => {
    const requestFixture = await loadFixtureJson("requests", "request-isolated.json");
    const config = await loadFixtureJson("configs", "empty-openclaw.json");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-bot-config-copy-"));
    const copiedSkillRoot = path.join(tempDir, "skills", "openclaw-bot-config");
    await fs.cp(skillRoot, copiedSkillRoot, {
        recursive: true,
        filter: (source) => {
            const relative = path.relative(skillRoot, source);
            if (relative === "") {
                return true;
            }
            const segments = relative.split(path.sep);
            return !segments.includes("test") && !segments.includes("node_modules") && !segments.includes(".git");
        }
    });
    const configPath = path.join(tempDir, "openclaw.json");
    const requestPath = path.join(tempDir, "request.json");
    const planPath = path.join(tempDir, "plan.json");
    await writeJsonFileAtomic(configPath, config);
    await writeJsonFileAtomic(requestPath, { ...requestFixture, configPath });
    const wrapperPath = path.join(copiedSkillRoot, "scripts", "plan_config.mjs");
    const wrapperRealPath = await fs.realpath(wrapperPath);
    const stdoutChunks = [];
    const originalArgv = process.argv;
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.argv = [process.execPath, wrapperRealPath, "--request", requestPath, "--config", configPath, "--out", planPath];
    process.stdout.write = ((chunk) => {
        stdoutChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
        return true;
    });
    try {
        await import(pathToFileURL(wrapperRealPath).href);
    }
    finally {
        process.argv = originalArgv;
        process.stdout.write = originalWrite;
    }
    const output = JSON.parse(stdoutChunks.join(""));
    assert.equal(output.ok, true);
    assert.equal(output.data?.planPath, planPath);
    const copiedPlan = await readJsonFile(planPath);
    assert.equal(copiedPlan.summary.channels[0]?.channel, "dingtalk");
});
