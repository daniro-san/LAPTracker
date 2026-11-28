"use client";

// A KvK plan's editor (issue 790, D161): each role with its name, its people as chips (× takes one out) and
// "Add people", which opens a sheet of the members the roll call asks (away members left out, D103),
// searchable by name. A note, then Save and "Make the message". Save names the version it started from (a
// 409 says another officer saved first). "Make the message" builds from the saved plan only, so it is off
// while there are unsaved changes; one request id per message (D100), so a double tap makes one notice.
// Roles are jobs, never a ranking (D75): no numbers, people in name order.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip, FIELD } from "@/lib/brand/components/controls";
import { Sheet, type SheetWords } from "@/lib/brand/components/Sheet";
import type { KvkPlanWords } from "@/lib/private/dictionary.kvk-plan";
import { NOTE_MAX, ROLE_MAX, ROLE_NAME_MAX } from "@/lib/private/kvk-plan-message";
import { searchRoster } from "@/lib/private/roster-search";
import { fill } from "@/lib/words";

import { Labeled, TextInput } from "./CalendarFields";
import { newRequestId } from "./request-id";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Member = { uid: number; name: string; away: boolean };
type Role = { key: number; name: string; uids: number[] };
type State = "idle" | "saving" | "saved" | "making";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

const byName = (members: Map<number, Member>) => (a: number, b: number) =>
  (members.get(a)?.name ?? "").localeCompare(members.get(b)?.name ?? "", "en") || a - b;

