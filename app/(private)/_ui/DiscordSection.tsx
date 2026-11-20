// Alliance settings → Discord (D129, issue 451): the three steps in one card. Server-rendered from what the
// server knows; only states, channel names and command names reach the browser, never a webhook URL.
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { BotView } from "@/lib/private/discord-setup";
import type { WebhookView } from "@/lib/private/discord-webhooks";

import { DiscordBot } from "./DiscordBot";
import { DiscordChannels } from "./DiscordChannels";

export function DiscordSection(props: {
  slug: string;
  bot: BotView;
  channels: WebhookView[];
  /** Webhooks can be saved: WORKSPACE_KEYS_SECRET is set (D124). */
  saving: boolean;
  t: WorkspaceDictionary;
}) {
  const { slug, bot, t } = props;
  return (
    <section aria-labelledby="discord" className="drawn-card mt-6 max-w-2xl px-4 py-3">
      <h2 id="discord" className="font-subhead text-display-sm">
        {t["discord.head"]}
      </h2>
      <p className="mt-1">{t["discord.lead"]}</p>
      <DiscordBot
        slug={slug}
        bot={{
          installUrl: bot.installUrl,
          ready: bot.ready,
          seen: bot.botSeenAt !== null,
          commands: bot.commands,
          wanted: bot.wanted,
        }}
        t={t}
      />
      <DiscordChannels
        slug={slug}
        channels={props.channels.map((c) => ({ channel: c.channel, state: c.state, name: c.name }))}
        saving={props.saving}
        t={t}
      />
    </section>
  );
}
