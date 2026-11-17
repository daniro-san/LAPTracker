// The thefts log's words per card (issue 321), made on the server in the officer's language: server times,
// counts and labels. The client list (TheftCards.tsx) only lays them out, and adds the viewer's own clock
// after hydration, so server and browser HTML never differ.
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import type { AllianceGroup, AttackerGroup, FollowUpState } from "@/lib/private/theft-groups";

type TheftKey = Extract<WorkspaceKey, `thefts.${string}`>;
export type TheftWords = Record<TheftKey | "time.server" | "src.photo" | "src.officer", string>;

/** The words the client components need: the thefts keys and three shared ones. */
export function theftWords(t: WorkspaceDictionary): TheftWords {
  const keys = Object.keys(t).filter(
    (k) => k.startsWith("thefts.") || ["time.server", "src.photo", "src.officer"].includes(k),
  ) as (keyof TheftWords)[];
  return Object.fromEntries(keys.map((k) => [k, t[k]])) as TheftWords;
}

export interface EntryCard {
  id: number;
  /** "Sun 15 Nov 13:46 server time", or "Time not read". */
  server: string;
  /** The instant, for the viewer's own clock; null when not read. */
  at: number | null;
  /** The server day "2026-11-15", to tell whether the viewer's clock is on another day. */
  day: string | null;
  victim: string;
  stolen: string;
  source: "photo" | "typed";
  note: string | null;
}

export interface AttackerCard {
  key: string;
  /** "[VNC] •St•BugaBoo". */
  name: string;
  counts: string;
  state: FollowUpState;
  /** "Set by Ana, Sun 15 Nov 14:02 server time"; null before any officer set one. */
  changed: string | null;
  lastNote: string | null;
  reopened: string | null;
  victims: { uid: number; name: string; count: number }[];
  entries: EntryCard[];
}

export interface AllianceCard {
  tag: string;
  counts: string;
  attackers: AttackerCard[];
}

export interface TheftFormats {
  /** "Sun 15 Nov 13:46" in server time. */
  when: (at: Date) => string;
  /** The server day of an instant, "2026-11-15". */
  day: (at: Date) => string;
}

function counts(
  g: { week: number; total: number; lastAt: Date | null },
  t: TheftWords,
  f: TheftFormats,
) {
  return [
    fill(t["thefts.week"], { n: g.week }),
    fill(t["thefts.total"], { n: g.total }),
    ...(g.lastAt ? [fill(t["thefts.last"], { when: f.when(g.lastAt) })] : []),
  ].join(" · ");
}

function attackerCard(a: AttackerGroup, t: TheftWords, f: TheftFormats): AttackerCard {
  const last = a.followUp.last;
  const server = (at: Date) => fill(t["time.server"], { time: f.when(at) });
  return {
    key: a.key,
    name: a.tag ? `[${a.tag}] ${a.name}` : a.name,
    counts: counts(a, t, f),
    state: a.followUp.state,
    changed: last
      ? fill(t["thefts.changed"], {
          name: last.by ?? t["thefts.someone"],
          when: server(last.changedAt),
        })
      : null,
    lastNote: last?.note ?? null,
    reopened:
      a.followUp.reopened && last
        ? fill(t["thefts.reopened"], { state: t[`thefts.state.${last.state}`] })
        : null,
    victims: a.victims,
    entries: a.entries.map((e) => ({
      id: e.id,
      server: e.at ? server(e.at) : t["thefts.noTime"],
      at: e.at?.getTime() ?? null,
      day: e.at ? f.day(e.at) : null,
      victim: e.victimName ? fill(t["thefts.from"], { name: e.victimName }) : t["thefts.noVictim"],
      stolen:
        t[e.stolen === "quest_rewards" ? "thefts.stolen.quest_rewards" : "thefts.stolen.none"],
      source: e.source,
      note: e.note,
    })),
  };
}

export function theftCards(
  groups: AllianceGroup[],
  t: TheftWords,
  f: TheftFormats,
): AllianceCard[] {
  return groups.map((g) => ({
    tag: g.tag ? `[${g.tag}]` : t["thefts.noTag"],
    counts: counts(g, t, f),
    attackers: g.attackers.map((a) => attackerCard(a, t, f)),
  }));
}
