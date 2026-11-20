"use client";

// /w/invite step 4 (D130, issue 453): who gets in. The leadership roles (one or more) open the Officers' Desk,
// the member roles (optional) the members' board. Or "Create them here": after "Allow LAPTracker to create
// roles" (Discord's page again, with Manage Roles, for this server only), two roles with no permissions,
// named with the alliance's own tag and editable, and "Give me the leadership role". If Discord refuses,
// the page says why in plain words and the lists stay. Then "Open our Officers' Desk".
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { CheckField } from "@/lib/brand/components/CheckField";
import { FIELD } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { errorText, NoteLine, postInvite, Step, type Note } from "./invite-client";

export interface RoleView {
  id: string;
  name: string;
  color: number;
}

const dot = (color: number) => (color ? `#${color.toString(16).padStart(6, "0")}` : "transparent");

function RoleList(props: {
  legend: string;
  help: string;
  roles: RoleView[];
  chosen: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <fieldset className="mt-3">
      <legend className="font-semibold">{props.legend}</legend>
      <p className="text-body-sm text-ink/75">{props.help}</p>
      <div className="mt-1 grid gap-1">
        {props.roles.map((r) => (
          <CheckField
            key={r.id}
            checked={props.chosen.has(r.id)}
            onChange={() => props.toggle(r.id)}
            label={
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block size-3 shrink-0 rounded-full border border-ink/30"
                  style={{ background: dot(r.color) }}
                />
                <bdi className="break-words">{r.name}</bdi>
              </span>
            }
          />
        ))}
      </div>
    </fieldset>
  );
}

function NameField(props: { label: string; value: string; set: (v: string) => void }) {
  return (
    <label className="mt-3 grid gap-1">
      <span className="text-body-sm font-semibold">{props.label}</span>
      <input
        value={props.value}
        maxLength={100}
        onChange={(e) => props.set(e.target.value)}
        className={FIELD}
      />
    </label>
  );
}

/** "Open our Officers' Desk": the workspace made, `ws_invite_completed`, then the Desk itself. */
function Finish(props: {
  t: WorkspaceDictionary;
  leaders: Set<string>;
  members: Set<string>;
  created: boolean;
}) {
  const { t, leaders, members } = props;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const finish = async () => {
    if (leaders.size === 0) return setNote({ ok: false, text: t["invite.finish.pick"] });
    setBusy(true);
    const answer = await postInvite({
      action: "finish",
      leader_role_ids: [...leaders],
      member_role_ids: [...members].filter((id) => !leaders.has(id)),
    });
    if (answer.code || typeof answer.body.slug !== "string") {
      setBusy(false);
      return setNote({ ok: false, text: errorText(t, answer.code ?? "failed") });
    }
    track("ws_invite_completed", { roles_created: props.created });
    window.location.assign(`/w/${answer.body.slug}`);
  };
  return (
    <div className="mt-4 border-t border-ink/15 pt-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void finish()}
        className={buttonClass("primary", "w-full font-semibold")}
      >
        {busy ? t["invite.finish.creating"] : t["invite.finish.button"]}
      </button>
      <p className="mt-2 text-body-sm text-ink/75">{t["invite.finish.note"]}</p>
      <NoteLine note={note} />
    </div>
  );
}

function CreateRoles(props: {
  t: WorkspaceDictionary;
  tag: string;
  rolesInstallUrl: string | null;
  onMade: (made: RoleView[]) => void;
}) {
  const { t } = props;
  const [leader, setLeader] = useState(`[${props.tag}] Leadership`);
  const [member, setMember] = useState(`[${props.tag}] Members`);
  const [giveMe, setGiveMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const create = async () => {
    setBusy(true);
    const body = { action: "create_roles", leader, member: member.trim() || null, give_me: giveMe };
    const answer = await postInvite(body);
    setBusy(false);
    if (answer.code === "no_permission")
      return setNote({ ok: false, text: t["invite.create.noPermission"] });
    if (answer.code) return setNote({ ok: false, text: errorText(t, answer.code) });
    const made = (answer.body.roles as RoleView[] | null) ?? [];
    props.onMade(made);
    const list = made.map((r) => r.name).join(", ");
    const refused = answer.body.gave === "refused" || answer.body.gave === "unreachable";
    const lines = [
      fill(t["invite.create.made"], { list }),
      answer.body.member_failed ? t["invite.create.memberFailed"] : "",
      refused ? t["invite.create.gaveRefused"] : "",
    ];
    setNote({
      ok: !answer.body.member_failed,
      text: lines.filter(Boolean).join(" "),
    });
  };
  return (
    <details className="mt-4 border-t border-ink/15 pt-3">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-plum">
        {t["invite.create.head"]}
      </summary>
      <p className="mt-1">{t["invite.create.lead"]}</p>
      {props.rolesInstallUrl && (
        <a
          href={props.rolesInstallUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("secondary", "mt-2 w-full")}
        >
          {t["invite.create.allow"]}
        </a>
      )}
      <NameField label={t["invite.create.leader"]} value={leader} set={setLeader} />
      <NameField label={t["invite.create.member"]} value={member} set={setMember} />
      <div className="mt-2">
        <CheckField
          label={t["invite.create.giveMe"]}
          checked={giveMe}
          onChange={(e) => setGiveMe(e.target.checked)}
        />
      </div>
      <button
        type="button"
        disabled={busy || leader.trim() === ""}
        onClick={() => void create()}
        className={buttonClass("secondary", "mt-2 w-full")}
      >
        {busy ? t["invite.create.creating"] : t["invite.create.button"]}
      </button>
      <NoteLine note={note} />
    </details>
  );
}

export function InviteRoles(props: {
  t: WorkspaceDictionary;
  tag: string;
  roles: RoleView[];
  setRoles: (roles: RoleView[]) => void;
  reload: () => Promise<void>;
  rolesInstallUrl: string | null;
}) {
  const { t, roles } = props;
  const [leaders, setLeaders] = useState(new Set<string>());
  const [members, setMembers] = useState(new Set<string>());
  const [created, setCreated] = useState(false);
  const flip = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    return next;
  };
  const onMade = (made: RoleView[]) => {
    setCreated(true);
    props.setRoles([...made, ...roles.filter((r) => !made.some((m) => m.id === r.id))]);
    if (made[0]) setLeaders(new Set([...leaders, made[0].id]));
    if (made[1]) setMembers(new Set([...members, made[1].id]));
  };
  return (
    <Step id="invite-roles" head={t["invite.roles.head"]} t={t}>
      {roles.length === 0 ? (
        <p className="mt-1">{t["invite.roles.none"]}</p>
      ) : (
        <>
          <RoleList
            legend={t["invite.roles.leaders"]}
            help={t["invite.roles.leadersHelp"]}
            roles={roles}
            chosen={leaders}
            toggle={(id) => setLeaders(flip(leaders, id))}
          />
          <RoleList
            legend={t["invite.roles.members"]}
            help={t["invite.roles.membersHelp"]}
            roles={roles}
            chosen={members}
            toggle={(id) => setMembers(flip(members, id))}
          />
        </>
      )}
      <p className="mt-3 text-body-sm text-ink/75">{t["invite.roles.assign"]}</p>
      <button
        type="button"
        onClick={() => void props.reload()}
        className={buttonClass("secondary", "mt-2")}
      >
        {t["invite.roles.reload"]}
      </button>
      <CreateRoles t={t} tag={props.tag} rolesInstallUrl={props.rolesInstallUrl} onMade={onMade} />
      <Finish t={t} leaders={leaders} members={members} created={created} />
    </Step>
  );
}
