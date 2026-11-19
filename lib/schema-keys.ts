// Each workspace's own tracker key (D124), apart from lib/schema.ts for its size; drizzle.config.ts lists
// this file too. The key is stored only encrypted (AES-256-GCM under WORKSPACE_KEYS_SECRET, the workspace id
// as associated data); its last 4 characters are kept for "ends in ••••abcd". No read model, route, page or
// log selects `ciphertext` or `nonce`: only lib/workspace-keys.ts decrypts, at call time.
import { sql } from "drizzle-orm";
import { check, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";

const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const KEY_STATUSES = ["unset", "ok", "invalid", "out_of_quota", "reenter"] as const;
export type KeyStatus = (typeof KEY_STATUSES)[number];

/** One row per workspace once a key was ever saved; Remove empties it back to `unset`. */
export const workspaceKeys = pgTable(
  "workspace_keys",
  {
    workspaceId: integer("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** base64 of the AES-256-GCM ciphertext followed by its 16-byte tag; null when unset. */
    ciphertext: text("ciphertext"),
    /** base64 of the 12-byte nonce, new on every write. */
    nonce: text("nonce"),
    /**
     * Which master key sealed it: a truncated HMAC of a fixed label under WORKSPACE_KEYS_SECRET, never the
     * secret. A row whose fingerprint is not the current secret's reads as `reenter`, computed, unwritten.
     */
    masterFp: text("master_fp"),
    last4: text("last4"),
    status: text("status", { enum: KEY_STATUSES }).notNull(),
    /** When the status was last set: the save's test, a read's 401 or 429, or a key that does not open
     * under its own master key (`reenter`). */
    statusAt: tstz("status_at").notNull(),
    /** The key's own quota left, from its last /quota or /players answer; null before any. */
    quotaRemaining: integer("quota_remaining"),
  },
  (t) => [
    check(
      "workspace_keys_status_check",
      sql`${t.status} in ('unset', 'ok', 'invalid', 'out_of_quota', 'reenter')`,
    ),
  ],
);

/** Who saved or removed the key and when (Home's activity line), one row per request id. Never the key. */
export const workspaceKeyChanges = pgTable(
  "workspace_key_changes",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    action: text("action", { enum: ["set", "removed"] }).notNull(),
    changedBy: integer("changed_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    changedAt: tstz("changed_at").notNull(),
    requestId: text("request_id").notNull(),
  },
  (t) => [
    unique("workspace_key_changes_request_unique").on(t.workspaceId, t.requestId),
    check("workspace_key_changes_action_check", sql`${t.action} in ('set', 'removed')`),
  ],
);
