"use client";

// Alliance settings → Discord, step 3 (D129, issue 451): the leaders' and members' channels that "Publish to
// Discord" posts to, and the Raid Shield summary's own channel (D147). Each takes a webhook URL (a password field: it is sent once and never comes back), the
// channel's name and whether it is a forum. The server checks the webhook with Discord before saving. Then
// "Send a test message", Replace and Remove. One request id per open form (D100).
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { CheckField } from "@/lib/brand/components/CheckField";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { AskSheet } from "./AskSheet";
import { postDiscord, type Note, NoteLine } from "./discord-send";
import { newRequestId } from "./request-id";

export type ChannelKind = "leaders" | "members" | "shield";
export interface ChannelProps {
  channel: ChannelKind;
  state: "set" | "reenter" | "site" | "none";
  name: string | null;
}

const REFUSALS: Record<string, keyof WorkspaceDictionary> = {
  bad_request: "discord.hook.bad",
  refused: "discord.hook.refused",
  wrong_server: "discord.hook.wrongServer",
  unreachable: "discord.hook.unreachable",
  rate_limited: "discord.hook.rateLimited",
  off: "discord.hook.off",
  not_set_up: "discord.hook.notSetUp",
};

function stateLine(c: ChannelProps, t: WorkspaceDictionary) {
  if (c.state === "set") return fill(t["discord.hook.set"], { name: c.name ?? "" });
  if (c.state === "site") return fill(t["discord.hook.site"], { name: c.name ?? "" });
  if (c.state === "reenter") return t["discord.hook.reenter"];
  return t[c.channel === "shield" ? "discord.hook.noneShield" : "discord.hook.none"];
}

