// Home's recent activity (D108): garrison plans saved and posted to Discord (D121), as two more parts of
// lib/repo/desk-activity.ts's small-sources union read. Who, when and which Undead Siege; never a pair or
// a name. A plan keeps only its last save, so an earlier save that a later one replaced is not listed.
import { sql } from "drizzle-orm";

/**
 * The two parts, each its own newest `n` since `since` and before `before` (the page's cursor), in the
 * union's columns (`a` kind, `b` variant, `level`, `title`: the siege's entry, for its title).
 */
export const parts = (ws: number, since: string, before: string, n: number) => sql`
    union all
    (select 'garrisonSaved', g.saved_by, g.saved_at, null, c.kind, c.variant, c.level, c.title, null
      from garrison_plans g join calendar_entries c on c.id = g.entry_id
      where g.workspace_id = ${ws} and g.saved_by is not null
        and g.saved_at >= ${since} and g.saved_at < ${before}
      order by g.saved_at desc limit ${n})
    union all
    (select 'garrisonPosted', g.posted_by, g.posted_at, null, c.kind, c.variant, c.level, c.title, null
      from garrison_plans g join calendar_entries c on c.id = g.entry_id
      where g.workspace_id = ${ws} and g.post_status = 'posted' and g.posted_by is not null
        and g.posted_at >= ${since} and g.posted_at < ${before}
      order by g.posted_at desc limit ${n})`;

export type Kind = "garrisonSaved" | "garrisonPosted";

/** A save or a post, as a line of the feed: who, when, and the siege's entry for its title. */
export interface GarrisonDone {
  kind: Kind;
  by: number;
  at: Date;
  entry: { kind: string; variant: string | null; level: number | null; title: string | null };
}

/** Two lists, one per part: the feed's paging horizon reads each source's rows apart (D108). */
export interface Rows {
  garrisonSaves: GarrisonDone[];
  garrisonPosts: GarrisonDone[];
}

type Row = {
  by: number;
  at: Date;
  a: string | null;
  b: string | null;
  level: number | null;
  title: string | null;
};

/** The two parts' rows, from the union's reader of rows by kind. */
export const rows = (of: (kind: Kind) => Row[]): Rows => {
  const done = (kind: Kind) =>
    of(kind).map(({ by, at, a, b, level, title }) => ({
      kind,
      by,
      at,
      entry: { kind: a ?? "", variant: b, level, title },
    }));
  return { garrisonSaves: done("garrisonSaved"), garrisonPosts: done("garrisonPosted") };
};
