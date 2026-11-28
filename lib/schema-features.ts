// Per-workspace feature switches and daily caps (D126), apart from lib/schema.ts for its size; drizzle.config.ts
// lists this file too. A workspace without a row, and a key missing from its maps, has its defaults
// (lib/workspace-features.ts, D134): the own alliance keeps everything on with no cap, any other follows
// /admin's "Defaults for new alliances".
import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";

/**
 * An alliance's glossary (#832, D81 amendment): words its translate, improve and fit requests keep as written
 * (tags, nicknames, game words). One row per workspace, the whole list, officers' own text only; never
 * logged, never sent to analytics.
 */
export const workspaceGlossary = pgTable("workspace_glossary", {
  workspaceId: integer("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  words: jsonb("words").$type<string[]>().notNull().default([]),
  updatedBy: integer("updated_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** One row per workspace once the owner changed something on /admin. */
export const workspaceFeatures = pgTable("workspace_features", {
  workspaceId: integer("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  /** Each switch the owner set, by its lib/workspace-features.ts key: true allowed, false not. */
  switches: jsonb("switches").$type<Record<string, boolean>>().notNull(),
  /**
   * Each daily cap the owner set (D134): `ai` Groq requests, `translate` Discord languages a UTC day; a
   * number, or null for no cap. A missing key follows the defaults.
   */
  caps: jsonb("caps")
    .$type<Partial<Record<"ai" | "translate", number | null>>>()
    .notNull()
    .default({}),
  /** Each switch the alliance's officers set in Alliance settings (D134): true on, false off. */
  allianceSwitches: jsonb("alliance_switches")
    .$type<Record<string, boolean>>()
    .notNull()
    .default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * /admin's "Defaults for new alliances" (D134): one row, only the values the owner set; a missing key keeps
 * lib/workspace-features.ts's CODE_DEFAULTS. Every workspace but the own alliance follows it where it has no
 * override of its own.
 */
export const featureDefaults = pgTable(
  "feature_defaults",
  {
    id: integer("id").primaryKey().default(1),
    switches: jsonb("switches").$type<Record<string, boolean>>().notNull().default({}),
    caps: jsonb("caps")
      .$type<Partial<Record<"ai" | "translate", number | null>>>()
      .notNull()
      .default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("feature_defaults_one_row", sql`${t.id} = 1`)],
);

/** How much of each allowance a workspace used on a UTC day: counts only, nothing about what was asked. */
export const workspaceUsage = pgTable(
  "workspace_usage",
  {
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    allowance: text("allowance", { enum: ["ai", "translate"] }).notNull(),
    day: date("day", { mode: "string" }).notNull(),
    used: integer("used").notNull(),
  },
  (t) => [
    primaryKey({ name: "workspace_usage_pk", columns: [t.workspaceId, t.allowance, t.day] }),
    check("workspace_usage_allowance_check", sql`${t.allowance} in ('ai', 'translate')`),
  ],
);

/** The owner's global pause of a paid allowance: a row turns its features off in every workspace. */
export const allowancePauses = pgTable(
  "allowance_pauses",
  {
    allowance: text("allowance", { enum: ["ai", "translate"] }).primaryKey(),
    pausedAt: timestamp("paused_at", { withTimezone: true }).notNull(),
  },
  (t) => [check("allowance_pauses_allowance_check", sql`${t.allowance} in ('ai', 'translate')`)],
);
