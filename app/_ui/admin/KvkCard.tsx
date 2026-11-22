// /admin's KvK opponent card (D152, issue 306): the next scheduled event and the 4 before it, each with its
// opponent's server, tags, result and what the Start and End read of each tag. Read after the page's own
// isAdmin() check. English only (D48).
import { copy } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { adminKvk, type AdminKvkRead } from "@/lib/queries/admin-kvk";
import { nextEvent } from "@/lib/schedule";
import { fill } from "@/lib/words";

import type { Clock } from "../format";
import { KvkForm, type KvkChoice } from "./KvkForm";
import { AdminSection } from "./parts";

const t = copy.admin.kvk;

/** A tag's outcome in one phase, in words: read (with the name), stale, the row's error, or none yet. */
function stateOf(r: AdminKvkRead | undefined): string {
  if (!r) return t.state.none;
  if (r.error) return r.error;
  if (!r.isFresh) return t.state.stale;
  return r.name ? fill(t.state.readName, { name: r.name }) : t.state.read;
}

async function choices(now: Date, clock: Clock): Promise<KvkChoice[]> {
  const next = nextEvent(now, getEnv()).eventAtUtc;
  const rows = await withPageDb((db) => adminKvk(db, next));
  return rows.map(({ at, opponent: o, reads }) => {
    const of = (tag: string, phase: "before" | "after") =>
      stateOf(reads.find((r) => r.tag === tag && r.phase === phase));
    const tags = [...new Set([...(o?.tags ?? []), ...reads.map((r) => r.tag)])];
    const line = (tag: string) =>
      fill(t.read, { tag, start: of(tag, "before"), end: of(tag, "after") });
    return {
      at: at.toISOString(),
      label: at === next ? fill(t.next, { day: clock.weekday(at) }) : clock.weekday(at),
      server: o?.server ?? null,
      tags: o?.tags ?? [],
      result: o?.result ?? null,
      locked: now >= at,
      lines: reads.length === 0 ? [] : tags.map(line),
    };
  });
}

export async function KvkCard({ now, clock }: { now: Date; clock: Clock }) {
  return (
    <AdminSection id="kvk" title={t.title} help={t.help}>
      <KvkForm choices={await choices(now, clock)} />
    </AdminSection>
  );
}
