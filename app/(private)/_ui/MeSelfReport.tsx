"use client";

// "Tell your officers" on a member's own page (D154): their Alliance Duel tech, time zone and languages,
// filled with what they sent before (never the officers' values), and Send. Only the fields that changed are
// sent, each with the version the page showed; an emptied field takes back what was sent. Under each field,
// when it was sent and whether an officer has seen it, never whether it was used. One request id per send
// (D100), kept for a retry after a failure. Every control is 44 px or more; never in replay (ph-no-capture).
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import type { SelfReportWords } from "@/lib/private/dictionary.self-report";
import { LANGUAGES } from "@/lib/private/fact-fields";
import type { OwnReport, OwnReports } from "@/lib/private/self-report";
import { fill, plural } from "@/lib/words";

import { percentOf, type EditorWords } from "./facts-form";
import { SuffixInput } from "./SuffixInput";
import { TimeZonePicker } from "./TimeZonePicker";

type Field = "adTech" | "timeZone" | "languages";
interface Form {
  adTech: string;
  timeZone: string;
  languages: string[];
}
type Line = { text: string; alert: boolean } | null;

const FIELDS = ["adTech", "timeZone", "languages"] as const;

const formOf = (r: OwnReports, language: string): Form => ({
  adTech:
    typeof r.adTech?.value === "number"
      ? new Intl.NumberFormat(language, { maximumFractionDigits: 1, useGrouping: false }).format(
          r.adTech.value,
        )
      : "",
  timeZone: typeof r.timeZone?.value === "string" ? r.timeZone.value : "",
  languages: Array.isArray(r.languages?.value) ? (r.languages.value as string[]) : [],
});

