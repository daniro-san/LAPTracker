"use client";

// A member's facts, edited (issue 297, D80): a sheet over the card with "Paste what they told you" on top
// and the eight fields below. What the paste finds only fills the fields, marked "from this message · not
// saved"; it is saved when the officer taps Save, like anything typed. A save sends only the fields that
// changed, each with the version it started from. When another officer saved a field meanwhile, notes and
// languages are combined by the server (and the editor says so); any other field shows both values with
// "Keep <theirs>" and "Use <mine>". Every way of closing with unsaved changes asks first (the sheet frame).
// Without a uid it is "Add a new member" (D106): a name field first, and Save makes the pending member.
// A name that is already a current member's asks first: "Open" them, or "Add anyway" (2026-11-17).
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { chip, FIELD } from "@/lib/brand/components/controls";
import { Sheet } from "@/lib/brand/components/Sheet";
import { isolate } from "@/lib/copy";
import type { Fact, FactField, FactValues, MemberFacts } from "@/lib/private/fact-fields";
import { dayFormat, factText, type FactTextFormat } from "@/lib/private/fact-text";
import { mightIn, parseOnboarding } from "@/lib/private/onboarding-parse";
import { sameName } from "@/lib/private/roster-search";
import { nameKey } from "@/lib/screenshot/name-key";

import { FactFields } from "./FactFields";
import {
  changesOf,
  formOf,
  inputsOf,
  propose,
  say,
  valuesOf,
  type EditorWords,
  type Form,
} from "./facts-form";
import { Conflict, Paste, SaveNote } from "./FactsEditorParts";
import { sheetWords } from "./sheet-words";
import { SIGNED_OUT, SignedOutNote } from "./SignedOut";

export interface EditorProps {
  slug: string;
  /** null: "Add a new member" (D106), with a name field; the first Save makes the pending member. */
  uid: number | null;
  name: string;
  facts: MemberFacts;
  /** The status shown when no officer sets one, for "Automatic (now: …)". */
  autoStatus: string;
  /** "paste" opens with the paste box ready. */
  mode: "edit" | "paste";
  words: EditorWords;
  language: string;
  serverZone: string;
  used: readonly string[];
  /** A new member's: the newest roster, to say when the name typed is already a member's. */
  members?: readonly { uid: number; name: string }[];
  onClose: () => void;
}

interface Result extends Fact {
  field: FactField;
  status: "saved" | "merged" | "conflict";
}

/** The form, what the paste proposed, and the values stored (each save updates them). */
function useForm(props: EditorProps) {
  const [stored, setStored] = useState<MemberFacts>(props.facts);
  const [form, setForm] = useState<Form>(() => formOf(props.facts, props.language));
  const [fromMessage, setFromMessage] = useState<ReadonlySet<FactField>>(new Set());
  const [zones, setZones] = useState<string[]>([]);
  const edit = (field: FactField, patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setFromMessage((s) => new Set([...s].filter((x) => x !== field)));
  };
  const read = (text: string) => {
    const found = parseOnboarding(text, new Date(), props.serverZone);
    const [next, filled] = propose(form, found, props.language);
    setForm(next);
    setFromMessage(new Set([...fromMessage, ...filled]));
    setZones(found.timeZones.slice(1, 4));
    return filled.length;
  };
  return { stored, setStored, form, setForm, fromMessage, zones, edit, read };
}

/**
 * Where a Save goes: the member's facts, or, for a new member, the add with its name and the sheet's
 * request id (D100). After the add, later saves go to the new member's facts.
 */
