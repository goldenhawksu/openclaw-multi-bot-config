import path from "node:path";
import { fileURLToPath } from "node:url";
export function getSkillRoot() {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}
export function getScriptsDir() {
    return path.join(getSkillRoot(), "scripts");
}
export function sanitizeIdentifier(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}
export function buildAutoWorkspace(configPath, workspaceName) {
    return path.join(path.dirname(configPath), sanitizeIdentifier(workspaceName));
}