/** What a field's form value sends: null takes it back. */
function valueOf(form: Form, field: Field): unknown {
  if (field === "adTech") return percentOf(form.adTech);
  if (field === "timeZone") return form.timeZone === "" ? null : form.timeZone;
  return form.languages.length === 0 ? null : LANGUAGES.filter((l) => form.languages.includes(l));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const noSubscribe = () => () => {};
const phoneZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

interface Props {
  slug: string;
  language: string;
  serverZone: string;
  reports: OwnReports;
  words: SelfReportWords;
  editor: EditorWords;
  /** "Tue, Nov 18" for a sent instant, in the member's language and server time. */
  days: Record<Field, string | null>;
}

/** The form's state and its Send: the changed fields, the answer's line, a new request id after a save. */
function useSend(props: Props) {
  const { words: w, language } = props;
  const router = useRouter();
  const [reports, setReports] = useState(props.reports);
  const [form, setForm] = useState(() => formOf(props.reports, language));
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<Line>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const sent = formOf(reports, language);
  const changes = FIELDS.filter((f) => !same(valueOf(form, f), valueOf(sent, f))).map((f) => ({
    field: f,
    version: reports.versions[f],
    value: valueOf(form, f),
  }));
  const saved = (next: OwnReports, conflict: boolean) => {
    setReports(next);
    setForm(formOf(next, language));
    setRequestId(crypto.randomUUID());
    if (conflict) return setLine({ text: w["self.changed"], alert: true });
    track("ws_self_report_sent", {
      change: changes.every((c) => c.value === null) ? "remove" : "save",
    });
    // The sent days are written on the server: the page is read again for them.
    router.refresh();
    setLine({ text: w["self.sent"], alert: false });
  };
  const send = async () => {
    if (changes.length === 0) return setLine({ text: w["self.nothing"], alert: false });
    setBusy(true);
    const res = await fetch(`/api/w/${props.slug}/me/facts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, changes }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { reports?: OwnReports } | null;
    setBusy(false);
    if (res && body?.reports) return saved(body.reports, res.status === 409);
    // The link is no longer approved, or they left: the page says why once it is read again.
    if (res?.status === 403 || res?.status === 409) return router.refresh();
    setLine({ text: w[res?.status === 429 ? "self.tooMany" : "self.failed"], alert: true });
  };
  return { reports, form, setForm, busy, line, send, changes: changes.length };
}

export function MeSelfReport(props: Props) {
  const { words: w } = props;
  const { reports, form, setForm, busy, line, send, changes } = useSend(props);
  const adBad = percentOf(form.adTech) === undefined;
  const state = (field: Field) => (
    <FieldState report={reports[field]} day={props.days[field]} w={w} />
  );
  return (
    <section
      aria-labelledby="me-self"
      className="ph-no-capture drawn-card mt-4 px-4 py-4 first:mt-0"
    >
      <h2 id="me-self" className="font-subhead text-display-sm">
        {w["self.head"]}
      </h2>
      <p className="mt-1 text-body-sm">{w["self.lead"]}</p>
      <p className="mt-1 text-body-sm text-ink/75">{w["self.empty"]}</p>
      <p className="mt-1 text-body-sm text-ink/75">{w["self.takeBack"]}</p>
      <Row id="self-adTech" label={w["self.adTech"]} state={state("adTech")}>
        <SuffixInput
          aria-labelledby="self-adTech"
          inputMode="decimal"
          value={form.adTech}
          suffix="%"
          aria-invalid={adBad || undefined}
          onChange={(e) => setForm({ ...form, adTech: e.target.value.replace(/[^\d.,]/g, "") })}
          className="max-w-28"
        />
        {adBad && <p className="mt-1 text-body-sm text-seal">{w["self.adBad"]}</p>}
      </Row>
      <Row id="self-timeZone" label={w["self.timeZone"]} state={state("timeZone")}>
        <Zone
          {...props}
          value={form.timeZone}
          onChange={(timeZone) => setForm({ ...form, timeZone })}
        />
      </Row>
      <Row id="self-languages" label={w["self.languages"]} state={state("languages")}>
        <Languages
          language={props.language}
          value={form.languages}
          onChange={(languages) => setForm({ ...form, languages })}
        />
      </Row>
      <SendBar
        w={w}
        language={props.language}
        changes={changes}
        busy={busy}
        off={adBad}
        line={line}
        onSend={() => void send()}
      />
    </section>
  );
}

/**
 * Send, kept at the bottom of the screen while the form is on it, with "Not sent yet: 1 change" once
 * something changed: a picked zone looks finished, and Send sits below the languages (first-glance test).
 */
function SendBar(props: {
  w: SelfReportWords;
  language: string;
  changes: number;
  busy: boolean;
  off: boolean;
  line: Line;
  onSend: () => void;
}) {
  const { w, changes, line } = props;
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-3 border-t border-rule bg-paper px-4 py-3">
      {changes > 0 && !props.busy && (
        <p className="mb-2 text-body-sm font-semibold text-yarn">
          {fill(w["self.notSent"], {
            n: fill(
              plural(
                changes,
                { one: w["self.notSent.one"], other: w["self.notSent.other"] },
                props.language,
              ),
              { n: changes },
            ),
          })}
        </p>
      )}
      <button
        type="button"
        disabled={props.busy || props.off}
        onClick={props.onSend}
        className={buttonClass("primary")}
      >
        {props.busy ? w["self.sending"] : w["self.send"]}
      </button>
      {line && (
        <p
          role={line.alert ? "alert" : "status"}
          className={`mt-2 text-body-sm ${line.alert ? "font-semibold text-seal" : ""}`}
        >
          {line.text}
        </p>
      )}
    </div>
  );
}

function Row(props: { id: string; label: string; state: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-3 border-t border-rule py-3">
      <span id={props.id} className="mb-1 block font-semibold">
        {props.label}
      </span>
      {props.children}
      {props.state}
    </div>
  );
}

/** The time-zone picker, "Use this phone's time zone (Lisbon)" and Clear. */
function Zone(props: Props & { value: string; onChange: (zone: string) => void }) {
  const { words: w, value, onChange } = props;
  const zone = useSyncExternalStore(noSubscribe, phoneZone, () => "");
  const city = zone.split("/").at(-1)?.replaceAll("_", " ") ?? zone;
  return (
    <>
      <TimeZonePicker
        value={value}
        onChange={onChange}
        words={props.editor}
        language={props.language}
        serverZone={props.serverZone}
        used={[]}
        labelledBy="self-timeZone"
      />
      <p className="mt-2 flex flex-wrap gap-2">
        {zone && zone !== value && (
          <button type="button" onClick={() => onChange(zone)} className={chip()}>
            {fill(w["self.phoneZone"], { zone: city })}
          </button>
        )}
        {value && (
          <button type="button" onClick={() => onChange("")} className={chip()}>
            {w["self.clearZone"]}
          </button>
        )}
      </p>
    </>
  );
}

/** Each language in its own words and the reader's ("Português (Portuguese)"), so a reader finds theirs. */
function Languages(props: { language: string; value: string[]; onChange: (v: string[]) => void }) {
  const { value, onChange } = props;
  const names = useMemo(
    () => new Intl.DisplayNames([props.language], { type: "language" }),
    [props.language],
  );
  return (
    <ul aria-labelledby="self-languages" className="flex flex-wrap gap-2">
      {LANGUAGES.map((code) => {
        const on = value.includes(code);
        const name = new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
        // "português" as a label reads "Português", as a list of choices does.
        const own = name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
        const shown = names.of(code) ?? code;
        return (
          <li key={code}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((l) => l !== code) : [...value, code])}
              className={chip(on)}
            >
              {own.toLowerCase() === shown.toLowerCase() ? shown : `${own} (${shown})`}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FieldState(props: { report: OwnReport | null; day: string | null; w: SelfReportWords }) {
  const { report, day, w } = props;
  if (!report || !day) return null;
  const took = report.value === null;
  const key = took
    ? report.seen
      ? "self.state.tookSeen"
      : "self.state.took"
    : report.seen
      ? "self.state.seen"
      : "self.state.sent";
  return <p className="mt-1 text-body-sm text-ink/75">{fill(w[key], { day })}</p>;
}