function useTarget(props: EditorProps) {
  const [uid, setUid] = useState(props.uid);
  const [name, setName] = useState(props.name);
  const [requestId] = useState(() => crypto.randomUUID());
  const [nameMissing, setNameMissing] = useState(false);
  /** False, and the name's error shown, when a new member has no name yet. */
  const named = () => {
    setNameMissing(uid === null && name.trim() === "");
    return uid !== null || name.trim() !== "";
  };
  /** The results with the HTTP status, or why there are none. */
  const send = async (
    changes: unknown[],
  ): Promise<{ status: number; results: Result[] } | "failed" | typeof SIGNED_OUT> => {
    const adding = uid === null;
    const res = await fetch(
      adding ? `/api/w/${props.slug}/pending` : `/api/w/${props.slug}/members/${uid}/facts`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          adding ? { action: "add", requestId, name: name.trim(), changes } : { changes },
        ),
      },
    ).catch(() => null);
    if (res?.status === 401) return SIGNED_OUT;
    if (!res || (res.status !== 200 && res.status !== 409)) return "failed";
    const body = (await res.json()) as { results: Result[]; uid?: number };
    if (adding && body.uid !== undefined) setUid(body.uid);
    return { status: res.status, results: body.results };
  };
  return { uid, name, setName, nameMissing, named, send };
}

/** Save: the changed fields, each with its version. A 409 leaves the newer values to settle one by one. */
function useSave(props: EditorProps, f: ReturnType<typeof useForm>) {
  const router = useRouter();
  const target = useTarget(props);
  const [invalid, setInvalid] = useState<FactField[]>([]);
  const [conflicts, setConflicts] = useState<Result[]>([]);
  const [merged, setMerged] = useState<FactField[]>([]);
  const [state, setState] = useState<"idle" | "saving" | "failed" | "signed_out">("idle");
  const [savedAny, setSavedAny] = useState(false);
  const close = () => {
    if (savedAny) router.refresh();
    props.onClose();
  };
  const settle = (c: Result, theirs: boolean) => {
    const next = {
      ...f.stored,
      [c.field]: { value: c.value, source: c.source, version: c.version },
    };
    f.setStored(next);
    if (theirs) f.setForm((form) => ({ ...form, ...inputsOf(c.field, next, props.language) }));
    setConflicts((all) => all.filter((x) => x.field !== c.field));
  };
  const save = async () => {
    const { changes, invalid: wrong } = changesOf(
      valuesOf(f.form, mightIn),
      f.stored,
      f.fromMessage,
    );
    setInvalid(wrong);
    const adding = target.uid === null;
    if (!target.named() || wrong.length > 0) return;
    if (changes.length === 0 && !adding) return close();
    setState("saving");
    const res = await target.send(changes);
    if (typeof res === "string") return setState(res);
    const results = res.results;
    const kept = results.filter((r) => r.status !== "conflict");
    const next: MemberFacts = {
      ...f.stored,
      ...Object.fromEntries(kept.map(({ field, status: _, ...fact }) => [field, fact])),
    };
    f.setStored(next);
    // A combined note or language list replaces what this officer typed, so a second Save keeps both.
    const combined = kept.filter((r) => r.status === "merged").map((r) => r.field);
    f.setForm((form) =>
      Object.assign({ ...form }, ...combined.map((x) => inputsOf(x, next, props.language))),
    );
    setMerged(combined);
    setSavedAny(savedAny || kept.length > 0 || adding);
    track("ws_facts_saved");
    // Stay open after a merge or a conflict, so the officer sees what changed.
    if (res.status === 200 && combined.length === 0) {
      router.refresh();
      return props.onClose();
    }
    setConflicts(results.filter((r) => r.status === "conflict"));
    setState("idle");
  };
  return { invalid, conflicts, merged, state, close, settle, save, target };
}

