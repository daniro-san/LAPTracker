"use client";

// Alliance settings → Discord, steps 1 and 2 (D129, issue 451): the link to Discord's install page for this
// alliance's server only, then Check, which asks the server whether the bot is in and turns on the message
// commands that are on for the alliance. The first time the bot is found counts as `ws_bot_installed`.
// Which lines show comes from `botLines` (issue 585): with the site's bot off, one block replaces both steps,
// so the card never says the bot is in the server and that it is not set up in the same breath.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

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

/** Step 1: Discord's install page for the alliance's server only, opened in a new tab. */
function AddBot({ url, t }: { url: string; t: WorkspaceDictionary }) {
  return (
    <section aria-labelledby="discord-bot" className="mt-4">
      <h3 id="discord-bot" className={STEP_HEAD}>
        {t["discord.bot.head"]}
      </h3>
      <p className="mt-1">{t["discord.bot.lead"]}</p>
      <p className="mt-2 text-body-sm font-semibold">{t["discord.bot.tip"]}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("primary", "mt-3")}
      >
        {t["discord.bot.add"]}
      </a>
    </section>
  );
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
  const lines = botLines(bot);
  const shows = (key: keyof WorkspaceDictionary) => lines.keys.includes(key);
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
  if (lines.step === "off" || !bot.installUrl)
    return (
      <section aria-labelledby="discord-bot" className="mt-4">
        <h3 id="discord-bot" className={STEP_HEAD}>
          {t["discord.bot.siteOffHead"]}
        </h3>
        <p className="mt-1">{t["discord.bot.siteOff"]}</p>
      </section>
    );
  return (
    <>
      <AddBot url={bot.installUrl} t={t} />
      <section aria-labelledby="discord-check" className="mt-6">
        <h3 id="discord-check" className={STEP_HEAD}>
          {t["discord.check.head"]}
        </h3>
        {lines.step === "noCheck" ? (
          <p className="mt-1 font-semibold">{t["discord.check.off"]}</p>
        ) : (
          <>
            <p className="mt-1">
              {t[shows("discord.check.lead") ? "discord.check.lead" : "discord.check.leadNone"]}
            </p>
            {shows("discord.check.seen") ? (
              <p className="mt-2 font-semibold">{t["discord.check.seen"]}</p>
            ) : (
              <p className="mt-2 text-ink/75">{t["discord.check.never"]}</p>
            )}
            {shows("discord.check.commands") && (
              <p className="text-body-sm text-ink/75">
                {fill(t["discord.check.commands"], { list: (bot.commands ?? []).join(", ") })}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void check()}
              className={buttonClass("secondary", "mt-3")}
            >
              {busy ? t["discord.check.checking"] : t["discord.check.button"]}
            </button>
            <NoteLine note={note} />
            <HowTo summary={t["discord.privateSummary"]}>
              <p className="text-body-sm">{t["discord.private"]}</p>
            </HowTo>
          </>
        )}
      </section>
    </>
  );
}
