// Flat config. Rules from docs/IMPLEMENTATION_PLAN.md §11.2: limits are signals to split, never disable them inline.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import { createNodeResolver, importX } from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

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
      // The dependency rule of docs/ARCHITECTURE.md, linted (plan §11.2, docs/decisions/D34).
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: ["./lib/compute.ts", "./lib/budget.ts"],
              from: ".",
              except: ["./node_modules"],
              message: "lib/compute and lib/budget are pure: they import nothing from the project.",
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
              target: ["./app/(pages)", "./app/_ui"],
              from: "./lib/repo",
              message: "Pages and UI read through lib/queries; only route handlers use lib/repo.",
            },
          ],
        },
      ],
    },
  },
  {
    // A describe() block is one function by syntax but N test cases by meaning.
    files: ["**/*.test.ts"],
    rules: { "max-lines-per-function": "off" },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
);
