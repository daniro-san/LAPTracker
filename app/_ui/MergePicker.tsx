// The merge simulator's picker (D84, issue 282): a plain GET form, as the compare page's is (D57), so the URL holds
// the two alliances, it works without JavaScript and can be shared. The swap link flips A and B.
import Link from "next/link";

import { buttonClass } from "@/lib/brand/components/Button";
import type { Dictionary } from "@/lib/copy";
import type { MergeAlliance } from "@/lib/queries";

import { allianceLabel } from "./format";
import { LABEL } from "./StatTable";

export const MERGE_PATH = "/alliances/merge";

/** `/alliances/merge?a=1&b=2`; either side may be missing. */
export function mergeHref(a: number | null, b: number | null) {
  const q = new URLSearchParams();
  if (a !== null) q.set("a", String(a));
  if (b !== null) q.set("b", String(b));
  return `${MERGE_PATH}${q.size ? `?${q}` : ""}`;
}

function AllianceSelect({
  name,
  letter,
  label,
  value,
  choices,
  placeholder,
}: {
  name: string;
  letter: string;
  label: string;
  value: number | null;
  choices: MergeAlliance[];
  placeholder: string;
}) {
  return (
    <label className="min-w-0">
      <span className={`${LABEL} block`} aria-hidden="true">
        {letter}
      </span>
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="drawn-field min-h-11 w-full min-w-0 px-3 text-base"
      >
        <option value="">{placeholder}</option>
        {choices.map((c) => (
          <option key={c.unionId} value={c.unionId}>
            {allianceLabel(c.tag, c.name)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MergePicker({
  choices,
  a,
  b,
  copy,
}: {
  choices: MergeAlliance[];
  a: number | null;
  b: number | null;
  copy: Dictionary;
}) {
  const m = copy.merge;
  return (
    <form
      method="get"
      action={MERGE_PATH}
      className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
    >
      <AllianceSelect
        name="a"
        letter="A"
        label={m.first}
        value={a}
        choices={choices}
        placeholder={m.choose}
      />
      <Link
        href={mergeHref(b, a)}
        aria-label={m.swap}
        className="tint-button inline-flex min-h-11 min-w-11 items-center justify-center font-medium text-plum"
      >
        <span aria-hidden="true">⇄</span>
      </Link>
      <AllianceSelect
        name="b"
        letter="B"
        label={m.second}
        value={b}
        choices={choices}
        placeholder={m.choose}
      />
      <button type="submit" className={buttonClass("primary", "col-span-full sm:col-span-1")}>
        {m.action}
      </button>
    </form>
  );
}
