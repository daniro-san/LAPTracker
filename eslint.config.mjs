// Flat config. Rules from docs/IMPLEMENTATION_PLAN.md §11.2: limits are signals to split, never disable them inline.
import { readdirSync } from "node:fs";

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import { createNodeResolver, importX } from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

// The dependency rule of docs/ARCHITECTURE.md, linted (plan §11.2, docs/decisions/D34).
const zones = [
  {
    target: ["./lib/compute.ts", "./lib/budget.ts"],
    from: ".",
    except: ["./node_modules"],
    message: "lib/compute and lib/budget are pure: they import nothing from the project.",
  },
  {
    target: "./lib/screenshot",
    from: ".",
    except: ["./node_modules", "./lib/screenshot"],
    message: "lib/screenshot imports nothing from the project, and nothing from the database.",
  },
  {
    // D81: what goes to Groq is built from the officer's text alone, so no roster field can reach a request.
    target: "./lib/ai",
    from: ".",
    except: ["./node_modules", "./lib/ai"],
    message:
      "lib/ai imports nothing from the project: a request carries only the officer's text (D81).",
  },
  {
    target: "./lib/schedule.ts",
    from: ".",
    except: ["./node_modules", "./lib/env.ts"],
    message: "lib/schedule is pure: it imports only the Env type from lib/env.",
  },
  {
    target: ["./lib", "./config"],
    from: "./app",
    message: "Nothing in lib/ or config/ imports from app/.",
  },
  {
    target: "./app",
    from: "./lib/sources",
    message: "app/ reaches upstream only through lib/run, lib/tick or lib/rehearsal.",
  },
  {
    target: ["./app/(pages)", "./app/_ui", "./app/(private)"],
    from: "./lib/repo",
    message:
      "Pages and UI read through lib/queries, the workspace through lib/private (D71); only route handlers use lib/repo.",
  },
];
const restrict = (extra) => ["error", { zones: [...zones, ...extra] }];
const PRIVATE = ["app/(private)/**", "lib/private/**"];
// D71: lib/private logs only through its own code-and-numbers wrapper and sends no Discord message.
const NOTIFY_AND_DISCORD = readdirSync(`${import.meta.dirname}/lib`)
  .filter((f) => /^(notify|discord-).*\.tsx?$/.test(f) && !f.endsWith(".test.ts"))
  .map((f) => `./lib/${f}`);

export default defineConfig(
  // .claude/worktrees: agent worktrees inside the main checkout carry their own config and node_modules.
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "fixtures/**",
      "coverage/**",
      ".claude/worktrees/**",
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    plugins: { "import-x": importX },
    // no-restricted-paths skips any import it cannot resolve, and the default resolver knows neither
    // .ts nor the tsconfig "@/" alias: without this the zones below would pass silently.
    settings: {
      "import-x/resolver-next": [
        createNodeResolver({
          extensions: [".ts", ".tsx", ".js", ".mjs"],
          tsconfig: { configFile: `${import.meta.dirname}/tsconfig.json` },
        }),
      ],
    },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      // Length binds on long-but-linear code (orchestrators, JSX); tangling is what hurts readers and
      // agents, and complexity + max-depth measure that. So length is loose, branching is tight.
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 12],
      "max-depth": ["error", 3],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "import-x/no-restricted-paths": restrict([]),
    },
  },
  {
    // D71, an allowlist: every module outside app/(private) and lib/private is fenced out of lib/private,
    // so a module added later is fenced out by default.
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: PRIVATE,
    rules: {
      "import-x/no-restricted-paths": restrict([
        {
          target: ".",
          from: "./lib/private",
          message: "Only app/(private) imports lib/private (D71).",
        },
      ]),
    },
  },
  {
    // D148, the one exception: the tick's roll call reminders take the Roll call page's counts (no name) from
    // one lib/private module, so the reminder and the page never count differently.
    files: ["lib/push-tick.ts"],
    rules: {
      "import-x/no-restricted-paths": restrict([
        {
          target: "./lib/push-tick.ts",
          from: "./lib/private",
          except: ["./push-roll-calls.ts"],
          message: "lib/push-tick.ts imports only lib/private/push-roll-calls.ts (D148).",
        },
      ]),
    },
  },
  {
    files: ["lib/private/**"],
    rules: {
      "import-x/no-restricted-paths": restrict([
        {
          target: "./lib/private",
          from: NOTIFY_AND_DISCORD,
          message:
            "lib/private logs through lib/private/log.ts and sends no Discord message (D71).",
        },
      ]),
    },
  },
  {
    // D71 through lib/push: lib/private imports lib/push, which reports errors through lib/report-error, so
    // neither may reach lib/notify* or lib/discord-* (D115, 2026-11-21).
    files: ["lib/push.ts", "lib/report-error.ts"],
    rules: {
      "import-x/no-restricted-paths": restrict([
        {
          target: ["./lib/push.ts", "./lib/report-error.ts"],
          from: NOTIFY_AND_DISCORD,
          message:
            "lib/push and lib/report-error, which lib/private reaches, import no lib/notify* or lib/discord-* (D71).",
        },
      ]),
    },
  },
  {
    // A describe() block is one function by syntax but N test cases by meaning.
    files: ["**/*.test.ts"],
    rules: { "max-lines-per-function": "off" },
  },
  {
    // One translation per file is data, not logic, and the translate-copy skill edits that one file (D88).
    files: ["lib/i18n/*.ts"],
    ignores: ["lib/i18n/index.ts"],
    rules: { "max-lines": "off" },
  },
  {
    // The release log is data that grows by one entry per release (/admin/changes), like a translation file.
    files: ["lib/patch-notes.ts"],
    rules: { "max-lines": "off" },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
);
