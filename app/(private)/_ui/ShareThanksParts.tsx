"use client";

// "Share the thanks", step two's parts (issue 404, D114): the text in one language at a time, and one way to
// share it. The box opens at the top of its text, again on each language switch, and grows to fit.
import { useLayoutEffect, useRef, type ReactNode } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip, FIELD } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import { NOTICE_LIMIT, noticeLength, type NoticeLanguage } from "@/lib/private/notice-rules";

import { LANGUAGE_CHOICES } from "./languages";
import type { ShareThanksProps } from "./share-thanks-data";
import { RefusalLine } from "./SignedOut";

export type Texts = Record<NoticeLanguage, string>;
export type State = "idle" | "busy" | "done";
type Words = ShareThanksProps["words"];

export const ERROR = "mt-2 border-l-4 border-seal pl-3 text-body-sm font-semibold";
/** The box grows with its text up to this share of the screen, then scrolls. */
const GROW_CAP = 0.6;

/** One language's text at a time, and its length against the game's limit. */
export function TextField(props: {
  words: Words;
  texts: Texts;
  language: NoticeLanguage;
  onLanguage: (l: NoticeLanguage) => void;
  onTexts: (t: Texts) => void;
}) {
  const { words, texts, language } = props;
  const box = useRef<HTMLTextAreaElement>(null);
  const text = texts[language];
  const length = noticeLength(text.trim());
  const over = length > NOTICE_LIMIT;
  const name = LANGUAGE_CHOICES.find((c) => c.id === language)?.name ?? "";
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 4, window.innerHeight * GROW_CAP)}px`;
  }, [text]);
  useLayoutEffect(() => {
    box.current?.scrollTo({ top: 0 });
  }, [language]);
  return (
    <>
      <div role="group" aria-label={words["share.language"]} className="mt-3 flex gap-2">
        {LANGUAGE_CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={language === c.id}
            onClick={() => props.onLanguage(c.id)}
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
        ref={box}
        id="share-text"
        value={text}
        rows={6}
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
    </>
  );
}

/** One way to share, full width: its button, one line on where it goes, and how it went. */
export function Way(props: {
  primary?: boolean;
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
    <div className="mt-3">
      <button
        type="button"
        disabled={props.disabled || props.state !== "idle"}
        onClick={props.onShare}
        className={buttonClass(props.primary ? "primary" : "secondary", "w-full")}
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
