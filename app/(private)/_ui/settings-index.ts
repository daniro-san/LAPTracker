// Alliance settings' "On this page" index (issue 585, F28): one row per card the page shows, in page order,
// each with its state in words. A row needs a look (yarn) only when something stops working: a key the
// tracker refuses, out of quota or to enter again; a webhook to paste again; the Raid Shield summary switched
// on with no channel to post to; a deletion asked. No key is a choice (D134), so it is no alarm (D75).
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { WebhookState } from "@/lib/private/discord-webhooks";
import type { KeyState } from "@/lib/private/tracker-key";
import { fill } from "@/lib/words";

export interface IndexRow {
  /** The card's heading id, the row's `#` target. */
  id: string;
  label: string;
  state: string | null;
  attention: boolean;
}

export interface SettingsIndexInput {
  key: KeyState;
  /** Features the alliance may switch, and how many are on; null when the owner allows none. */
  features: { on: number; allowed: number } | null;
  /** The Raid Shield check's card, shown while the check is on. */
  shield: { discord: boolean; channel: "ok" | "reenter" | "none" } | null;
  /** The Notifications card: the site has push keys. */
  push: boolean;
  discord: { channels: WebhookState[]; botOff: boolean };
  /** "Your line on our posts" (D155), shown while `post_callouts` is on: how many posts have a line. */
  callouts: { set: number; n: number } | null;
  /** `download`: the data card is shown (D126); `deletionDate`: a deletion is asked, its date. */
  data: { download: boolean; deletionDate: string | null };
}

const KEY_TROUBLE: ReadonlySet<KeyState> = new Set(["invalid", "out_of_quota", "reenter"]);

export function settingsIndex(input: SettingsIndexInput, t: WorkspaceDictionary): IndexRow[] {
  const rows: IndexRow[] = [
    {
      id: "tracker-key",
      label: t["key.head"],
      state: t[`settings.state.key.${input.key}`],
      attention: KEY_TROUBLE.has(input.key),
    },
  ];
  if (input.features)
    rows.push({
      id: "features",
      label: t["switches.head"],
      state: fill(t["settings.state.features"], input.features),
      attention: false,
    });
  if (input.shield)
    rows.push({
      id: "raid-prep",
      label: t["prep.settings.head"],
      state: t[input.shield.discord ? "settings.state.shieldOn" : "settings.state.shieldOff"],
      attention: input.shield.discord && input.shield.channel !== "ok",
    });
  if (input.push) rows.push({ id: "push", label: t["push.head"], state: null, attention: false });
  const { channels, botOff } = input.discord;
  // A channel the site set up for the alliance posts too, so it counts as set.
  const set = channels.filter((c) => c === "set" || c === "site").length;
  const count = fill(t["settings.state.channels"], { set, n: channels.length });
  rows.push({
    id: "discord",
    label: t["discord.head"],
    state: botOff ? `${count} · ${t["settings.state.botOff"]}` : count,
    attention: channels.includes("reenter"),
  });
  if (input.callouts)
    rows.push({
      id: "callouts",
      label: t["callouts.head"],
      state: fill(t["settings.state.callouts"], input.callouts),
      attention: false,
    });
  const deletion = input.data.deletionDate;
  rows.push({
    id: input.data.download ? "workspace-data" : "workspace-delete-head",
    label: t[input.data.download ? "data.head" : "delete.head"],
    state: deletion ? fill(t["settings.state.deletion"], { date: deletion }) : null,
    attention: deletion !== null,
  });
  return rows;
}
