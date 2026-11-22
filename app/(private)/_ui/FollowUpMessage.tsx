"use client";

// The ready message block (D140): which language it is in, the text and its two copies, in Follow-up's
// panel and on the member card (issue 516, `where`). Its own module, so the card and the panel share it
// without one importing the other. Nothing is sent from here; a copy is counted (`ws_message_copied`).
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { chip } from "@/lib/brand/components/controls";
import type { CardFollowUp, MessageWords } from "@/lib/private/card-follow-up";
import { discordLiteral, gameMail } from "@/lib/private/notice-formats";
import { fill } from "@/lib/words";

import { FIELD } from "./CalendarFields";
import { CopyButton } from "./CopyButton";
import { LANGUAGE_CHOICES } from "./languages";

export const HEAD = "text-body-sm font-semibold";
export const SECTION = "mt-4 border-t border-rule pt-3";

export function Message({
  message,
  words,
  where,
}: {
  message: CardFollowUp["message"];
  words: MessageWords;
  where: "card" | "follow_up";
}) {
  // The member's language first; the officer may pick another (persona panel, D140).
  const [language, setLanguage] = useState(message.language);
  const text = message.texts[language];
  const labels = (copy: string) => ({
    copy,
    copied: words["followup.copied"],
    failed: words["followup.copyFailed"],
  });
  const id = `${where}-message`;
  return (
    <section className={SECTION} aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className={HEAD}>
        {words["followup.message"]}
      </h3>
      <div role="group" aria-label={words["followup.messageLang"]} className="mt-1 flex gap-2">
        {LANGUAGE_CHOICES.map(({ id: l }) => (
          <button
            key={l}
            type="button"
            aria-pressed={l === language}
            aria-label={words[`followup.lang.${l}`]}
            onClick={() => setLanguage(l)}
            className={chip(l === language)}
          >
            {l.slice(0, 2).toUpperCase()}
          </button>
        ))}
      </div>
      <p id={`${id}-note`} className="mt-1 text-body-sm text-ink/80">
        {fill(words["followup.messageHelp"], { language: words[`followup.lang.${language}`] })}
      </p>
      <textarea
        readOnly
        value={text}
        rows={6}
        aria-labelledby={`${id}-h`}
        aria-describedby={`${id}-note`}
        className={`${FIELD} mt-1 field-sizing-content py-2 text-[16px]`}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton
          text={gameMail(text)}
          labels={labels(words["followup.copyGame"])}
          onCopied={() => track("ws_message_copied", { where, to: "game" })}
        />
        <CopyButton
          text={discordLiteral(text)}
          labels={labels(words["followup.copyDiscord"])}
          onCopied={() => track("ws_message_copied", { where, to: "discord" })}
        />
      </div>
    </section>
  );
}
