"use client";

// /admin's "Sign out users" (D105, amended 2026-11-17): a sheet that picks whose sessions end in one
// workspace (everyone, officers only, members only, or one person with an open session), then says exactly
// what will happen, with the count, before the card sends it behind the PIN. Names stay isolated (<bdi>).
import { useEffect, useRef, useState } from "react";

import { FIELD } from "@/lib/brand/components/controls";
import { RadioField } from "@/lib/brand/components/RadioField";
import { Sheet } from "@/lib/brand/components/Sheet";
import { copy, fill, isolate } from "@/lib/copy";

const s = copy.admin.workspaces.signOutUsers;
/** Above this many people, the list gets a search field. */
const SEARCH_FROM = 8;

export interface SignOutPerson {
  id: number;
  name: string;
  tier: "officer" | "member";
  /** "last seen 3 hours ago" */
  seen: string;
}

export type SignOutChoice =
  { scope: "all" | "officers" | "members" } | { scope: "user"; userId: number };

type Scope = SignOutChoice["scope"];

function counts(people: SignOutPerson[]) {
  const officers = people.filter((p) => p.tier === "officer").length;
  return { all: people.length, officers, members: people.length - officers };
}

/** The confirm step's question and what it means, from the choice and the counts. */
function question(slug: string, choice: SignOutChoice, people: SignOutPerson[]): string[] {
  if (choice.scope === "user") {
    const p = people.find((x) => x.id === choice.userId);
    return [
      fill(s.confirmOne, { name: isolate(p?.name ?? ""), tier: s[p?.tier ?? "member"] }),
      s.sessionsOnly,
    ];
  }
  const n = counts(people)[choice.scope];
  const ask = {
    all: n === 1 ? s.onePerson : s.confirmAll,
    officers: n === 1 ? s.oneOfficer : s.confirmOfficers,
    members: n === 1 ? s.oneMember : s.confirmMembers,
  }[choice.scope];
  const lines = [fill(ask, { slug, n }), s.sessionsOnly];
  return choice.scope === "members" ? lines : [...lines, fill(s.pinStays, { slug })];
}

function PersonList(props: {
  people: SignOutPerson[];
  picked: number | null;
  onPick: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown =
    q === "" ? props.people : props.people.filter((p) => p.name.toLowerCase().includes(q));
  return (
    <div className="grid gap-2">
      {props.people.length > SEARCH_FROM && (
        <input
          type="search"
          aria-label={s.search}
          placeholder={s.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          className={`${FIELD} text-base`}
        />
      )}
      {shown.length === 0 && <p className="text-body-sm text-ink/70">{s.noMatch}</p>}
      {shown.map((p) => (
        <RadioField
          key={p.id}
          name="sign-out-person"
          checked={props.picked === p.id}
          onChange={() => props.onPick(p.id)}
          label={<bdi>{p.name}</bdi>}
          help={`${s[p.tier]} · ${p.seen}`}
        />
      ))}
    </div>
  );
}

function Pick(props: {
  slug: string;
  people: SignOutPerson[];
  scope: Scope | null;
  picked: number | null;
  onScope: (scope: Scope) => void;
  onPick: (id: number) => void;
}) {
  const n = counts(props.people);
  if (n.all === 0) return <p>{fill(s.nobody, { slug: props.slug })}</p>;
  const option = (scope: Scope, label: string, count: number) => (
    <RadioField
      name="sign-out-scope"
      checked={props.scope === scope}
      disabled={count === 0}
      onChange={() => props.onScope(scope)}
      label={label}
    />
  );
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 font-semibold">{s.who}</legend>
      {option("all", fill(s.everyone, { n: n.all }), n.all)}
      {option("officers", fill(s.officers, { n: n.officers }), n.officers)}
      {option("members", fill(s.members, { n: n.members }), n.members)}
      {option("user", s.one, n.all)}
      {props.scope === "user" && (
        <div className="mt-2 border-l-2 border-rule pl-3">
          <PersonList people={props.people} picked={props.picked} onPick={props.onPick} />
        </div>
      )}
    </fieldset>
  );
}

export function SignOutUsersSheet(props: {
  slug: string;
  people: SignOutPerson[];
  onCancel: () => void;
  onConfirm: (choice: SignOutChoice) => void;
}) {
  const [scope, setScope] = useState<Scope | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  // The step changes under the same button: the question takes the focus, so a second tap on "Next"
  // does not land on "Sign out".
  const asked = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirming) asked.current?.focus();
  }, [confirming]);
  const choice: SignOutChoice | null =
    scope === "user" ? (picked === null ? null : { scope, userId: picked }) : scope && { scope };
  return (
    <Sheet
      labelledBy="sign-out-users-title"
      title={fill(s.title, { slug: props.slug })}
      words={s.sheet}
      onCancel={props.onCancel}
      primary={
        confirming && choice
          ? { label: s.yes, onClick: () => props.onConfirm(choice) }
          : { label: s.next, disabled: choice === null, onClick: () => setConfirming(true) }
      }
      secondary={
        confirming
          ? { label: s.back, onClick: () => setConfirming(false) }
          : { label: s.sheet.cancel, onClick: props.onCancel }
      }
    >
      {confirming && choice ? (
        <div ref={asked} tabIndex={-1} className="grid gap-2 outline-none">
          {question(props.slug, choice, props.people).map((line, i) => (
            <p key={line} className={i === 0 ? "font-semibold" : "text-body-sm text-ink/80"}>
              {line}
            </p>
          ))}
        </div>
      ) : (
        <Pick
          slug={props.slug}
          people={props.people}
          scope={scope}
          picked={picked}
          onScope={setScope}
          onPick={setPicked}
        />
      )}
    </Sheet>
  );
}