/** The webhook form: URL, channel name, forum, then Check and save (and Cancel when one is set). */
function HookForm(props: {
  c: ChannelProps;
  t: WorkspaceDictionary;
  busy: boolean;
  onSave: (v: { url: string; name: string; forum: boolean }) => Promise<boolean>;
  onCancel: (() => void) | null;
}) {
  const { c, t, busy } = props;
  const [url, setUrl] = useState("");
  const [name, setName] = useState(c.state === "set" ? "" : (c.name ?? ""));
  const [forum, setForum] = useState(false);
  const id = (field: string) => `hook-${field}-${c.channel}`;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await props.onSave({ url: url.trim(), name, forum })) setUrl("");
  };
  return (
    <form onSubmit={submit} className="mt-3 grid gap-3">
      <div>
        <label htmlFor={id("url")} className="font-semibold">
          {t["discord.hook.url"]}
        </label>
        <p id={id("url-help")} className="text-body-sm text-ink/70">
          {t["discord.hook.urlHelp"]}
        </p>
        <input
          id={id("url")}
          type="password"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-describedby={id("url-help")}
          className="drawn-field mt-2 min-h-11 w-full px-3"
        />
      </div>
      <div>
        <label htmlFor={id("name")} className="font-semibold">
          {t["discord.hook.name"]}
        </label>
        <p id={id("name-help")} className="text-body-sm text-ink/70">
          {t[c.channel === "shield" ? "discord.hook.nameHelpShield" : "discord.hook.nameHelp"]}
        </p>
        <input
          id={id("name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          aria-describedby={id("name-help")}
          className="drawn-field mt-2 min-h-11 w-full px-3"
        />
      </div>
      <CheckField
        label={t["discord.hook.forum"]}
        help={t[c.channel === "shield" ? "discord.hook.forumHelpShield" : "discord.hook.forumHelp"]}
        checked={forum}
        onChange={(e) => setForum(e.target.checked)}
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={buttonClass("primary")}>
          {busy ? t["discord.hook.saving"] : t["discord.hook.save"]}
        </button>
        {props.onCancel && (
          <button type="button" className={buttonClass("secondary")} onClick={props.onCancel}>
            {t["discord.hook.cancel"]}
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Under a usable channel: Send a test message, Replace (or Add a webhook over the site's), and Remove, asked
 * first with the safe answer first.
 */
function HookActions(props: {
  c: ChannelProps;
  t: WorkspaceDictionary;
  saving: boolean;
  busy: "save" | "test" | "remove" | null;
  onTest: () => void;
  onReplace: () => void;
  onRemove: () => Promise<void>;
}) {
  const { c, t } = props;
  const [asking, setAsking] = useState(false);
  const testing = props.busy === "test";
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={testing}
        className={buttonClass("secondary")}
        onClick={props.onTest}
      >
        {testing ? t["discord.hook.testing"] : t["discord.hook.test"]}
      </button>
      {props.saving && (
        <button type="button" className={buttonClass("secondary")} onClick={props.onReplace}>
          {t[c.state === "set" ? "discord.hook.replace" : "discord.hook.add"]}
        </button>
      )}
      {c.state === "set" && (
        <button type="button" className={buttonClass("secondary")} onClick={() => setAsking(true)}>
          {t["discord.hook.remove"]}
        </button>
      )}
      {asking && (
        <AskSheet
          id={`hook-remove-${c.channel}`}
          question={t["discord.hook.removeAsk"]}
          yes={t["discord.hook.remove"]}
          no={t["discord.hook.keep"]}
          busy={props.busy === "remove"}
          seal
          onAnswer={(yes) =>
            yes ? void props.onRemove().then(() => setAsking(false)) : setAsking(false)
          }
        >
          <p className="mt-2">
            {
              t[
                c.channel === "shield" ? "discord.hook.removeMoreShield" : "discord.hook.removeMore"
              ]
            }
          </p>
        </AskSheet>
      )}
    </div>
  );
}

/** One channel: its state, then Send a test message, Replace and Remove, or the form. */
function ChannelCard(props: {
  slug: string;
  c: ChannelProps;
  t: WorkspaceDictionary;
  saving: boolean;
}) {
  const { slug, c, t } = props;
  const router = useRouter();
  const usable = c.state === "set" || c.state === "site";
  const [editing, setEditing] = useState(!usable);
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [requestId, setRequestId] = useState(newRequestId);

  const send = async (kind: "save" | "test" | "remove", body: object, ok: string) => {
    setBusy(kind);
    setNote(null);
    const answer = await postDiscord(slug, { ...body, channel: c.channel });
    setBusy(null);
    if (answer.code !== null) {
      const fallback = kind === "test" ? "discord.hook.testFailed" : "discord.hook.failed";
      setNote({ ok: false, text: answer.refusal ?? t[REFUSALS[answer.code] ?? fallback] });
      return false;
    }
    setNote({ ok: true, text: ok });
    if (kind !== "test") router.refresh();
    return true;
  };
  const save = async (v: { url: string; name: string; forum: boolean }) => {
    const done = await send(
      "save",
      { action: "webhook", ...v, requestId },
      t["discord.hook.saved"],
    );
    if (!done) return false;
    track("ws_webhook_set", { channel: c.channel });
    setRequestId(newRequestId());
    setEditing(false);
    return true;
  };
  const remove = async () => {
    if (await send("remove", { action: "remove_webhook" }, t["discord.hook.removed"]))
      setEditing(true);
  };
  return (
    <div className="drawn-frame-soft px-3 py-3">
      <h4 className="font-semibold">{t[`discord.channel.${c.channel}`]}</h4>
      {c.channel === "shield" && (
        <p className="mb-1 text-body-sm text-ink/75">{t["discord.channel.shieldHelp"]}</p>
      )}
      <p className={c.state === "reenter" ? "font-semibold text-seal" : "text-ink/80"}>
        <bdi>{stateLine(c, t)}</bdi>
      </p>
      {usable && !editing && (
        <HookActions
          c={c}
          t={t}
          saving={props.saving}
          busy={busy}
          onTest={() => void send("test", { action: "test" }, t["discord.hook.tested"])}
          onReplace={() => (setEditing(true), setNote(null))}
          onRemove={remove}
        />
      )}
      {editing && props.saving && (
        <HookForm
          c={c}
          t={t}
          busy={busy === "save"}
          onSave={save}
          onCancel={usable ? () => (setEditing(false), setNote(null)) : null}
        />
      )}
      {editing && !props.saving && <p className="mt-2 font-semibold">{t["discord.hook.off"]}</p>}
      <NoteLine note={note} />
    </div>
  );
}

export function DiscordChannels(props: {
  slug: string;
  channels: ChannelProps[];
  /** Webhooks can be saved: WORKSPACE_KEYS_SECRET is set (D124). */
  saving: boolean;
  t: WorkspaceDictionary;
}) {
  const { t } = props;
  return (
    <section aria-labelledby="discord-hooks" className="mt-6">
      <h3 id="discord-hooks" className="font-subhead text-body-lg font-semibold">
        {t["discord.hooks.head"]}
      </h3>
      <p className="mt-1">{t["discord.hooks.lead"]}</p>
      <p className="mt-2 text-body-sm text-ink/75">{t["discord.hooks.how"]}</p>
      <div className="mt-3 grid gap-3">
        {props.channels.map((c) => (
          <ChannelCard key={c.channel} slug={props.slug} c={c} t={t} saving={props.saving} />
        ))}
      </div>
    </section>
  );
}
