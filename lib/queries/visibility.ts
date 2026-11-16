// The one guard for which events public reads may see (D28). `publicEvent` keeps out rehearsals and
// admin-only manual rounds; `chainEvent` is the subset that takes part in "since the previous event"
// comparisons, ranks history and player history: every real event, and manual rounds set to
// "public in history".
import { and, eq, ne, or, sql } from "drizzle-orm";

import type { Phase } from "../repo";
import { events, snapshots } from "../schema";

// INVARIANT queries.phases-not-samples: a read of an event's Before and After keeps its samples (D69) out,
// so every page, route and message built on them reads exactly as before samples existed. Only
// `eventSamples` (lib/queries/samples.ts) and the admin run lists read samples. The predicate is defined
// once, in lib/repo/snapshots.ts, because lib/repo readers need it too.
export { phaseSnapshot } from "../repo/snapshots";

/** `snapshots.phase` typed as the two phases, for a select filtered with `phaseSnapshot`. */
export const phaseColumn = sql<Phase>`${snapshots.phase}`;

// INVARIANT queries.public-event: no public read selects an event without this predicate.
export const publicEvent = and(eq(events.isTest, false), ne(events.visibility, "admin"));

export const chainEvent = and(
  publicEvent,
  or(eq(events.manual, false), eq(events.visibility, "history")),
);
