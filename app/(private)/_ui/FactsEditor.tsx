"use client";

// A member's facts, edited (issue 297, D80): a sheet over the card with "Paste what they told you" on top
// and the eight fields below. What the paste finds only fills the fields, marked "from a message"; it is
// saved when the officer taps Save, like anything typed. A save sends only the fields that changed, each
// with the version it started from. When another officer saved a field meanwhile, notes and languages are
// combined by the server; any other field shows the newer value with "Keep theirs" and "Use mine".
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import type { Fact, FactField, MemberFacts } from "@/lib/private/fact-fields";
import { mightIn, parseOnboarding } from "@/lib/private/onboarding-parse";

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

export interface EditorProps {
  slug: string;
  uid: number;
  name: string;
  facts: MemberFacts;
  /** "paste" opens with the paste box ready. */
  mode: "edit" | "paste";
  words: EditorWords;
  language: string;
  serverZone: string;
  used: readonly string[];
  onClose: () => void;
}

interface Result extends Fact {
  field: FactField;
  status: "saved" | "merged" | "conflict";
}

function Paste(props: { words: EditorWords; open: boolean; onRead: (text: string) => boolean }) {
  const [text, setText] = useState("");
  const [nothing, setNothing] = useState(false);
  const { words } = props;
  return (
    <details open={props.open} className="border border-rule px-3 py-2">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-plum">
        {words["facts.paste"]}
      </summary>
      <p className="text-body-sm text-ink/80">{words["paste.help"]}</p>
      <textarea
        {...(props.open && { "data-initial-focus": true })}
        aria-label={words["facts.paste"]}
        value={text}
        rows={4}
        maxLength={4000}
        onChange={(e) => setText(e.target.value)}
        className="mt-2 w-full border border-rule bg-paper px-3 py-2"
      />
      <button
        type="button"
        onClick={() => setNothing(!props.onRead(text))}
        className={buttonClass("secondary", "mt-2")}
      >
        {words["paste.read"]}
      </button>
      {nothing && <p className="mt-2 text-body-sm">{words["paste.nothing"]}</p>}
    </details>
  );
}

/** Another officer's newer value, as plain words. */
function shown(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return Object.values(value).filter(Boolean).join(" · ");
  return String(value);
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
    return filled.length > 0;
  };
  return { stored, setStored, form, setForm, fromMessage, zones, edit, read };
}

/** Save: the changed fields, each with its version. A 409 leaves the newer values to settle one by one. */
function useSave(props: EditorProps, f: ReturnType<typeof useForm>) {
  const router = useRouter();
  const [invalid, setInvalid] = useState<FactField[]>([]);
  const [conflicts, setConflicts] = useState<Result[]>([]);
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
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
    if (wrong.length > 0) return;
    if (changes.length === 0) return close();
    setState("saving");
    const res = await fetch(`/api/w/${props.slug}/members/${props.uid}/facts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changes }),
    }).catch(() => null);
    if (!res || (res.status !== 200 && res.status !== 409)) return setState("failed");
    const { results } = (await res.json()) as { results: Result[] };
    const kept = results.filter((r) => r.status !== "conflict");
    f.setStored((s) => ({
      ...s,
      ...Object.fromEntries(kept.map(({ field, status: _, ...fact }) => [field, fact])),
    }));
    setSavedAny(savedAny || kept.length > 0);
    track("ws_facts_saved");
    if (res.status === 200) {
      router.refresh();
      return props.onClose();
    }
    setConflicts(results.filter((r) => r.status === "conflict"));
    setState("idle");
  };
  return { invalid, conflicts, state, close, settle, save };
}

function Conflict(props: { c: Result; words: EditorWords; onSettle: (theirs: boolean) => void }) {
  const { c, words } = props;
  return (
    <div role="alert" className="mt-2 border border-yarn px-3 py-2 text-body-sm">
      <p>{say(words["facts.conflict"], { value: shown(c.value) })}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => props.onSettle(true)}
          className={buttonClass("secondary")}
        >
          {words["facts.theirs"]}
        </button>
        <button
          type="button"
          onClick={() => props.onSettle(false)}
          className={buttonClass("secondary")}
        >
          {words["facts.mine"]}
        </button>
      </div>
    </div>
  );
}

export function FactsEditor(props: EditorProps) {
  const { words } = props;
  const f = useForm(props);
  const s = useSave(props, f);
  const conflictOf = (field: FactField) => {
    const c = s.conflicts.find((x) => x.field === field);
    return c ? <Conflict c={c} words={words} onSettle={(theirs) => s.settle(c, theirs)} /> : null;
  };
  return (
    <Sheet labelledBy="facts-title" onCancel={s.close}>
      <h2 id="facts-title" className="font-display text-display-md" translate="no">
        {say(words["facts.title"], { name: props.name })}
      </h2>
      <div className="mt-3">
        <Paste words={words} open={props.mode === "paste"} onRead={f.read} />
      </div>
      <FactFields
        form={f.form}
        edit={f.edit}
        stored={f.stored}
        fromMessage={f.fromMessage}
        invalid={s.invalid}
        zones={f.zones}
        words={words}
        language={props.language}
        serverZone={props.serverZone}
        used={props.used}
        conflictOf={conflictOf}
      />
      {s.state === "failed" && (
        <p role="alert" className="mt-2 text-burgundy">
          {words["facts.failed"]}
        </p>
      )}
      <div className="sticky bottom-0 mt-3 flex gap-3 border-t border-rule bg-paper pt-3">
        <button type="button" onClick={s.close} className={buttonClass("secondary", "flex-1")}>
          {words["facts.cancel"]}
        </button>
        <button
          type="button"
          {...(props.mode === "edit" && { "data-initial-focus": true })}
          disabled={s.state === "saving" || s.conflicts.length > 0}
          onClick={() => void s.save()}
          className={buttonClass("primary", "flex-1")}
        >
          {words["facts.save"]}
        </button>
      </div>
    </Sheet>
  );
}
