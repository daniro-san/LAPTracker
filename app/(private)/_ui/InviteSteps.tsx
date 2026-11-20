"use client";

// /w/invite after the Discord sign-in (D130, issue 453): step 2 picks the server from the list Discord gave,
// step 3 adds the bot and checks it by reading the server's roles, step 4 picks the leadership and member
// roles, or creates `[TAG] Leadership` and `[TAG] Members` once she allowed Manage Roles. Then "Open our
// Officers' Desk" makes the workspace and signs her in. No step polls Discord: each check is one tap.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { errorText, NoteLine, postInvite, Step, type Note } from "./invite-client";
import { InviteRoles, type RoleView } from "./InviteRoles";

type Signed = {
  name: string;
  guilds: { id: string; name: string; taken: boolean }[];
  guildId: string | null;
};

function ServerStep({ t, signedIn }: { t: WorkspaceDictionary; signedIn: Signed }) {
  const router = useRouter();
  const picked = signedIn.guilds.find((g) => g.id === signedIn.guildId) ?? null;
  const [changing, setChanging] = useState(picked === null);
  const [choice, setChoice] = useState(signedIn.guildId ?? "");
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const answer = await postInvite({ action: "server", guild_id: choice });
    setBusy(false);
    if (answer.code) return setNote({ ok: false, text: errorText(t, answer.code) });
    setNote(null);
    setChanging(false);
    router.refresh();
  };
  return (
    <Step
      id="invite-server"
      head={t["invite.server.head"]}
      done={picked !== null && !changing}
      t={t}
    >
      {picked && !changing ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 font-semibold break-words">
            {fill(t["invite.server.picked"], { name: picked.name })}
          </p>
          <button
            type="button"
            className={buttonClass("secondary")}
            onClick={() => setChanging(true)}
          >
            {t["invite.server.change"]}
          </button>
        </div>
      ) : signedIn.guilds.length === 0 ? (
        <p className="mt-1">{t["invite.server.none"]}</p>
      ) : (
        <fieldset className="mt-1">
          <legend className="text-body-sm text-ink/75">{t["invite.server.tip"]}</legend>
          <div className="mt-2 grid gap-2">
            {signedIn.guilds.map((g) => (
              <label
                key={g.id}
                className={`drawn-frame-soft flex min-h-11 items-center gap-3 px-3 py-2 has-[:checked]:bg-plum/10 ${g.taken ? "opacity-60" : "tint-button"}`}
              >
                <input
                  type="radio"
                  name="server"
                  value={g.id}
                  disabled={g.taken}
                  checked={choice === g.id}
                  onChange={() => setChoice(g.id)}
                  className="size-6 shrink-0 accent-plum"
                />
                <span className="flex min-w-0 flex-col">
                  <bdi className="font-medium break-words">{g.name}</bdi>
                  {g.taken && (
                    <span className="text-body-sm text-ink/70">{t["invite.server.taken"]}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || choice === ""}
            onClick={() => void save()}
            className={buttonClass("primary", "mt-3 w-full")}
          >
            {t["invite.server.save"]}
          </button>
        </fieldset>
      )}
      <NoteLine note={note} />
    </Step>
  );
}

export function InviteSteps(props: {
  t: WorkspaceDictionary;
  tag: string;
  signedIn: Signed;
  installUrl: string | null;
  rolesInstallUrl: string | null;
  ready: boolean;
}) {
  const { t, signedIn } = props;
  const [roles, setRoles] = useState<RoleView[] | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    const answer = await postInvite({ action: "roles" });
    setBusy(false);
    if (answer.code) return setNote({ ok: false, text: errorText(t, answer.code) });
    setNote(null);
    setRoles((answer.body.roles as RoleView[] | null) ?? []);
  };
  const server = signedIn.guildId;
  return (
    <>
      <Step id="invite-signin" head={t["invite.signin.head"]} done t={t}>
        <p className="mt-1 break-words">{fill(t["invite.signin.as"], { name: signedIn.name })}</p>
        {!server && (
          <a href="/api/w/invite/login" className={buttonClass("secondary", "mt-2")}>
            {t["invite.signin.other"]}
          </a>
        )}
      </Step>
      <ServerStep t={t} signedIn={signedIn} />
      {server && (
        <Step id="invite-bot" head={t["invite.bot.head"]} done={roles !== null} t={t}>
          {roles === null ? (
            <>
              <p className="mt-1">{t["invite.bot.tip"]}</p>
              {props.installUrl && (
                <a
                  href={props.installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("primary", "mt-3 w-full")}
                >
                  {t["invite.bot.add"]}
                </a>
              )}
              {props.ready ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void load()}
                  className={buttonClass("secondary", "mt-2 w-full")}
                >
                  {busy ? t["invite.bot.checking"] : t["invite.bot.continue"]}
                </button>
              ) : (
                <p className="mt-2 font-semibold">{t["invite.err.bot_off"]}</p>
              )}
              <NoteLine note={note} />
            </>
          ) : (
            <p className="mt-1">{t["invite.bot.in"]}</p>
          )}
        </Step>
      )}
      {server && roles !== null && (
        <InviteRoles
          t={t}
          tag={props.tag}
          roles={roles}
          setRoles={setRoles}
          reload={load}
          rolesInstallUrl={props.rolesInstallUrl}
        />
      )}
    </>
  );
}
