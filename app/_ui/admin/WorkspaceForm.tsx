"use client";

// /admin's add-or-edit workspace form (D71, D73, D105). Picking a workspace, or the alliance it belongs to,
// loads its current address, server id, leadership role ids and member role ids, so editing one field never
// wipes another. "New workspace" starts empty. A save that would empty the member roles of a workspace
// that has some asks first, since it closes the members' board (amended 2026-11-17).
import { useState, type ReactNode } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import { copy } from "@/lib/copy";
import { fill } from "@/lib/words";

const t = copy.admin.workspaces;
export const FIELD = "drawn-field min-h-11 w-full px-3";
const LABEL_TEXT = "text-body-sm font-semibold";

export type Call = { url: string; body: unknown; ok: (answer: Record<string, unknown>) => string };
export type Run = (call: Call) => void;

/** What the form needs of a workspace: its settings as /admin shows them. */
export interface WorkspaceSettings {
  id: number;
  unionId: number;
  slug: string;
  guild: string;
  /** Ids joined with ", ". */
  roles: string;
  memberRoles: string;
}

export function Field(props: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className={LABEL_TEXT}>{props.label}</span>
      {props.children}
      {props.help && <span className="text-body-sm text-ink/70">{props.help}</span>}
    </label>
  );
}

const ids = (text: string) => text.split(/[\s,]+/).filter((s) => s !== "");
type Values = Omit<WorkspaceSettings, "id">;
const EMPTY: Omit<Values, "unionId"> = { slug: "", guild: "", roles: "", memberRoles: "" };
const loaded = (w: WorkspaceSettings): Values => ({
  unionId: w.unionId,
  slug: w.slug,
  guild: w.guild,
  roles: w.roles,
  memberRoles: w.memberRoles,
});
/** An alliance a workspace may be made for (D133: any alliance the board or a daily roster knows). */
export interface AllianceChoice {
  unionId: number;
  label: string;
}

function useWorkspaceForm(workspaces: WorkspaceSettings[], firstUnion: number) {
  const first = workspaces[0];
  const [editing, setEditing] = useState<number | null>(first?.id ?? null);
  const [values, setValues] = useState<Values>(
    first ? loaded(first) : { unionId: firstUnion, ...EMPTY },
  );
  const current = workspaces.find((w) => w.id === editing) ?? null;
  const pick = (id: number | null) => {
    const w = workspaces.find((x) => x.id === id);
    setEditing(w?.id ?? null);
    setValues(w ? loaded(w) : { unionId: values.unionId, ...EMPTY });
  };
  // An alliance with a workspace loads it; one without starts a new workspace for it.
  const pickAlliance = (unionId: number) => {
    const w = workspaces.find((x) => x.unionId === unionId);
    if (w) return pick(w.id);
    setEditing(null);
    setValues(current ? { unionId, ...EMPTY } : { ...values, unionId });
  };
  const set = (key: Exclude<keyof Values, "unionId">) => (value: string) =>
    setValues({ ...values, [key]: value });
  return { editing, current, values, pick, pickAlliance, set };
}

/** Which workspace is edited, and its alliance: picking either loads that workspace's settings. */
function Pickers(props: {
  workspaces: WorkspaceSettings[];
  alliances: AllianceChoice[];
  form: ReturnType<typeof useWorkspaceForm>;
}) {
  const { workspaces, alliances, form: f } = props;
  return (
    <>
      {workspaces.length > 0 && (
        <Field label={t.pick}>
          <select
            value={f.editing ?? ""}
            onChange={(e) => f.pick(e.target.value === "" ? null : Number(e.target.value))}
            className={FIELD}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                /w/{w.slug}
              </option>
            ))}
            <option value="">{t.adding}</option>
          </select>
        </Field>
      )}
      <Field label={t.alliance}>
        <select
          name="union_id"
          value={f.values.unionId}
          onChange={(e) => f.pickAlliance(Number(e.target.value))}
          className={FIELD}
        >
          {alliances.map((a) => (
            <option key={a.unionId} value={a.unionId}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function CloseBoardSheet(props: { onCancel: () => void; onSave: () => void }) {
  return (
    <Sheet
      labelledBy="close-board-title"
      title={t.closeBoard.title}
      words={t.signOutUsers.sheet}
      onCancel={props.onCancel}
      primary={{ label: t.closeBoard.yes, onClick: props.onSave }}
    >
      <p>{t.closeBoard.ask}</p>
    </Sheet>
  );
}

export function WorkspaceForm({
  workspaces,
  alliances,
  run,
}: {
  workspaces: WorkspaceSettings[];
  alliances: AllianceChoice[];
  run: Run;
}) {
  const f = useWorkspaceForm(workspaces, alliances[0]?.unionId ?? 0);
  const [asking, setAsking] = useState(false);
  const { values } = f;
  const send = () => {
    setAsking(false);
    run({
      url: "/api/admin/workspaces",
      ok: () => t.saved,
      body: {
        union_id: values.unionId,
        slug: values.slug.trim(),
        discord_guild_id: values.guild.trim(),
        leader_role_ids: ids(values.roles),
        member_role_ids: ids(values.memberRoles),
      },
    });
  };
  const closesBoard =
    f.current !== null &&
    ids(f.current.memberRoles).length > 0 &&
    ids(values.memberRoles).length === 0;
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (closesBoard) setAsking(true);
    else send();
  };
  const text = (key: "slug" | "guild" | "roles" | "memberRoles") => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => f.set(key)(e.target.value),
    autoComplete: "off",
    className: FIELD,
  });
  return (
    <>
      <form onSubmit={save} className="mt-6 grid gap-3 sm:max-w-xl">
        <h3 className="font-subhead text-display-sm">
          {f.current ? fill(t.editing, { slug: f.current.slug }) : t.adding}
        </h3>
        <p className="text-body-sm text-ink/70">{t.editHelp}</p>
        <Pickers workspaces={workspaces} alliances={alliances} form={f} />
        <Field label={t.guild}>
          <input name="guild" required inputMode="numeric" {...text("guild")} />
        </Field>
        <Field label={t.roles} help={t.rolesHelp}>
          <input name="roles" required {...text("roles")} />
        </Field>
        <Field label={t.memberRoles} help={t.memberRolesHelp}>
          <input name="member_roles" {...text("memberRoles")} />
        </Field>
        <Field label={t.slug} help={t.slugHelp}>
          <input name="slug" required autoCapitalize="none" {...text("slug")} />
        </Field>
        <button type="submit" className={buttonClass("primary", "font-semibold")}>
          {t.save}
        </button>
      </form>
      {asking && <CloseBoardSheet onCancel={() => setAsking(false)} onSave={send} />}
    </>
  );
}
