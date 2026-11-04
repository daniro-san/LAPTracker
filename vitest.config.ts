import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // .claude/worktrees: agent worktrees inside the main checkout have their own tests and node_modules.
    exclude: ["node_modules/**", ".next/**", ".claude/worktrees/**"],
  },
});
