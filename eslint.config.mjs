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
    target: "./lib/words.ts",
    from: ".",
    except: ["./node_modules"],
    message:
      "lib/words imports nothing from the project: pages, push and Discord share its one rule.",
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
// docs/DESIGN.md "Enforcement": a colour literal (#abc, #a1b2c3, rgb(, rgba() is written only in
// lib/brand/tokens.css. Only string and template literals are checked (JSX attribute values and style
// objects are string literals), so a comment or an issue number in a test name is never a hit.
const COLOUR = String.raw`/#[0-9a-f]{3,6}\b|rgba?\(/i`;
const COLOUR_MESSAGE =
  "No colour literal in app/ or lib/brand/components/ (docs/DESIGN.md, Enforcement). Use a brand token: a Tailwind token class (text-ink, bg-paper, border-rule…), var(--token), or currentColor. A new colour goes in lib/brand/tokens.css.";
// Issue 592: one plural rule. An entry that sets no-restricted-syntax replaces an earlier entry's options
// for the files both match, so the colour entry below lists this selector too.
const PLURAL_RULES = {
  selector: "MemberExpression[object.name='Intl'][property.name='PluralRules']",
  message:
    "No raw Intl.PluralRules (issue 592): use plural(n, { one, other }, language) from lib/words.ts.",
};
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
      "test-results/**",
      "playwright-report/**",
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
      // 400, not 300 (D88 amendment 2026-11-22): data files are exempt below, and code splits by concept.
      "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
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
    // D159, the second exception: the tick's catalog posts are made and sent by one lib/private module, which
    // reads the calendar entries members can see, and for the welcome the joiners' public names; never a
    // private roster field.
    files: ["lib/posts-tick.ts"],
    rules: {
      "import-x/no-restricted-paths": restrict([
        {
          target: "./lib/posts-tick.ts",
          from: "./lib/private",
          except: ["./catalog-posts.ts"],
          message: "lib/posts-tick.ts imports only lib/private/catalog-posts.ts (D159).",
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
    files: ["**/*.test.ts", "e2e/**/*.spec.ts"],
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
    // Data, not logic, like a translation file (D88 amendment 2026-11-22): the desk dictionaries, the public
    // copy, the schema, and the e2e seed, fixtures and specs. Every other rule still applies.
    files: [
      "lib/private/dictionary*.ts",
      "lib/copy*.ts",
      "lib/schema*.ts",
      "e2e/fixtures/**/*.ts",
      "e2e/*.spec.ts",
    ],
    ignores: ["**/*.test.ts"],
    rules: { "max-lines": "off" },
  },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: ["lib/words.ts"],
    rules: { "no-restricted-syntax": ["error", PLURAL_RULES] },
  },
  {
    // Tests never reach the page, and their names carry issue numbers ("#592"), so they are not checked.
    files: ["app/**/*.{ts,tsx}", "lib/brand/components/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${COLOUR}]`, message: COLOUR_MESSAGE },
        { selector: `TemplateElement[value.raw=${COLOUR}]`, message: COLOUR_MESSAGE },
        PLURAL_RULES,
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "e2e/**/*.mjs", "*.config.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
);
