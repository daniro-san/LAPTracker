"use client";

// "Share the thanks", step two (issue 404, D114): the post in each language, editable, one language at a
// time (the officer's own first), with its length against the game's 1,000 characters; then the three ways
// to share it. Discord and the board each send once per request id (D100); after Discord refused, the next
// tap takes a new id. A share that went through says where, and its button rests.
import { useState, type ReactNode } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip, FIELD } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import { gameNotice } from "@/lib/private/notice-formats";
import { NOTICE_LIMIT, noticeLength, type NoticeLanguage } from "@/lib/private/notice-rules";

import { CopyButton } from "./CopyButton";
import { LANGUAGE_CHOICES } from "./languages";
import type { ShareThanksProps } from "./share-thanks-data";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export type Texts = Record<NoticeLanguage, string>;
type Target = "discord" | "board";
type State = "idle" | "busy" | "done";
type Words = ShareThanksProps["words"];

const ERROR = "mt-2 border-l-4 border-seal pl-3 text-body-sm font-semibold";
const BACK =
  "mt-4 inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/** The share route's answer: "ok", or its code; "lost" when no answer came (it may have posted). */
async function send(slug: string, body: object): Promise<string> {
  try {
    const res = await fetch(`/api/w/${slug}/thanks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return "ok";
    const { code } = (await res.json().catch(() => ({}))) as { code?: string };
    return code ?? "failed";
  } catch {
    return "lost";
  }
}

/** A refusal's words; SIGNED_OUT for the signed-out note (RefusalLine shows it). */
function refusal(code: string, target: Target, words: Words): string {
  if (code === SIGNED_OUT) return SIGNED_OUT;
  if (code === "posting") return words["share.busy"];
  if (code === "not_set_up") return words["share.discord.off"];
  return words[target === "discord" ? "share.failed" : "share.boardFailed"];
}

/** Each way's state, last refusal and request id (D100): one id per way until Discord refuses it. */
function useShare(
  props: ShareThanksProps & { names: string[]; texts: Texts; onShared: () => void },
) {
  const { words, week } = props;
  const [state, setState] = useState<Record<Target, State>>({ discord: "idle", board: "idle" });
  const [error, setError] = useState<Record<Target, string | null>>({ discord: null, board: null });
  const [ids, setIds] = useState(() => ({
    discord: crypto.randomUUID(),
    board: crypto.randomUUID(),
  }));
  const share = async (target: Target) => {
    const texts = Object.fromEntries(Object.entries(props.texts).map(([l, t]) => [l, t.trim()]));
    if (Object.values(texts).every((t) => t === "")) {
      return setError((e) => ({ ...e, [target]: words["share.empty"] }));
    }
    setState((s) => ({ ...s, [target]: "busy" }));
    setError((e) => ({ ...e, [target]: null }));
    const answer = await send(props.slug, {
      action: "share",
      target,
      week: week.monday,
      title: `${words["share.discord.title"]} · ${week.range}`,
      texts,
      names: props.names,
      requestId: ids[target],
    });
    setState((s) => ({ ...s, [target]: answer === "ok" ? "done" : "idle" }));
    if (answer === "ok") return props.onShared();
    if (answer === "failed") setIds((i) => ({ ...i, [target]: crypto.randomUUID() }));
    setError((e) => ({ ...e, [target]: refusal(answer, target, words) }));
  };
  return { state, error, share };
}

/** One language's text at a time, its length against the game's limit, and Copy for the game. */
function TextField(props: {
  words: Words;
  texts: Texts;
  first: NoticeLanguage;
  onTexts: (t: Texts) => void;
}) {
  const { words, texts } = props;
  const [language, setLanguage] = useState<NoticeLanguage>(props.first);
  const text = texts[language];
  const length = noticeLength(text.trim());
  const over = length > NOTICE_LIMIT;
  const name = LANGUAGE_CHOICES.find((c) => c.id === language)?.name ?? "";
  return (
    <>
      <div role="group" aria-label={words["share.language"]} className="mt-3 flex gap-2">
        {LANGUAGE_CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={language === c.id}
            onClick={() => setLanguage(c.id)}
            className={`${chip(language === c.id)} min-w-12 justify-center`}
          >
            <span aria-hidden="true">{c.short}</span>
            <span className="sr-only">{c.name}</span>
          </button>
        ))}
      </div>
      <label htmlFor="share-text" className="mt-3 block font-semibold">
        {fill(words["share.text"], { lang: name })}
      </label>
      <textarea
        id="share-text"
        value={text}
        rows={9}
        onChange={(e) => props.onTexts({ ...texts, [language]: e.target.value })}
        aria-describedby="share-count"
        aria-invalid={over || undefined}
        className={`${FIELD} mt-1 text-base`}
      />
      <p
        id="share-count"
        className={`mt-1 text-body-sm tabular-nums ${over ? "font-semibold text-seal" : "text-ink/75"}`}
      >
        {fill(words[over ? "share.tooLong" : "share.count"], { n: length, max: NOTICE_LIMIT })}
      </p>
      <h3 className="mt-4 font-subhead text-display-sm">{words["share.where"]}</h3>
      <div className="mt-2">
        <CopyButton
          text={gameNotice(text).text}
          labels={{
            copy: words["share.copy"],
            copied: words["share.copied"],
            failed: words["share.copyFailed"],
          }}
        />
      </div>
    </>
  );
}

/** One way to share: its button, where it goes, and how it went. */
function Way(props: {
  label: string;
  busy: string;
  where: string;
  done: ReactNode;
  state: State;
  error: string | null;
  disabled: boolean;
  onShare: () => void;
}) {
  return (
    <div className="mt-3 border-t border-rule pt-3">
      <button
        type="button"
        disabled={props.disabled || props.state !== "idle"}
        onClick={props.onShare}
        className={buttonClass("secondary", "w-full sm:w-auto")}
      >
        {props.state === "busy" ? props.busy : props.label}
      </button>
      <p className="mt-1 text-body-sm text-ink/80">{props.where}</p>
      {props.state === "done" && (
        <p role="status" className="mt-1 font-semibold text-sage">
          {props.done}
        </p>
      )}
      {props.error && <RefusalLine text={props.error} className={ERROR} />}
    </div>
  );
}

export function ShareThanksEdit(
  props: ShareThanksProps & {
    names: string[];
    texts: Texts;
    onTexts: (t: Texts) => void;
    /** The writing help's last word (off, failed …), shown above the fields. */
    note: string | null;
    onShared: () => void;
    onBack: () => void;
  },
) {
  const { words, channel } = props;
  const { state, error, share } = useShare(props);
  const tooLong = Object.values(props.texts).some((t) => noticeLength(t.trim()) > NOTICE_LIMIT);
  return (
    <>
      {props.note && <RefusalLine text={props.note} className={`${ERROR} mt-0 mb-3`} />}
      <p className="text-body-sm">{words["share.edit"]}</p>
      <TextField words={words} texts={props.texts} first={props.language} onTexts={props.onTexts} />
      <Way
        label={words["share.discord"]}
        busy={words["share.posting"]}
        where={
          channel === null
            ? words["share.discord.off"]
            : fill(words["share.discord.where"], { channel })
        }
        done={fill(words["share.discord.done"], { channel: channel ?? "" })}
        state={state.discord}
        error={error.discord}
        disabled={channel === null || tooLong}
        onShare={() => void share("discord")}
      />
      <Way
        label={words["share.board"]}
        busy={words["share.posting"]}
        where={words["share.board.where"]}
        done={
          <>
            {words["share.board.done"]}{" "}
            <a
              href={`/w/${props.slug}/board`}
              className="inline-flex min-h-11 items-center text-plum underline underline-offset-4"
            >
              {words["share.board.see"]}
            </a>
          </>
        }
        state={state.board}
        error={error.board}
        disabled={tooLong}
        onShare={() => void share("board")}
      />
      <button type="button" onClick={props.onBack} className={BACK}>
        {words["share.again"]}
      </button>
    </>
  );
}
