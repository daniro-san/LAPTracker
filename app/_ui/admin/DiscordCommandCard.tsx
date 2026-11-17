"use client";

// /admin's Discord section (D96): one button that registers the app's three message commands (D101) in
// every workspace's Discord server, on the server with the app's credentials. The press sends the PIN as x-edit-pin, like the
// other admin buttons, and shows one line per server from Discord's HTTP status only.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Notice } from "@/lib/brand/components/Notice";
import { copy, fill } from "@/lib/copy";

import { forgetPin, PinSheet, savedPin } from "./PinSheet";

const t = copy.admin.workspaces.command;
const REASONS: Partial<Record<number, string>> = t.reasons;
const ERRORS: Partial<Record<string, string>> = t.errors;

export interface GuildView {
  guild: string;
  /** The alliance tags of the workspaces in this server. */
  name: string;
}

/** "154480…4060": enough to tell servers apart in one line at 360 px. */
const shortId = (id: string) => `${id.slice(0, 6)}…${id.slice(-4)}`;

const outcome = (status: number) =>
  status >= 200 && status < 300 ? t.registered : (REASONS[status] ?? fill(t.failed, { status }));

type Answer = { ok: boolean; lines: string[] };

interface Body {
  code?: string;
  status?: number;
  guilds?: { guild_id: string; status: number }[];
}

/** The route's answer in words: one line per server, or the one refusal. */
function toAnswer(ok: boolean, body: Body, guilds: GuildView[]): Answer {
  if (ok && body.guilds) {
    return {
      ok: body.guilds.every((g) => g.status >= 200 && g.status < 300),
      lines: body.guilds.map((g) =>
        fill(t.line, {
          name: guilds.find((v) => v.guild === g.guild_id)?.name ?? g.guild_id,
          guild: shortId(g.guild_id),
          outcome: outcome(g.status),
        }),
      ),
    };
  }
  const code = body.code ?? "failed";
  const text =
    code === "discord_token" && body.status === 0
      ? t.reasons[0]
      : fill(ERRORS[code] ?? t.errors.failed, { status: body.status ?? 0 });
  return { ok: false, lines: [text] };
}

export function DiscordCommandCard({ guilds, ready }: { guilds: GuildView[]; ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);

  async function send(pin: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/discord-command", {
        method: "POST",
        headers: { "x-edit-pin": pin },
      });
      const body = (await res.json().catch(() => ({}))) as Body;
      if (res.status === 401) forgetPin();
      setAnswer(toAnswer(res.ok, body, guilds));
    } catch {
      setAnswer({ ok: false, lines: [t.errors.failed] });
    } finally {
      setBusy(false);
    }
  }

  const press = () => {
    setAnswer(null);
    const pin = savedPin();
    if (pin) void send(pin);
    else setAsking(true);
  };

  return (
    <div className="grid gap-3">
      {!ready && <p className="text-body-sm text-ink/80">{t.noCredentials}</p>}
      {ready && guilds.length === 0 && <p className="text-body-sm text-ink/80">{t.noGuild}</p>}
      <button
        type="button"
        onClick={press}
        disabled={!ready || guilds.length === 0 || busy}
        className={buttonClass("secondary", "font-semibold sm:justify-self-start")}
      >
        {t.register}
      </button>
      {answer && (
        <Notice tone={answer.ok ? "ok" : "fail"}>
          <ul>
            {answer.lines.map((line) => (
              <li key={line} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        </Notice>
      )}
      {asking && (
        <PinSheet
          onCancel={() => setAsking(false)}
          onUnlocked={(pin) => {
            setAsking(false);
            void send(pin);
          }}
        />
      )}
    </div>
  );
}
