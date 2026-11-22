// The env guard (scripts/hooks/env-guard.sh): an agent's tool call that would read a local env file is
// blocked with exit 2; the template, the app's own pnpm scripts and ordinary commands pass.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HOOK = fileURLToPath(new URL("./env-guard.sh", import.meta.url));

function run(tool_name: string, tool_input: Record<string, string>) {
  const result = spawnSync("bash", [HOOK], {
    input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name, tool_input }),
    encoding: "utf8",
  });
  return { status: result.status, stderr: result.stderr };
}

describe("env guard", () => {
  it.each([
    ["Bash", { command: "cat .env.local" }],
    ["Bash", { command: "grep KEY .env" }],
    ["Bash", { command: "ls -a | xargs cat .env*" }],
    ["Bash", { command: "node -r dotenv/config -e 'console.log(process.env)'" }],
    ["Read", { file_path: "/home/dev/LAPTracker/.env.local" }],
    ["Grep", { pattern: "KEY", path: ".env.production" }],
    ["Glob", { pattern: "**/.env*" }],
  ])("blocks an agent reading a secret env file: %s %j", (tool, input) => {
    const { status, stderr } = run(tool, input);
    expect(status).toBe(2);
    expect(stderr).toContain("env-guard:");
  });

  it.each([
    ["Bash", { command: "cat .env.example" }],
    ["Read", { file_path: "/home/dev/LAPTracker/.env.example" }],
    ["Bash", { command: "pnpm dev:local" }],
    ["Bash", { command: "pnpm db:local:seed --with-states" }],
    ["Bash", { command: "git status" }],
    ["Bash", { command: "grep -rn 'process.env.EDIT_PIN' lib && echo environment" }],
    ["Glob", { pattern: "**/*.ts" }],
  ])("lets the template, pnpm scripts and ordinary commands through: %s %j", (tool, input) => {
    expect(run(tool, input).status).toBe(0);
  });
});
