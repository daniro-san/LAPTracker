// Alliance settings → Discord (D129, issue 451): the three steps in one card, and the member role `/join`
// gives (issue 868). Server-rendered from what the
// server knows; only states, channel names and command names reach the browser, never a webhook URL.
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { BotView } from "@/lib/private/discord-setup";
import type { WebhookView } from "@/lib/private/discord-webhooks";

import { botLines } from "./discord-step";
import { DiscordBot } from "./DiscordBot";
import { DiscordChannels } from "./DiscordChannels";
import { DiscordMemberRole } from "./DiscordMemberRole";

export function DiscordSection(props: {
  slug: string;
  bot: BotView;
  channels: WebhookView[];
  /** Webhooks can be saved: WORKSPACE_KEYS_SECRET is set (D124). */
  saving: boolean;
  t: WorkspaceDictionary;
}) {
  const { slug, bot, t } = props;
  const facts = {
    installUrl: bot.installUrl,
    ready: bot.ready,
    seen: bot.botSeenAt !== null,
    commands: bot.commands,
    wanted: bot.wanted,
  };
  const lines = botLines(facts);
  return (
    <section aria-labelledby="discord" className="drawn-card mt-6 max-w-2xl px-4 py-3">
      <h2 id="discord" className="font-subhead text-display-sm">
        {t["discord.head"]}
      </h2>
      {/* "Do the steps in order" only while there are steps (issue 585). */}
      {lines.step !== "off" && <p className="mt-1">{t["discord.lead"]}</p>}
      <DiscordBot slug={slug} bot={facts} t={t} />
      {/* Issue 868: the role an approved `/join` gets, while the bot is set up and `/join` is on. */}
      {bot.ready && bot.join && <DiscordMemberRole slug={slug} role={bot.memberRole} t={t} />}
      <DiscordChannels
        slug={slug}
        channels={props.channels.map((c) => ({ channel: c.channel, state: c.state, name: c.name }))}
        saving={props.saving}
        head={lines.hooksHead}
        t={t}
      />
    </section>
  );
}
