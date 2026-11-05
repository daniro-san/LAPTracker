// The one guard for which events public reads may see (D28). `publicEvent` keeps out rehearsals and
// admin-only manual rounds; `chainEvent` is the subset that takes part in "since the previous event"
// comparisons, ranks history and player history: every real event, and manual rounds set to
// "public in history".
import { and, eq, ne, or } from "drizzle-orm";

import { events } from "../schema";

// INVARIANT queries.public-event: no public read selects an event without this predicate.
export const publicEvent = and(eq(events.isTest, false), ne(events.visibility, "admin"));

export const chainEvent = and(
  publicEvent,
  or(eq(events.manual, false), eq(events.visibility, "history")),
);
