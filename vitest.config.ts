import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    // PGlite open+migrate in beforeAll (D19): slowest 69.8 s across four parallel `pnpm test`
    // runs on a 10-core Mac at load average 66 (2026-11-05, #124); about 2x that.
    hookTimeout: 140_000,
    include: ["**/*.test.ts"],
    // .claude/worktrees: agent worktrees inside the main checkout have their own tests and node_modules.
    exclude: ["node_modules/**", ".next/**", ".claude/worktrees/**"],
  },
});
