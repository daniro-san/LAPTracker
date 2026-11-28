"use client";

// Alliance settings → Discord → Member role (issue 868): the role the bot gives when an officer approves a
// `/join` request. "Choose a role" asks the server for the roles the bot may give (below its own highest);
// "Check and save" sends the pick, which the server checks with Discord again before saving. Remove: approved
// members get no role. Only role names reach the browser.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { fill } from "@/lib/words";

import { postDiscord, type Note, NoteLine } from "./discord-send";

const REFUSALS: Record<string, keyof WorkspaceDictionary> = {
  bot_missing: "discord.check.missing",
  unreachable: "discord.check.unreachable",
  rate_limited: "discord.check.rateLimited",
  bot_off: "discord.check.off",
  not_below: "join.role.notBelow",
};

type Role = { id: string; name: string };

/** The roles Discord offered, with Check and save and Cancel. */
function RolePicker(props: {
  picker: {
    roles: Role[];
    pick: string;
    setPick: (id: string) => void;
    busy: boolean;
    save: () => void;
    cancel: () => void;
  };
  t: WorkspaceDictionary;
}) {
  const { roles, pick, setPick, busy, save, cancel } = props.picker;
  const { t } = props;
  return (
    <div className="mt-3">
      <label htmlFor="member-role" className="font-medium">
        {t["join.role.pick"]}
      </label>
      <select
        id="member-role"
        value={pick}
        onChange={(e) => setPick(e.target.value)}
        className={`${FIELD} mt-1 block w-full text-[16px]`}
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={save} className={buttonClass("primary")}>
          {busy ? t["join.role.loading"] : t["join.role.save"]}
        </button>
        <button type="button" disabled={busy} onClick={cancel} className={buttonClass("secondary")}>
          {t["join.role.cancel"]}
        </button>
      </div>
    </div>
  );
}

export function DiscordMemberRole(props: {
  slug: string;
  role: string | null;
  t: WorkspaceDictionary;
}) {
  const { slug, t } = props;
  const router = useRouter();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const refused = (code: string, refusal: string | null) =>
    setNote({ ok: false, text: refusal ?? t[REFUSALS[code] ?? "join.failed"] });

  async function send(body: object, done: (json: Record<string, unknown>) => void) {
    setBusy(true);
    setNote(null);
    const res = await postDiscord(slug, body);
    setBusy(false);
    if (res.code) return refused(res.code, res.refusal);
    done(res.body);
  }

  const choose = () =>
    send({ action: "roles" }, (json) => {
      const listed = (json.roles as Role[] | undefined) ?? [];
      setRoles(listed);
      setPick(listed[0]?.id ?? "");
      if (listed.length === 0) setNote({ ok: false, text: t["join.role.empty"] });
    });
  const save = () =>
    send({ action: "member_role", role: pick }, () => {
      setRoles(null);
      setNote({ ok: true, text: t["join.role.saved"] });
      router.refresh();
    });
  const remove = () =>
    send({ action: "remove_member_role" }, () => {
      setNote({ ok: true, text: t["join.role.removed"] });
      router.refresh();
    });

  return (
    <div className="mt-6">
      <h3 id="discord-member-role" className="font-subhead text-body-lg font-semibold">
        {t["join.role.head"]}
      </h3>
      <p className="mt-1">{t["join.role.lead"]}</p>
      <p className="mt-1 text-body-sm text-ink/80">{t["join.role.reinstall"]}</p>
      <p className="mt-2 font-semibold break-words">
        {props.role === null
          ? t["join.role.unset"]
          : fill(t["join.role.set"], { name: props.role })}
      </p>
      {roles && roles.length > 0 ? (
        <RolePicker
          picker={{ roles, pick, setPick, busy, save, cancel: () => setRoles(null) }}
          t={t}
        />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={choose} className={buttonClass("primary")}>
            {busy ? t["join.role.loading"] : t["join.role.choose"]}
          </button>
          {props.role !== null && (
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className={buttonClass("secondary")}
            >
              {t["join.role.remove"]}
            </button>
          )}
        </div>
      )}
      <NoteLine note={note} />
    </div>
  );
}
