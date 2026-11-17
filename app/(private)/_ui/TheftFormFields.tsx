"use client";

// The two "who" fields of "Add a theft" (issue 321): the attacker, found by the route among the players of
// the server's other tracked alliances (or taken as typed, with an optional tag), and the member it was
// taken from, found in the alliance's roster by the name matcher (D74) and the roster search. Each pick is
// a 44 px button; a chosen one shows with "Change".
import { useEffect, useMemo, useState } from "react";

import { chip, FIELD } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import { searchRoster } from "@/lib/private/roster-search";
import type { AttackerOption } from "@/lib/private/thefts";
import { matchName } from "@/lib/screenshot/match-name";

import type { TheftWords } from "./theft-data";

export type Member = { uid: number; name: string };
export type Attacker = AttackerOption | { typed: string; tag: string };

const PICK = `${chip()} flex w-full text-left text-body`;
const INPUT = `${FIELD} mt-1`;

/** The matcher's one match or suggestions first, then the roster search; at most six. */
function memberCandidates(query: string, roster: readonly Member[]): Member[] {
  const match = matchName(
    query,
    roster.map((m) => ({ uid: m.uid, names: [m.name] })),
  );
  const matched =
    match.status === "matched"
      ? [match.uid]
      : match.status === "unsure"
        ? match.suggestions.map((s) => s.uid)
        : [];
  const uids = [...new Set([...matched, ...searchRoster(query, roster).map((m) => m.uid)])];
  return uids.flatMap((uid) => roster.filter((m) => m.uid === uid)).slice(0, 6);
}

/** Players found by the route for `query`, searched a moment after the officer stops typing. */
function usePlayerSearch(slug: string, query: string): AttackerOption[] | "searching" | null {
  const [hits, setHits] = useState<AttackerOption[] | "searching" | null>(null);
  useEffect(() => {
    const q = query.trim();
    setHits(q === "" ? null : "searching");
    if (q === "") return;
    const stop = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/w/${slug}/thefts?q=${encodeURIComponent(q)}`, { signal: stop.signal })
        .then((r) =>
          r.ok ? (r.json() as Promise<{ players: AttackerOption[] }>) : { players: [] },
        )
        .then((d) => setHits(d.players))
        // A newer keystroke aborted this search; any other failure shows as no result.
        .catch((e: unknown) => {
          if (!(e instanceof DOMException && e.name === "AbortError")) setHits([]);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      stop.abort();
    };
  }, [slug, query]);
  return hits;
}

function Chosen({ label, t, onChange }: { label: string; t: TheftWords; onChange: () => void }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2 border border-plum px-3">
      <span translate="no" className="min-w-0 truncate py-2 font-semibold">
        {label}
      </span>
      <button
        type="button"
        onClick={onChange}
        className="min-h-11 shrink-0 font-semibold text-plum underline underline-offset-4"
      >
        {t["thefts.form.change"]}
      </button>
    </div>
  );
}

function Status({ text }: { text: string }) {
  return (
    <p role="status" className="mt-1 text-body-sm">
      {text}
    </p>
  );
}

type AttackerProps = {
  slug: string;
  t: TheftWords;
  value: Attacker | null;
  onChange: (a: Attacker | null) => void;
};

/** An attacker taken as typed: the name, and their alliance tag if the officer knows it. */
function TypedAttacker({
  t,
  value,
  onChange,
}: AttackerProps & { value: Attacker & { typed: string } }) {
  return (
    <>
      <Chosen label={value.typed} t={t} onChange={() => onChange(null)} />
      <label htmlFor="theft-tag" className="mt-2 block text-body-sm font-semibold">
        {t["thefts.form.tag"]}
      </label>
      <input
        id="theft-tag"
        value={value.tag}
        maxLength={8}
        autoComplete="off"
        onChange={(e) => onChange({ ...value, tag: e.target.value.replace(/[[\]\s]/g, "") })}
        className="drawn-field mt-1 min-h-11 w-28 px-3"
      />
    </>
  );
}

/**
 * Saving the name as typed: offered at once when the search found no one, else behind "Not in the
 * list?", so a listed player is picked rather than typed (a typed name is a separate attacker).
 */
function TypedOption(props: {
  t: TheftWords;
  typed: string;
  found: number;
  onChange: (a: Attacker) => void;
}) {
  const { t, typed, found, onChange } = props;
  const [asked, setAsked] = useState(false);
  if (found > 0 && !asked)
    return (
      <button
        type="button"
        onClick={() => setAsked(true)}
        className="mt-1 inline-flex min-h-11 items-center text-body-sm font-semibold text-plum underline underline-offset-4"
      >
        {t["thefts.form.notListed"]}
      </button>
    );
  return (
    <button
      type="button"
      onClick={() => onChange({ typed, tag: "" })}
      className={`${PICK} mt-1 text-plum underline underline-offset-4`}
    >
      {fill(t["thefts.form.asTyped"], { name: typed })}
    </button>
  );
}

function PlayerSearch({ slug, t, onChange }: AttackerProps) {
  const [query, setQuery] = useState("");
  const hits = usePlayerSearch(slug, query);
  const typed = query.trim();
  return (
    <>
      <p id="theft-attacker-help" className="text-body-sm text-ink/70">
        {t["thefts.form.attackerHelp"]}
      </p>
      <input
        id="theft-attacker"
        type="search"
        value={query}
        maxLength={64}
        autoComplete="off"
        aria-describedby="theft-attacker-help"
        onChange={(e) => setQuery(e.target.value)}
        className={INPUT}
      />
      {hits === "searching" && <Status text={t["thefts.form.searching"]} />}
      {Array.isArray(hits) && hits.length === 0 && <Status text={t["thefts.form.noHit"]} />}
      <ul className="mt-1 grid gap-1">
        {Array.isArray(hits) &&
          hits.map((p) => (
            <li key={p.uid}>
              <button type="button" onClick={() => onChange(p)} className={PICK}>
                <span translate="no">
                  [{p.tag}] {p.name}
                </span>
              </button>
            </li>
          ))}
      </ul>
      {typed !== "" && Array.isArray(hits) && (
        <TypedOption key={typed} t={t} typed={typed} found={hits.length} onChange={onChange} />
      )}
    </>
  );
}

export function AttackerField(props: AttackerProps) {
  const { t, value, onChange } = props;
  if (value && "typed" in value) return <TypedAttacker {...props} value={value} />;
  if (value)
    return <Chosen label={`[${value.tag}] ${value.name}`} t={t} onChange={() => onChange(null)} />;
  return <PlayerSearch {...props} />;
}

export function VictimField(props: {
  t: TheftWords;
  roster: readonly Member[];
  value: Member | null;
  onChange: (m: Member | null) => void;
}) {
  const { t, roster, value, onChange } = props;
  const [query, setQuery] = useState("");
  const found = useMemo(() => memberCandidates(query, roster), [query, roster]);
  if (value) return <Chosen label={value.name} t={t} onChange={() => onChange(null)} />;
  return (
    <>
      <input
        id="theft-victim"
        type="search"
        value={query}
        maxLength={64}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        className={INPUT}
      />
      {query.trim() !== "" && found.length === 0 && <Status text={t["thefts.form.noMember"]} />}
      <ul className="mt-1 grid gap-1">
        {found.map((m) => (
          <li key={m.uid}>
            <button type="button" onClick={() => onChange(m)} className={PICK}>
              <span translate="no">{m.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
