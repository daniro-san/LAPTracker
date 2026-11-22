import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));
// forceRerunTriggers are matched against absolute paths: a repo-root path, glob characters escaped.
const atRoot = (glob: string) => root.replace(/[\\[\](){}*?!+@]/g, "\\$&") + glob;

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    environment: "node",
    globalSetup: ["./vitest.global-setup.ts"],
    // PGlite open+migrate in beforeAll (D19): slowest 69.8 s across four parallel `pnpm test`
    // runs on a 10-core Mac at load average 66 (2026-11-05, #124); about 2x that.
    hookTimeout: 140_000,
    // Slowest test body (a route test on PGlite): 4.8 s across 3,280 bodies in three rounds of
    // parallel `pnpm test` at load average 28-67 (2026-11-05, #124); about 2x that.
    testTimeout: 10_000,
    include: ["**/*.test.ts"],
    // .claude/worktrees: agent worktrees inside the main checkout have their own tests and node_modules.
    exclude: ["node_modules/**", ".next/**", ".claude/worktrees/**"],
    // `--changed` (pnpm check:fast) runs every test when one of these changed: tests read them from disk or
    // share them, so the import graph does not see them.
    forceRerunTriggers: [
      "**/package.json",
      "**/vitest.config.*",
      atRoot("vitest.global-setup.ts"),
      atRoot("pnpm-lock.yaml"),
      atRoot("drizzle/**"),
      atRoot("fixtures/**"),
      atRoot("docs/analytics/tracking-plan.md"),
      atRoot("lib/i18n/glossary/*.md"),
      atRoot("lib/screenshot/tessdata/**"),
    ],
  },
});
