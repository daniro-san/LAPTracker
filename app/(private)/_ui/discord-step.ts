// Alliance settings → Discord, the bot's steps (D129; issue 585, F28): which lines the card shows, so it says
// one thing about the bot. `off`: the site has no Discord app, so one block replaces steps 1 and 2 and the
// channels lose their step number. `noCheck`: the install link works but Check cannot run, so step 2 says
// only that. `ready`: the three steps, with what the last Check found.
import type { WorkspaceKey } from "@/lib/private/dictionary";

export interface BotFacts {
  installUrl: string | null;
  /** The bot token and the app's credentials are set on this site. */
  ready: boolean;
  seen: boolean;
  /** The commands last registered in the server; null: never. */
  commands: string[] | null;
  /** The commands on for the alliance now. */
  wanted: string[];
}

export type BotStep = "off" | "noCheck" | "ready";

export function botLines(bot: BotFacts): {
  step: BotStep;
  /** The bot part's lines, in the order shown. */
  keys: WorkspaceKey[];
  hooksHead: WorkspaceKey;
} {
  if (!bot.installUrl)
    return {
      step: "off",
      keys: ["discord.bot.siteOffHead", "discord.bot.siteOff"],
      hooksHead: "discord.hooks.headAlone",
    };
  const add: WorkspaceKey[] = [
    "discord.bot.head",
    "discord.bot.lead",
    "discord.bot.tip",
    "discord.bot.add",
    "discord.check.head",
  ];
  if (!bot.ready)
    return {
      step: "noCheck",
      keys: [...add, "discord.check.off"],
      hooksHead: "discord.hooks.head",
    };
  const found: WorkspaceKey[] = bot.seen
    ? ["discord.check.seen", ...(bot.commands?.length ? (["discord.check.commands"] as const) : [])]
    : ["discord.check.never"];
  return {
    step: "ready",
    keys: [
      ...add,
      bot.wanted.length > 0 ? "discord.check.lead" : "discord.check.leadNone",
      ...found,
      "discord.check.button",
      "discord.private",
    ],
    hooksHead: "discord.hooks.head",
  };
}
