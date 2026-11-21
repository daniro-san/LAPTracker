// Browser notifications for officers (D148, issue 558), apart from lib/schema.ts for its size; drizzle.config.ts
// lists this file too. `push_subscriptions`: one row per officer and device (a browser's push subscription for
// one workspace), its endpoint and keys stored only encrypted (AES-256-GCM under WORKSPACE_KEYS_SECRET, as
// D129's webhooks), with the uses it is on for. `push_marks`: what was last sent for a trigger, so each
// trigger notifies once. No read model, route, page or log selects `ciphertext` or `nonce`.
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";

const tstz = (name: string) => timestamp(name, { withTimezone: true });

/** What a notification is about; each has its own switch on the Notifications card. */
export const PUSH_USES = ["shield", "night_read", "claim", "roll_call"] as const;
export type PushUse = (typeof PUSH_USES)[number];

/** The desk's three languages (lib/private/dictionary.ts, which lib/ may not import). */
export const PUSH_LANGUAGES = ["en", "pt-BR", "fr"] as const;
export type PushLanguage = (typeof PUSH_LANGUAGES)[number];

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    workspaceUserId: integer("workspace_user_id")
      .notNull()
      .references(() => workspaceUsers.id, { onDelete: "cascade" }),
    /** sha256 of the endpoint, hex: finds this device's row (sign-out, the card) without opening any. */
    endpointHash: text("endpoint_hash").notNull(),
    /** base64 of the AES-256-GCM ciphertext of the subscription's JSON (endpoint and keys) and its tag. */
    ciphertext: text("ciphertext").notNull(),
    /** base64 of the 12-byte nonce, new on every write. */
    nonce: text("nonce").notNull(),
    /** Which master key sealed it (D124's fingerprint, not a secret). */
    masterFp: text("master_fp").notNull(),
    uses: text("uses").array().$type<PushUse[]>().notNull(),
    /** The desk's language on the device when it was saved: the notifications' language. */
    language: text("language").$type<PushLanguage>().notNull(),
    createdAt: tstz("created_at").notNull(),
    /** The push service's last 201 for this row; null before the first. */
    lastSuccessAt: tstz("last_success_at"),
  },
  (t) => [
    unique("push_subscriptions_endpoint_unique").on(t.workspaceId, t.endpointHash),
    index("push_subscriptions_user_idx").on(t.workspaceId, t.workspaceUserId),
    check("push_subscriptions_language_check", sql`${t.language} in ('en', 'pt-BR', 'fr')`),
  ],
);

/**
 * The last value notified for a trigger of one workspace (`key`: "shield:2026-11-20", "night:2026-11-20",
 * "claim:12", "rc-open:5:2026-11-16"…). A trigger notifies only when its value changes, claimed by one
 * atomic upsert, so two ticks never send it twice.
 */
export const pushMarks = pgTable(
  "push_marks",
  {
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    sentAt: tstz("sent_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);
