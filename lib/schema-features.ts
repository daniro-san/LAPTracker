// Per-workspace feature switches and daily caps (D126), apart from lib/schema.ts for its size; drizzle.config.ts
// lists this file too. A workspace without a row, and a feature without a key in `switches` (one added to the
// catalog later), has its defaults (lib/workspace-features.ts): no data migration is needed, the own alliance
// keeps everything on with no cap, and a future paid feature starts off for any other workspace.
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

import { workspaces } from "./schema";

/** One row per workspace once the owner changed something on /admin. */
export const workspaceFeatures = pgTable(
  "workspace_features",
  {
    workspaceId: integer("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Each switch the owner set, by its lib/workspace-features.ts key: true on, false off. */
    switches: jsonb("switches").$type<Record<string, boolean>>().notNull(),
    /** Groq requests a UTC day; null: no cap. */
    aiPerDay: integer("ai_per_day"),
    /** Discord translations (languages) a UTC day; null: no cap. */
    translatePerDay: integer("translate_per_day"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "workspace_features_caps_check",
      sql`coalesce(${t.aiPerDay}, 0) >= 0 and coalesce(${t.translatePerDay}, 0) >= 0`,
    ),
  ],
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
