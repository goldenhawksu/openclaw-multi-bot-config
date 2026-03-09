import { parseArgs, optionalString, requireOption } from "../lib/args.js";
import { readJsonFile, writeJsonFileAtomic } from "../lib/files.js";
import { maskSecrets } from "../lib/mask-secrets.js";
import { runCli } from "../lib/output.js";
import { generatePlan } from "../lib/planner.js";
import { loadRequest } from "../lib/request.js";
import { CliError, errorResult, okResult } from "../lib/result.js";
import { validatePlan } from "../lib/validator.js";
export async function main() {
    await runCli(async () => {
        const args = parseArgs(process.argv.slice(2));
        const requestPath = requireOption(args, "request");
        const configPath = requireOption(args, "config");
        const outPath = optionalString(args, "out");
        const { request, issues } = await loadRequest(requestPath);
        if (issues.length > 0) {
            throw new CliError("INVALID_REQUEST", "Request validation failed", issues);
        }
        const currentConfig = await readJsonFile(configPath);
        const plan = await generatePlan({ ...request, configPath }, currentConfig);
        const validation = await validatePlan(plan, currentConfig);
        const errors = validation.issues.filter((entry) => entry.severity === "error");
        if (outPath) {
            await writeJsonFileAtomic(outPath, plan);
        }
        const data = {
            plan,
            preview: maskSecrets({
                summary: plan.summary,
                patch: plan.patch,
                warnings: [...plan.warnings, ...validation.warnings],
                errors: [...plan.errors, ...errors]
            }),
            previewConfig: maskSecrets(validation.previewConfig),
            ...(outPath ? { planPath: outPath } : {})
        };
        if (errors.length > 0) {
            return errorResult(errors[0]?.code ?? "PLAN_INVALID", errors[0]?.message ?? "Plan validation failed", [
                ...validation.issues,
                ...validation.warnings
            ]);
        }
        return okResult("Plan generated", {
            ...data
        }, validation.warnings);
    });
}
