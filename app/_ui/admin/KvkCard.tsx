// /admin's KvK opponent card (D152, issue 306): the next KvK and the KvKs among the 4 scheduled events before it, each with its
// opponent's server, tags, result, what the Start and End read of each tag, and the server's ranks board
// suggestion (D155). Read after the page's own isAdmin() check. English only (D48).
import { copy } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { adminKvk, type AdminKvkRead } from "@/lib/queries/admin-kvk";
import { nextKvk } from "@/lib/schedule";
import { fill } from "@/lib/words";

import { compact, hhmmOn, type Clock } from "../format";
import { requestLocale } from "../locale";
import { KvkForm, type KvkChoice, type KvkSuggestion } from "./KvkForm";
import { AdminSection } from "./parts";

const t = copy.admin.kvk;

type Row = Awaited<ReturnType<typeof adminKvk>>[number];

/** A tag's outcome in one phase, in words: read (with the name), stale, the row's error, or none yet. */
function stateOf(r: AdminKvkRead | undefined): string {
  if (!r) return t.state.none;
  if (r.error) return r.error;
  if (!r.isFresh) return t.state.stale;
  return r.name ? fill(t.state.readName, { name: r.name }) : t.state.read;
}

/** The board's suggestion for the saved server in words: its line and chips; null with no read. */
function suggestionOf(row: Row, now: Date, clock: Clock, locale: string): KvkSuggestion | null {
  const s = row.suggestion;
  if (!s) return null;
  const server = s.server;
  if (s.status === "running") return { line: fill(t.suggest.running, { server }), chips: [] };
  if (s.status === "failed" || !s.alliances || !s.readAt)
    return { line: fill(t.suggest.failed, { server }), chips: [] };
  const time = hhmmOn(clock, s.readAt, clock.day(s.readAt) !== clock.day(now));
  return {
    line: fill(t.suggest.from, { server, time }),
    chips: s.alliances.map((a) => ({
      tag: a.tag,
      label: fill(t.suggest.chip, { tag: a.tag, might: compact(a.power, locale) }),
    })),
  };
}

async function choices(now: Date, clock: Clock): Promise<KvkChoice[]> {
  const env = getEnv();
  const next = nextKvk(now, env).eventAtUtc;
  const locale = await requestLocale();
  const rows = await withPageDb((db) => adminKvk(db, next, now, env));
  return rows.map((row) => {
    const { at, opponent: o, reads } = row;
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
      suggestion: suggestionOf(row, now, clock, locale),
      canSuggest: row.canSuggest,
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
