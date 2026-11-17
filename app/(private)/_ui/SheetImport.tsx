"use client";

// The one-time sheet import (issue 297, D80): paste a sheet or choose its CSV file, check how each row
// matches a member, answer the rows the matcher left open (a suggested member, someone else, or "not a
// member"), then import. Import stays off until every row is matched or dismissed. The sheet goes to the
// server only to be read; it is never stored.
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import type { ImportPreview, ImportResult, ImportRow } from "@/lib/private/sheet-import";

import { IMPORT_PROBLEM, say, type ImportWords } from "./facts-form";
import { Columns, Done, FillCount, Matched } from "./ImportParts";
import { SIGNED_OUT, SignedOutNote } from "./SignedOut";

/** A row's answer: a member, null for "not a member", undefined while open. */
type Answers = Map<number, number | null>;

const isOpen = (r: ImportRow) => r.match.status === "unsure" || r.match.status === "none";

async function post(slug: string, body: object): Promise<Response | null> {
  return fetch(`/api/w/${slug}/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

function OpenRow(props: {
  row: ImportRow;
  preview: ImportPreview;
  answer: number | null | undefined;
  onAnswer: (uid: number | null | undefined) => void;
  words: ImportWords;
}) {
  const { row, preview, answer, words } = props;
  const nameOf = (uid: number) => preview.members.find((m) => m.uid === uid)?.name ?? String(uid);
  const suggestions = row.match.status === "unsure" ? row.match.suggestions : [];
  return (
    <li className="border border-rule px-3 py-3">
      <p translate="no" className="font-semibold break-words">
        {row.name}
      </p>
      {row.role && (
        <p className="text-body-sm text-ink/75">{say(words["import.role"], { role: row.role })}</p>
      )}
      {row.unread.map((text) => (
        <p key={text} className="text-body-sm text-ink/75">
          {say(words["import.zone"], { text })}
        </p>
      ))}
      {answer !== undefined ? (
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span translate="no" className="font-semibold text-plum">
            {answer === null ? words["import.dismiss"] : `→ ${nameOf(answer)}`}
          </span>
          <button
            type="button"
            onClick={() => props.onAnswer(undefined)}
            className={buttonClass("secondary")}
          >
            {words["import.change"]}
          </button>
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {suggestions.length > 0 && <span className="text-body-sm">{words["import.isIt"]}</span>}
          {suggestions.map((uid) => (
            <button
              key={uid}
              type="button"
              translate="no"
              onClick={() => props.onAnswer(uid)}
              className={buttonClass("secondary")}
            >
              {nameOf(uid)}
            </button>
          ))}
          <select
            aria-label={words["import.someone"]}
            value=""
            onChange={(e) => props.onAnswer(Number(e.target.value))}
            className={`${FIELD} w-auto`}
          >
            <option value="">{words["import.choose"]}</option>
            {preview.members.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => props.onAnswer(null)}
            className={buttonClass("secondary")}
          >
            {words["import.dismiss"]}
          </button>
        </div>
      )}
    </li>
  );
}

function Review(props: {
  preview: ImportPreview;
  answers: Answers;
  setAnswers: (a: Answers) => void;
  words: ImportWords;
  onApply: () => void;
  busy: boolean;
  language: string;
}) {
  const { preview, answers, words, language } = props;
  const open = preview.rows.filter(isOpen);
  const left = open.filter((r) => !answers.has(r.line)).length;
  const matched = preview.rows.filter((r) => r.match.status === "matched");
  const dismissed = preview.rows.filter((r) => r.match.status === "dismissed").length;
  const none = open.filter((r) => r.match.status === "none" && !answers.has(r.line));
  const answer = (line: number, uid: number | null | undefined) => {
    const next = new Map(answers);
    if (uid === undefined) next.delete(line);
    else next.set(line, uid);
    props.setAnswers(next);
  };
  return (
    <section className="mt-4">
      <Columns preview={preview} words={words} language={language} />
      <p className="mt-2 font-semibold tabular-nums">
        {say(words["import.summary"], {
          rows: preview.rows.length,
          matched: matched.length,
          open: open.length,
          dismissed,
        })}
      </p>
      {none.length > 0 && (
        <button
          type="button"
          onClick={() =>
            props.setAnswers(new Map([...answers, ...none.map((r) => [r.line, null] as const)]))
          }
          className={buttonClass("secondary", "mt-3")}
        >
          {say(words["import.dismissAll"], { n: none.length })}
        </button>
      )}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {open.map((row) => (
          <OpenRow
            key={row.line}
            row={row}
            preview={preview}
            answer={answers.get(row.line)}
            onAnswer={(uid) => answer(row.line, uid)}
            words={words}
          />
        ))}
      </ul>
      <Matched preview={preview} rows={matched} words={words} />
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-paper py-3">
        <div>
          <FillCount preview={preview} answers={answers} words={words} language={language} />
          <p className="tabular-nums">{say(words["import.left"], { n: left })}</p>
        </div>
        <button
          type="button"
          disabled={left > 0 || props.busy}
          onClick={props.onApply}
          className={buttonClass("primary")}
        >
          {words["import.apply"]}
        </button>
      </div>
    </section>
  );
}

function SheetInput(props: { csv: string; onText: (text: string) => void; words: ImportWords }) {
  const { words } = props;
  return (
    <>
      <label className="mt-4 block font-semibold">
        {words["import.paste"]}
        <textarea
          value={props.csv}
          rows={6}
          onChange={(e) => props.onText(e.target.value)}
          className={`${FIELD} mt-1 font-normal`}
        />
      </label>
      <label className="mt-2 flex min-h-11 flex-wrap items-center gap-2 text-body-sm">
        {words["import.file"]}
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => void e.target.files?.[0]?.text().then(props.onText)}
          className="min-h-11"
        />
      </label>
    </>
  );
}

export function SheetImport(props: { slug: string; words: ImportWords; language: string }) {
  const { slug, words, language } = props;
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [answers, setAnswers] = useState<Answers>(new Map());
  const [result, setResult] = useState<ImportResult | null>(null);
  const [problem, setProblem] = useState<
    "noName" | "tooMany" | "failed" | typeof SIGNED_OUT | null
  >(null);
  const failed = (res: Response | null) => (res?.status === 401 ? SIGNED_OUT : "failed");
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    const res = await post(slug, { csv, apply: false, decisions: [] });
    setBusy(false);
    const body = res ? ((await res.json()) as ImportPreview & { code?: string }) : null;
    // 422: no "Name" column, or more rows than one import takes.
    if (res?.status === 422)
      return setProblem(body?.code === "too_many_rows" ? "tooMany" : "noName");
    setProblem(res?.ok ? null : failed(res));
    if (res?.ok && body) {
      setPreview(body);
      setAnswers(new Map());
    }
  };
  const apply = async () => {
    setBusy(true);
    const decisions = [...answers].map(([line, uid]) => ({ line, uid }));
    const res = await post(slug, { csv, apply: true, decisions });
    setBusy(false);
    if (!res?.ok) return setProblem(failed(res));
    track("ws_sheet_imported");
    setResult((await res.json()) as ImportResult);
  };
  const again = () => [setCsv(""), setPreview(null), setResult(null), setProblem(null)];
  const typed = (text: string) => [setCsv(text), setPreview(null)];

  if (result)
    return <Done result={result} words={words} language={language} slug={slug} onAgain={again} />;
  return (
    <>
      <SheetInput csv={csv} onText={typed} words={words} />
      <button
        type="button"
        disabled={csv.trim() === "" || busy}
        onClick={() => void check()}
        className={buttonClass("primary", "mt-3")}
      >
        {words["import.check"]}
      </button>
      {problem === SIGNED_OUT ? (
        <SignedOutNote className="mt-2" />
      ) : (
        problem && (
          <p role="alert" className="mt-2 text-seal">
            {words[IMPORT_PROBLEM[problem]]}
          </p>
        )
      )}
      {preview && (
        <Review
          preview={preview}
          answers={answers}
          setAnswers={setAnswers}
          words={words}
          onApply={() => void apply()}
          busy={busy}
          language={language}
        />
      )}
    </>
  );
}
