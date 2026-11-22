// The env guard (scripts/hooks/env-guard.sh), a guard against accidental reads: an agent's tool call that
// would read a local env file is blocked with exit 2; the template, the app's own pnpm scripts and ordinary
// commands pass.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HOOK = fileURLToPath(new URL("./env-guard.sh", import.meta.url));
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function run(input: string) {
  const result = spawnSync("bash", [HOOK], {
    input,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
  });
  return { status: result.status, stderr: result.stderr };
}

const call = (tool_name: string, tool_input: Record<string, string>) =>
  JSON.stringify({ hook_event_name: "PreToolUse", tool_name, tool_input });

describe("env guard", () => {
  it.each([
    ["Bash", { command: "cat .env.local" }],
    ["Bash", { command: "grep KEY .env" }],
    ["Bash", { command: "ls -a | xargs cat .env*" }],
    ["Bash", { command: "cat .ENV.LOCAL" }],
    ["Bash", { command: "cat .[e]nv.local" }],
    ["Bash", { command: "node -r dotenv/config -e 'console.log(process.env)'" }],
    ["Bash", { command: "grep -rn DATABASE_URL ." }],
    ["Bash", { command: "rg --hidden DATABASE_URL" }],
    ["Bash", { command: "find . -type f -exec cat {} +" }],
    ["Monitor", { command: "tail -f .env.local", description: "env changes" }],
    ["Read", { file_path: "/home/dev/LAPTracker/.env.local" }],
    ["Grep", { pattern: "KEY", path: ".env.production" }],
    ["Glob", { pattern: "**/.e*" }],
    ["Glob", { pattern: "**/.e?v.local" }],
    ["Glob", { pattern: "*", path: "/home/dev/LAPTracker/.env" }],
    ["Grep", { pattern: "KEY", glob: ".e*" }],
  ])("blocks an agent reading a secret env file: %s %j", (tool, input) => {
    const { status, stderr } = run(call(tool, input));
    expect(status).toBe(2);
    expect(stderr).toContain("env-guard:");
  });

  it("refuses a hook input it cannot read", () => {
    expect(run("not json").status).toBe(2);
  });

  it.each([
    ["Bash", { command: "cat .env.example" }],
    ["Read", { file_path: "/home/dev/LAPTracker/.env.example" }],
    ["Bash", { command: "pnpm dev:local" }],
    ["Bash", { command: "pnpm db:local:seed --with-states" }],
    ["Bash", { command: "git status" }],
    ["Bash", { command: "grep -rn 'process.env.EDIT_PIN' lib && echo environment" }],
    ["Bash", { command: String.raw`grep -rn 'process\.env' lib` }],
    ["Bash", { command: "grep -rn DATABASE_URL lib app" }],
    ["Bash", { command: "grep -rn --exclude='.env*' DATABASE_URL ." }],
    ["Glob", { pattern: "**/*.ts" }],
    ["Bash", { command: 'git commit -m "docs: copy .env.example."' }],
    ["Bash", { command: "grep -rn 'getAppContext().env' app" }],
    ["Bash", { command: "git log --grep=dotenv" }],
  ])("lets the template, pnpm scripts and ordinary commands through: %s %j", (tool, input) => {
    expect(run(call(tool, input)).status).toBe(0);
  });
});
