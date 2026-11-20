"use client";

// Alliance settings → Discord, steps 1 and 2 (D129, issue 451): the link to Discord's install page for this
// alliance's server only, then Check, which asks the server whether the bot is in and turns on the message
// commands that are on for the alliance. The first time the bot is found counts as `ws_bot_installed`.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { postDiscord, type Note, NoteLine } from "./discord-send";

export interface BotProps {
  installUrl: string | null;
  /** The bot token and the app's credentials are set on this site. */
  ready: boolean;
  seen: boolean;
  /** The commands last registered in the server; null: never. */
  commands: string[] | null;
  /** The commands on for the alliance now. */
  wanted: string[];
}

const REFUSALS: Record<string, keyof WorkspaceDictionary> = {
  bot_missing: "discord.check.missing",
  unreachable: "discord.check.unreachable",
  commands_failed: "discord.check.failed",
  rate_limited: "discord.check.rateLimited",
  bot_off: "discord.check.off",
};

/** Where the server stands: checked or not, and which commands Discord has. */
function State({ bot, t }: { bot: BotProps; t: WorkspaceDictionary }) {
  if (!bot.seen) return <p className="mt-2 text-ink/75">{t["discord.check.never"]}</p>;
  return (
    <>
      <p className="mt-2 font-semibold">{t["discord.check.seen"]}</p>
      {bot.commands && bot.commands.length > 0 && (
        <p className="text-body-sm text-ink/75">
          {fill(t["discord.check.commands"], { list: bot.commands.join(", ") })}
        </p>
      )}
    </>
  );
}

/** Step 1: Discord's install page for the alliance's server only, opened in a new tab. */
function AddBot({ url, t }: { url: string | null; t: WorkspaceDictionary }) {
  return (
    <section aria-labelledby="discord-bot" className="mt-4">
      <h3 id="discord-bot" className="font-subhead text-body-lg font-semibold">
        {t["discord.bot.head"]}
      </h3>
      <p className="mt-1">{t["discord.bot.lead"]}</p>
      {url ? (
        <>
          <p className="mt-2 text-body-sm font-semibold">{t["discord.bot.tip"]}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("primary", "mt-3")}
          >
            {t["discord.bot.add"]}
          </a>
        </>
      ) : (
        <p className="mt-2 font-semibold">{t["discord.bot.unset"]}</p>
      )}
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
  return (
    <>
      <AddBot url={bot.installUrl} t={t} />
      <section aria-labelledby="discord-check" className="mt-6">
        <h3 id="discord-check" className="font-subhead text-body-lg font-semibold">
          {t["discord.check.head"]}
        </h3>
        <p className="mt-1">
          {t[bot.wanted.length > 0 ? "discord.check.lead" : "discord.check.leadNone"]}
        </p>
        <State bot={bot} t={t} />
        {bot.ready ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void check()}
            className={buttonClass("secondary", "mt-3")}
          >
            {busy ? t["discord.check.checking"] : t["discord.check.button"]}
          </button>
        ) : (
          <p className="mt-2 font-semibold">{t["discord.check.off"]}</p>
        )}
        <NoteLine note={note} />
        <p className="mt-3 text-body-sm text-ink/75">{t["discord.private"]}</p>
      </section>
    </>
  );
}
