"use client";

// Alliance settings → Discord, steps 1 and 2 (D129, issue 451): the link to Discord's install page for this
// alliance's server only, then Check, which asks the server whether the bot is in and turns on the message
// commands that are on for the alliance. The first time the bot is found counts as `ws_bot_installed`.
// The card renders exactly the lines `botLines` lists, in its order (issue 585): with the site's bot off, one
// block replaces both steps, so the card never says the bot is in the server and that it is not set up in
// the same breath, and `discord-step.test.ts` guards what shows.
import { useRouter } from "next/navigation";
import { Fragment, type ReactNode, useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";

import { postDiscord, type Note, NoteLine } from "./discord-send";
import { type BotFacts, botLines } from "./discord-step";
import { HowTo } from "./HowTo";

export type BotProps = BotFacts;

const REFUSALS: Record<string, keyof WorkspaceDictionary> = {
  bot_missing: "discord.check.missing",
  unreachable: "discord.check.unreachable",
  commands_failed: "discord.check.failed",
  rate_limited: "discord.check.rateLimited",
  bot_off: "discord.check.off",
};

const STEP_HEAD = "font-subhead text-body-lg font-semibold";

/** How each of `botLines`' lines is drawn; a line not listed by `botLines` is never drawn. */
function parts(
  bot: BotProps,
  t: WorkspaceDictionary,
  check: { busy: boolean; note: Note; run: () => void },
): Partial<Record<WorkspaceKey, ReactNode>> {
  return {
    "discord.bot.siteOffHead": (
      <h3 id="discord-bot" className={STEP_HEAD}>
        {t["discord.bot.siteOffHead"]}
      </h3>
    ),
    "discord.bot.siteOff": <p className="mt-1">{t["discord.bot.siteOff"]}</p>,
    "discord.bot.head": (
      <h3 id="discord-bot" className={STEP_HEAD}>
        {t["discord.bot.head"]}
      </h3>
    ),
    "discord.bot.lead": <p className="mt-1">{t["discord.bot.lead"]}</p>,
    "discord.bot.tip": <p className="mt-2 text-body-sm font-semibold">{t["discord.bot.tip"]}</p>,
    "discord.bot.add": bot.installUrl && (
      <a
        href={bot.installUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("primary", "mt-3")}
      >
        {t["discord.bot.add"]}
      </a>
    ),
    "discord.check.head": (
      <h3 id="discord-check" className={`${STEP_HEAD} mt-6`}>
        {t["discord.check.head"]}
      </h3>
    ),
    "discord.check.off": <p className="mt-1 font-semibold">{t["discord.check.off"]}</p>,
    "discord.check.lead": <p className="mt-1">{t["discord.check.lead"]}</p>,
    "discord.check.leadNone": <p className="mt-1">{t["discord.check.leadNone"]}</p>,
    "discord.check.seen": <p className="mt-2 font-semibold">{t["discord.check.seen"]}</p>,
    "discord.check.never": <p className="mt-2 text-ink/75">{t["discord.check.never"]}</p>,
    "discord.check.commands": (
      <p className="text-body-sm text-ink/75">
        {fill(t["discord.check.commands"], { list: (bot.commands ?? []).join(", ") })}
      </p>
    ),
    "discord.check.button": (
      <>
        <button
          type="button"
          disabled={check.busy}
          onClick={check.run}
          className={buttonClass("secondary", "mt-3")}
        >
          {check.busy ? t["discord.check.checking"] : t["discord.check.button"]}
        </button>
        <NoteLine note={check.note} />
      </>
    ),
    "discord.private": (
      <HowTo summary={t["discord.privateSummary"]}>
        <p className="text-body-sm">{t["discord.private"]}</p>
      </HowTo>
    ),
  };
}

export function DiscordBot({
  slug,
  bot,
  t,
}: {
  slug: string;
  bot: BotProps;
  t: WorkspaceDictionary;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const check = async () => {
    setBusy(true);
    setNote(null);
    const answer = await postDiscord(slug, { action: "check" });
    setBusy(false);
    if (answer.body.firstSeen === true) track("ws_bot_installed");
    // Through: the refreshed state line above the button says it ("LAPTracker is in your server.").
    if (answer.code === null) return router.refresh();
    setNote({
      ok: false,
      text: answer.refusal ?? t[REFUSALS[answer.code] ?? "discord.check.unreachable"],
    });
  };
  const drawn = parts(bot, t, { busy, note, run: () => void check() });
  return (
    <section aria-labelledby="discord-bot" className="mt-4">
      {botLines(bot).keys.map((key) => (
        <Fragment key={key}>{drawn[key]}</Fragment>
      ))}
    </section>
  );
}
