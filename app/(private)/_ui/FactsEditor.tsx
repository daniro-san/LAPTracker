"use client";

// A member's facts, edited (issue 297, D80): a sheet over the card with "Paste what they told you" on top
// and the eight fields below. What the paste finds only fills the fields, marked "from this message · not
// saved"; it is saved when the officer taps Save, like anything typed. A save sends only the fields that
// changed, each with the version it started from. When another officer saved a field meanwhile, notes and
// languages are combined by the server (and the editor says so); any other field shows both values with
// "Keep <theirs>" and "Use <mine>". Closing with unsaved changes asks first.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { Sheet } from "@/lib/brand/components/Sheet";
import type { Fact, FactField, FactValues, MemberFacts } from "@/lib/private/fact-fields";
import { mightIn, parseOnboarding } from "@/lib/private/onboarding-parse";

import { dayFormat, factText, type FactTextFormat } from "./fact-text";
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
import { Conflict, Paste, SaveBar } from "./FactsEditorParts";

export interface EditorProps {
  slug: string;
  uid: number;
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

/** Save: the changed fields, each with its version. A 409 leaves the newer values to settle one by one. */
function useSave(props: EditorProps, f: ReturnType<typeof useForm>) {
  const router = useRouter();
  const [invalid, setInvalid] = useState<FactField[]>([]);
  const [conflicts, setConflicts] = useState<Result[]>([]);
  const [merged, setMerged] = useState<FactField[]>([]);
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
    setSavedAny(savedAny || kept.length > 0);
    track("ws_facts_saved");
    // Stay open after a merge or a conflict, so the officer sees what changed.
    if (res.status === 200 && combined.length === 0) {
      router.refresh();
      return props.onClose();
    }
    setConflicts(results.filter((r) => r.status === "conflict"));
    setState("idle");
  };
  return { invalid, conflicts, merged, state, close, settle, save };
}

export function FactsEditor(props: EditorProps) {
  const { words, language } = props;
  const f = useForm(props);
  const s = useSave(props, f);
  const values = valuesOf(f.form, mightIn);
  const pending = changesOf(values, f.stored, f.fromMessage);
  const dirty = pending.changes.length > 0 || pending.invalid.length > 0;
  const text: FactTextFormat = { language, now: new Date(), day: dayFormat(language), words };
  const conflictOf = (field: FactField) => {
    const c = s.conflicts.find((x) => x.field === field);
    if (!c) return null;
    const theirs = factText(field, c.value as FactValues[FactField] | null, text);
    const mine = factText(field, values[field] ?? null, text);
    return <Conflict mine={mine} theirs={theirs} words={words} onSettle={(t) => s.settle(c, t)} />;
  };
  // Escape asks first too: the sheet never drops typed values without a word.
  const [asking, setAsking] = useState(false);
  return (
    <Sheet labelledBy="facts-title" onCancel={() => (dirty ? setAsking(true) : s.close())}>
      <h2 id="facts-title" className="font-display text-display-md" translate="no">
        {say(words["facts.title"], { name: props.name })}
      </h2>
      <div className="mt-3">
        <Paste words={words} language={language} open={props.mode === "paste"} onRead={f.read} />
      </div>
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
      <SaveBar
        s={s}
        words={words}
        focusSave={props.mode === "edit"}
        dirty={dirty}
        asking={asking}
        setAsking={setAsking}
      />
    </Sheet>
  );
}
