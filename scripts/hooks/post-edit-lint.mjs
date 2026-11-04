// Claude Code PostToolUse hook (Edit|Write): eslint --fix on the one changed file (plan §11.4).
// Exit 2 sends the remaining errors back to the agent; anything else is silent.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const LINTABLE = /\.(ts|tsx|mts|js|mjs)$/;
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
const filePath = payload.tool_input?.file_path;
if (typeof filePath !== "string" || !LINTABLE.test(filePath)) process.exit(0);

const file = resolve(projectDir, filePath);
const rel = relative(projectDir, file);
if (rel.startsWith("..") || !existsSync(file)) process.exit(0);

const eslint = resolve(projectDir, "node_modules/.bin/eslint");
if (!existsSync(eslint)) {
  console.error("post-edit-lint: node_modules missing, run `pnpm install`");
  process.exit(0);
}

const run = spawnSync(eslint, ["--fix", "--no-warn-ignored", "--max-warnings=0", rel], {
  cwd: projectDir,
  encoding: "utf8",
});
if (run.status !== 0) {
  console.error(`eslint found problems in ${rel} after --fix:\n${run.stdout}${run.stderr}`);
  process.exit(2);
}