function RoleCard(props: {
  role: Role;
  members: Map<number, Member>;
  words: KvkPlanWords;
  onChange: (role: Role) => void;
  onRemove: () => void;
  onPick: () => void;
}) {
  const { role, words } = props;
  const id = `kvk-role-${role.key}`;
  return (
    <li className="border-t border-rule py-3">
      <Labeled id={id} label={words["kvkPlan.roleName"]}>
        <TextInput
          id={id}
          value={role.name}
          maxLength={ROLE_NAME_MAX}
          onChange={(e) => props.onChange({ ...role, name: e.target.value })}
        />
      </Labeled>
      {role.uids.length === 0 ? (
        <p className="mt-2 text-body-sm">{words["kvkPlan.nobody"]}</p>
      ) : (
        <ul className="ph-no-capture mt-2 flex flex-wrap gap-2">
          {[...role.uids].sort(byName(props.members)).map((uid) => {
            const name = props.members.get(uid)?.name ?? "";
            return (
              <li key={uid}>
                <button
                  type="button"
                  className={chip()}
                  aria-label={fill(words["kvkPlan.removePerson"], { name, role: role.name })}
                  onClick={() =>
                    props.onChange({ ...role, uids: role.uids.filter((u) => u !== uid) })
                  }
                >
                  <span translate="no">{name}</span>
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        <button type="button" className={buttonClass("secondary")} onClick={props.onPick}>
          {words["kvkPlan.add"]}
        </button>
        <button type="button" className={LINK} onClick={props.onRemove}>
          {words["kvkPlan.removeRole"]}
        </button>
      </p>
    </li>
  );
}

function PeopleSheet(props: {
  role: Role;
  members: Member[];
  words: KvkPlanWords;
  sheet: SheetWords;
  onAdd: (uid: number) => void;
  onClose: () => void;
}) {
  const { words, role } = props;
  const [query, setQuery] = useState("");
  const coming = props.members.filter((m) => !m.away);
  const shown = query.trim() === "" ? coming : searchRoster(query, coming);
  return (
    <Sheet
      labelledBy="kvk-pick-title"
      onCancel={props.onClose}
      title={fill(words["kvkPlan.pick.title"], { role: role.name })}
      words={props.sheet}
    >
      {props.members.length === 0 ? (
        <p className="mt-3">{words["kvkPlan.pick.noRoster"]}</p>
      ) : (
        <Labeled
          id="kvk-pick-q"
          label={words["kvkPlan.pick.search"]}
          hint={words["kvkPlan.pick.hint"]}
        >
          <TextInput
            id="kvk-pick-q"
            type="search"
            autoComplete="off"
            maxLength={64}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Labeled>
      )}
      {query.trim() !== "" && shown.length === 0 && (
        <p className="mt-3">{words["kvkPlan.pick.none"]}</p>
      )}
      <ul className="ph-no-capture mt-2">
        {shown.map((m) => {
          const added = role.uids.includes(m.uid);
          return (
            <li key={m.uid} className="border-t border-rule">
              <button
                type="button"
                disabled={added}
                onClick={() => props.onAdd(m.uid)}
                className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left disabled:opacity-60"
              >
                <span translate="no" className="min-w-0 truncate font-semibold">
                  {m.name}
                </span>
                <span className="shrink-0 text-body-sm text-plum">
                  {added ? words["kvkPlan.pick.added"] : words["kvkPlan.pick.add"]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

type Answer = { code?: string; rev?: number; id?: number } | null;

async function postPlan(slug: string, body: object): Promise<{ ok: boolean; json: Answer }> {
  const res = await fetch(`/api/w/${slug}/kvk-plan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return { ok: res?.ok === true, json: (await res?.json().catch(() => null)) as Answer };
}

const SAVE_REFUSAL: Record<string, keyof KvkPlanWords> = {
  stale: "kvkPlan.stale",
  invalid: "kvkPlan.invalid",
};

/** The line under the buttons: what is happening, or why "Make the message" is off. */
function statusOf(
  words: KvkPlanWords,
  s: { unnamed: boolean; state: State; dirty: boolean; saved: boolean },
): string {
  if (s.unnamed) return words["kvkPlan.nameEmpty"];
  if (s.state === "saving") return words["kvkPlan.saving"];
  if (s.state === "making") return words["kvkPlan.making"];
  if (s.dirty) return words["kvkPlan.makeSaveFirst"];
  if (s.state === "saved") return words["kvkPlan.saved"];
  return words[s.saved ? "kvkPlan.makeHint" : "kvkPlan.unsaved"];
}

type Props = {
  slug: string;
  entry: number;
  week: string;
  roles: { name: string; uids: number[] }[];
  /** No plan saved yet: the roles are the suggestions. */
  suggested: boolean;
  note: string;
  rev: number;
  members: Member[];
  noticeId: number | null;
  words: KvkPlanWords;
  sheet: SheetWords;
};

/** The plan being edited, and its two writes. */
function usePlan(props: Props) {
  const { words } = props;
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>(() => props.roles.map((r, key) => ({ key, ...r })));
  const [note, setNote] = useState(props.note);
  const [rev, setRev] = useState(props.rev);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(!props.suggested);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [requestId] = useState(() => newRequestId());
  const changed = () => {
    setDirty(true);
    if (state === "saved") setState("idle");
  };
  async function save() {
    setState("saving");
    setError(null);
    const plan = roles.map((r) => ({ name: r.name.trim(), uids: r.uids }));
    const body = { action: "save", entry: props.entry, rev, roles: plan, note };
    const { ok, json } = await postPlan(props.slug, body);
    if (ok && json?.rev !== undefined) {
      setRev(json.rev);
      setDirty(false);
      setSaved(true);
      return setState("saved");
    }
    setState("idle");
    const code = json?.code ?? "failed";
    setError(code === SIGNED_OUT ? SIGNED_OUT : words[SAVE_REFUSAL[code] ?? "kvkPlan.failed"]);
  }
  async function make() {
    setState("making");
    setError(null);
    const body = { action: "message", entry: props.entry, week: props.week, requestId };
    const { ok, json } = await postPlan(props.slug, body);
    if (ok && json?.id !== undefined) return router.push(`/w/${props.slug}/notices/${json.id}`);
    setState("idle");
    setError(json?.code === SIGNED_OUT ? SIGNED_OUT : words["kvkPlan.makeFailed"]);
  }
  const editRoles = (change: Role[]) => {
    setRoles(change);
    changed();
  };
  const editNote = (value: string) => {
    setNote(value);
    changed();
  };
  return { roles, note, dirty, saved, state, error, editRoles, editNote, save, make };
}

function PlanActions(props: {
  plan: ReturnType<typeof usePlan>;
  unnamed: boolean;
  slug: string;
  noticeId: number | null;
  words: KvkPlanWords;
}) {
  const { plan, words } = props;
  const busy = plan.state === "saving" || plan.state === "making";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-rule pt-3">
      <button
        type="button"
        disabled={busy || props.unnamed || (!plan.dirty && plan.saved)}
        onClick={() => void plan.save()}
        className={buttonClass("secondary")}
      >
        {words["kvkPlan.save"]}
      </button>
      <button
        type="button"
        disabled={busy || plan.dirty}
        onClick={() => void plan.make()}
        className={buttonClass("primary")}
      >
        {words["kvkPlan.make"]}
      </button>
      <p role="status" className="w-full text-body-sm">
        {statusOf(words, { ...plan, unnamed: props.unnamed })}
      </p>
      {plan.error && (
        <RefusalLine
          text={plan.error}
          className="w-full border-l-4 border-seal pl-3 text-body-sm"
        />
      )}
      {props.noticeId !== null && (
        <a href={`/w/${props.slug}/notices/${props.noticeId}`} className={LINK}>
          {words["kvkPlan.lastMessage"]}
        </a>
      )}
    </div>
  );
}

export function KvkPlanEditor(props: Props) {
  const { words } = props;
  const plan = usePlan(props);
  const { roles } = plan;
  const byUid = new Map(props.members.map((m) => [m.uid, m]));
  const [next, setNext] = useState(props.roles.length);
  const [picking, setPicking] = useState<number | null>(null);
  const set = (role: Role) => plan.editRoles(roles.map((r) => (r.key === role.key ? role : r)));
  const pickRole = roles.find((r) => r.key === picking);
  return (
    <>
      {!plan.saved && <p className="mt-4 text-body-sm">{words["kvkPlan.suggested"]}</p>}
      <ul className="mt-2">
        {roles.map((role) => (
          <RoleCard
            key={role.key}
            role={role}
            members={byUid}
            words={words}
            onChange={set}
            onRemove={() => plan.editRoles(roles.filter((r) => r.key !== role.key))}
            onPick={() => setPicking(role.key)}
          />
        ))}
      </ul>
      {roles.length < ROLE_MAX && (
        <p className="border-t border-rule pt-3">
          <button
            type="button"
            className={buttonClass("secondary")}
            onClick={() => {
              plan.editRoles([...roles, { key: next, name: words["kvkPlan.newRole"], uids: [] }]);
              setNext(next + 1);
            }}
          >
            {words["kvkPlan.addRole"]}
          </button>
        </p>
      )}
      <div className="mt-4 border-t border-rule pt-3">
        <Labeled id="kvk-note" label={words["kvkPlan.note"]} hint={words["kvkPlan.noteHint"]}>
          <textarea
            id="kvk-note"
            aria-describedby="kvk-note-note"
            rows={4}
            maxLength={NOTE_MAX}
            value={plan.note}
            onChange={(e) => plan.editNote(e.target.value)}
            className={FIELD}
          />
        </Labeled>
      </div>
      <PlanActions
        plan={plan}
        unnamed={roles.some((r) => r.name.trim() === "")}
        slug={props.slug}
        noticeId={props.noticeId}
        words={words}
      />
      {pickRole && (
        <PeopleSheet
          role={pickRole}
          members={props.members}
          words={words}
          sheet={props.sheet}
          onAdd={(uid) => set({ ...pickRole, uids: [...pickRole.uids, uid] })}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}
