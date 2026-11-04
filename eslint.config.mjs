// Flat config. Rules from docs/IMPLEMENTATION_PLAN.md §11.2: limits are signals to split, never disable them inline.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import { importX } from "eslint-plugin-import-x";
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
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 12],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
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