/** "Add a new member": their name in the game, required (D106), and the members who already have it. */
function NameField(props: {
  s: ReturnType<typeof useSave>;
  words: EditorProps["words"];
  slug: string;
  taken: readonly { name: string }[];
  onAnyway: () => void;
}) {
  const { target } = props.s;
  const { words } = props;
  const first = props.taken[0];
  return (
    <div className="mb-3">
      <p className="text-body-sm text-ink/80">{words["pending.addHelp"]}</p>
      <label htmlFor="pending-name" className="mt-2 block font-semibold">
        {words["pending.name"]}
      </label>
      <input
        id="pending-name"
        data-initial-focus
        value={target.name}
        maxLength={64}
        autoComplete="off"
        translate="no"
        aria-invalid={target.nameMissing || undefined}
        aria-describedby={
          target.nameMissing ? "pending-name-e" : first ? "pending-taken" : undefined
        }
        onChange={(e) => target.setName(e.target.value)}
        className={`${FIELD} mt-1`}
      />
      {target.nameMissing && (
        <p id="pending-name-e" className="mt-1 font-semibold text-seal">
          {words["pending.nameMissing"]}
        </p>
      )}
      {first && (
        <div id="pending-taken" role="status" className="mt-2 border-l-4 border-yarn pl-2">
          <p translate="no">{say(words["pending.taken"], { name: isolate(first.name) })}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <a
              href={`/w/${props.slug}/members?q=${encodeURIComponent(first.name)}`}
              translate="no"
              className={chip(true)}
            >
              {say(words["pending.open"], { name: isolate(first.name) })}
            </a>
            <button type="button" onClick={props.onAnyway} className={chip()}>
              {words["pending.addAnyway"]}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Above Save: why it is off while the name question waits, else the save's own note. */
function Note(props: {
  s: ReturnType<typeof useSave>;
  words: EditorProps["words"];
  asking: boolean;
}) {
  if (props.asking) return <p className="mb-2 text-body-sm">{props.words["pending.takenWhy"]}</p>;
  return <SaveNote s={props.s} words={props.words} />;
}

/** The members who already have the new member's name, until "Add anyway" for that name key. */
function useTaken(name: string, members: NonNullable<EditorProps["members"]>) {
  const [anyway, setAnyway] = useState<string | null>(null);
  const key = nameKey(name);
  return { members: key === anyway ? [] : sameName(name, members), anyway: () => setAnyway(key) };
}

export function FactsEditor(props: EditorProps) {
  const { words, language } = props;
  const f = useForm(props);
  const s = useSave(props, f);
  const values = valuesOf(f.form, mightIn);
  const pending = changesOf(values, f.stored, f.fromMessage);
  const adding = props.uid === null;
  const named = adding && s.target.name.trim() !== "";
  // Only the add sheet is given the roster.
  const taken = useTaken(s.target.name, props.members ?? []);
  const dirty = pending.changes.length > 0 || pending.invalid.length > 0 || named;
  const text: FactTextFormat = { language, now: new Date(), day: dayFormat(language), words };
  const conflictOf = (field: FactField) => {
    const c = s.conflicts.find((x) => x.field === field);
    if (!c) return null;
    const theirs = factText(field, c.value as FactValues[FactField] | null, text);
    const mine = factText(field, values[field] ?? null, text);
    return <Conflict mine={mine} theirs={theirs} words={words} onSettle={(t) => s.settle(c, t)} />;
  };
  return (
    <Sheet
      labelledBy="facts-title"
      onCancel={s.close}
      dirty={dirty}
      title={
        adding ? (
          words["pending.add"]
        ) : (
          <span translate="no">{say(words["facts.title"], { name: isolate(props.name) })}</span>
        )
      }
      words={sheetWords(words)}
      primary={{
        label: words["facts.save"],
        onClick: () => void s.save(),
        disabled: s.state === "saving" || s.conflicts.length > 0 || taken.members.length > 0,
        focus: props.mode === "edit" && !adding,
      }}
      note={<Note s={s} words={words} asking={taken.members.length > 0} />}
    >
      {adding && (
        <NameField
          s={s}
          words={words}
          slug={props.slug}
          taken={taken.members}
          onAnyway={taken.anyway}
        />
      )}
      <Paste
        slug={props.slug}
        words={words}
        language={language}
        open={props.mode === "paste"}
        onRead={f.read}
      />
      <FactFields
        form={f.form}
        edit={f.edit}
        stored={f.stored}
        fromMessage={f.fromMessage}
        invalid={s.invalid}
        zones={f.zones}
        words={words}
        language={language}
        serverZone={props.serverZone}
        used={props.used}
        autoStatus={props.autoStatus}
        conflictOf={conflictOf}
      />
      {s.state === "failed" && (
        <p role="alert" className="mt-2 text-seal">
          {words["facts.failed"]}
        </p>
      )}
      {s.state === SIGNED_OUT && <SignedOutNote className="mt-2" />}
    </Sheet>
  );
}
