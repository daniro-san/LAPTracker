// The thefts log's words per card (issue 321), made on the server in the officer's language: server times,
// counts and labels. The client list (TheftCards.tsx) only lays them out, and adds the viewer's own clock
// after hydration, so server and browser HTML never differ.
import { SERVER } from "@/config/alliances";
import { fill, isolate } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import type { AllianceGroup, AttackerGroup, FollowUpState } from "@/lib/private/theft-groups";
import type { WarningLanguage } from "@/lib/private/theft-warning";
import type { Contact } from "@/lib/private/thefts";

type TheftKey = Extract<WorkspaceKey, `thefts.${string}` | `sheet.${string}`>;
export type TheftWords = Record<TheftKey | "time.server" | "src.photo", string>;

/** The words the client components need: the thefts keys, the sheet frame's and two shared ones. */
export function theftWords(t: WorkspaceDictionary): TheftWords {
  const keys = Object.keys(t).filter(
    (k) =>
      k.startsWith("thefts.") || k.startsWith("sheet.") || ["time.server", "src.photo"].includes(k),
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
  /** "Ops"; "—" on rows saved before the type was asked (D75). */
  kind: string;
  source: "photo" | "typed";
  /** "Taken: 1.2M food, 300K wood"; null when not given. */
  items: string | null;
  note: string | null;
}

export interface AttackerCard {
  key: string;
  /** "[VNC] •St•BugaBoo". */
  name: string;
  counts: string;
  state: FollowUpState;
  /** The state's label, or "Open again" when a later theft opened it. */
  badge: string;
  /** "Set by Ana, Sun 15 Nov 14:02 server time"; null before any officer set one, or when reopened. */
  changed: string | null;
  lastNote: string | null;
  /** "Ana marked this “Resolved” on Fri, Nov 13. A new theft came after that, so it is open again." */
  reopened: string | null;
  /** The changes before the newest, newest first: "Talked to their leaders · Set by Ana, …". */
  earlier: { text: string; note: string | null }[];
  victims: { uid: number; name: string; count: number }[];
  /** "Our server · #<n>", "Server #<n>" or "Server not known"; `same` when it is our server. */
  server: { text: string; same: boolean; value: number | null };
  /** The warning to paste, per language; null unless the attacker is on our server. */
  warnings: Record<WarningLanguage, string> | null;
  entries: EntryCard[];
}

export interface AllianceCard {
  tag: string;
  counts: string;
  /** Whom to contact: the leader line and the alliance's public page; null when not one we track. */
  contact: { line: string; href: string; link: string } | null;
  attackers: AttackerCard[];
}

export interface TheftFormats {
  /** "Sun 15 Nov 13:46" in server time. */
  when: (at: Date) => string;
  /** "Sun 15 Nov" in server time. */
  date: (at: Date) => string;
  /** The server day of an instant, "2026-11-15". */
  day: (at: Date) => string;
}

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

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

function serverOf(server: number | null, t: TheftWords): AttackerCard["server"] {
  const same = server === SERVER;
  const text =
    server === null
      ? t["thefts.server.unknown"]
      : fill(t[same ? "thefts.server.same" : "thefts.server.other"], { server });
  return { text, same, value: server };
}

function contactOf(contact: Contact | null, t: TheftWords): AllianceCard["contact"] {
  if (!contact) return null;
  return {
    line: contact.leader
      ? fill(t["thefts.contact.leader"], { leader: isolate(contact.leader) })
      : t["thefts.contact.noLeader"],
    href: `/alliances/${contact.unionId}/history`,
    link: fill(t["thefts.contact.page"], { alliance: isolate(contact.name) }),
  };
}

/** The warning to paste for an attacker on our server, in each language (theft-warning.ts). */
export type WarningsOf = (a: AttackerGroup) => Record<WarningLanguage, string> | null;

function attackerCard(
  a: AttackerGroup,
  t: TheftWords,
  f: TheftFormats,
  warn: WarningsOf,
): AttackerCard {
  const { last, reopened, state, earlier } = a.followUp;
  const server = (at: Date) => fill(t["time.server"], { time: f.when(at) });
  const changed = (c: { by: string | null; changedAt: Date }) =>
    fill(t["thefts.changed"], {
      name: c.by ? isolate(c.by) : t["thefts.someone"],
      when: server(c.changedAt),
    });
  return {
    key: a.key,
    name: a.tag ? `[${a.tag}] ${isolate(a.name)}` : a.name,
    counts: counts(a, t, f),
    state,
    badge: reopened ? t["thefts.state.reopened"] : t[`thefts.state.${state}`],
    changed: last && !reopened ? changed(last) : null,
    lastNote: last?.note ?? null,
    reopened:
      reopened && last
        ? capitalised(
            fill(t["thefts.reopened"], {
              who: last.by ? isolate(last.by) : t["thefts.someone"],
              state: t[`thefts.state.${last.state}`],
              day: f.date(last.changedAt),
            }),
          )
        : null,
    earlier: earlier.map((c) => ({
      text: `${t[`thefts.state.${c.state}`]} · ${changed(c)}`,
      note: c.note,
    })),
    victims: a.victims,
    server: serverOf(a.server, t),
    warnings: warn(a),
    entries: a.entries.map((e) => ({
      id: e.id,
      server: e.at ? server(e.at) : t["thefts.noTime"],
      at: e.at?.getTime() ?? null,
      day: e.at ? f.day(e.at) : null,
      victim: e.victimName
        ? fill(t["thefts.from"], { name: isolate(e.victimName) })
        : t["thefts.noVictim"],
      kind: e.kind ? t[`thefts.kind.${e.kind}`] : "—",
      source: e.source,
      items: e.items ? fill(t["thefts.items"], { items: e.items }) : null,
      note: e.note,
    })),
  };
}

export function theftCards(
  groups: (AllianceGroup & { contact: Contact | null })[],
  t: TheftWords,
  f: TheftFormats,
  warn: WarningsOf,
): AllianceCard[] {
  return groups.map((g) => ({
    tag: g.tag ? `[${g.tag}]` : t["thefts.noTag"],
    counts: counts(g, t, f),
    contact: contactOf(g.contact, t),
    attackers: g.attackers.map((a) => attackerCard(a, t, f, warn)),
  }));
}
