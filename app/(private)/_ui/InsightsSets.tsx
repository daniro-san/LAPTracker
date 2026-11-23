// Insights' counts that open their members (issue 678; D158 rule 7 (c)), server-rendered. A count's row is
// the tap target (44 px, nothing hover-only). Up to 12 names open in place, in a native <details> under the
// row; 13 to 60 open in the sheet below 1024 px or the side pane from 1024 px (SetSheet), titled with the
// chart's own sentence; past 60 the row links straight to Members `?set=`. The names are in name order with
// nothing beside a name (D75), each a 44 px link to their card, and end with "Open these n in Members ›",
// which Members builds again with the same function. Per-member names are ph-no-capture (issue 549).
import type { ReactNode } from "react";

import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { INLINE_MAX, SHEET_MAX, type MemberSet, type Who } from "@/lib/private/insights-sets";

import { SetSheet } from "./SetSheet";
import { sheetWords } from "./sheet-words";

/** A member's card from a set: Members' card (`?m=`, D122), or the former members' view for a leaver. */
const cardHref = (slug: string, p: Who) =>
  `/w/${slug}/members?${p.current ? "" : "view=former&"}m=${p.uid}`;

/** Members showing exactly this set (`?set=<kind>:<key>`). */
export const membersHref = (slug: string, set: Pick<MemberSet, "kind" | "key">) =>
  `/w/${slug}/members?set=${set.kind}:${set.key}`;

const ONWARD =
  "mt-1 inline-flex min-h-11 items-center text-body-sm font-semibold text-plum underline underline-offset-4";

/** The ▾ after a set's count; it turns while the set is open. */
export function Caret() {
  return (
    <span
      aria-hidden="true"
      className="ml-1 inline-block text-plum group-open/set:rotate-180 motion-safe:transition-transform"
    >
      ▾
    </span>
  );
}

/** "Open these n in Members ›" for a set. */
export function Onward({ set, slug }: { set: MemberSet; slug: string }) {
  if (!set.onward) return null;
  return (
    <a href={membersHref(slug, set)} className={ONWARD}>
      {set.onward}
    </a>
  );
}

/**
 * A set's names, in two columns at 360 px, with a plum line beside them that ties them to their row, then
 * "Open these n in Members ›" (not for a week's leavers: Members lists current members).
 */
export function Names(props: { set: MemberSet; slug: string; label: string }) {
  const { set, slug } = props;
  return (
    <div className="ms-1 mb-2 border-s-2 border-plum/30 ps-3">
      <ul
        aria-label={props.label}
        className="ph-no-capture grid grid-cols-2 items-start gap-x-4 sm:grid-cols-3"
      >
        {/* A flow week lists moves: one person can be in it twice. */}
        {set.people.map((p, i) => (
          <li key={`${p.uid}-${i}`} className="min-w-0">
            <a href={cardHref(slug, p)} className="text-link flex min-h-11 min-w-0 items-center">
              {/* A long name wraps between words inside its column, never past the card's edge (issue 720, .name-fit). */}
              <bdi translate="no" className="name-fit min-w-0">
                {p.name}
              </bdi>
            </a>
          </li>
        ))}
      </ul>
      <Onward set={set} slug={slug} />
    </div>
  );
}

const SUMMARY =
  "tint-button flex min-h-11 w-full cursor-pointer list-none flex-col justify-center py-1.5 text-start focus-visible:outline-plum [&::-webkit-details-marker]:hidden";

/**
 * A count that opens its members: its id is the open set's address fragment (`#who-<key>`), `data-set` its
 * analytics kind and `data-count` how many it opens (sent only as a bucket), read by `InsightsSetMemory`
 * (in place) or `SetSheet` (sheet and pane). `far` is Members' address for a set past 60, or null.
 */
export function SetFold(props: {
  kind: MemberSet["kind"];
  setKey: string;
  count: number;
  /** The chart's own sentence, the sheet's title. */
  title: string;
  far: string | null;
  summary: ReactNode;
  t: WorkspaceDictionary;
  children: ReactNode;
}) {
  if (props.count > SHEET_MAX && props.far)
    return (
      <a href={props.far} className={SUMMARY}>
        {props.summary}
      </a>
    );
  if (props.count > INLINE_MAX)
    return (
      <SetSheet
        kind={props.kind}
        setKey={props.setKey}
        count={props.count}
        title={props.title}
        summary={props.summary}
        words={sheetWords(props.t)}
        className={SUMMARY}
      >
        {props.children}
      </SetSheet>
    );
  return (
    <details
      id={`who-${props.setKey}`}
      data-set={props.kind}
      data-count={props.count}
      className="group/set"
    >
      <summary className={SUMMARY}>{props.summary}</summary>
      {props.children}
    </details>
  );
}

/** A set's fold over its own names: the row, then the names under it, in place or in the sheet. */
export function SetRow(props: {
  set: MemberSet;
  slug: string;
  label: string;
  summary: ReactNode;
  t: WorkspaceDictionary;
}) {
  const { set } = props;
  return (
    <SetFold
      kind={set.kind}
      setKey={set.key}
      count={set.people.length}
      title={set.title}
      far={set.onward ? membersHref(props.slug, set) : null}
      summary={props.summary}
      t={props.t}
    >
      <Names set={set} slug={props.slug} label={props.label} />
    </SetFold>
  );
}

/** "Tap a count to see who.", once per card with sets, above its first one. */
export const TapHint = ({ t }: { t: WorkspaceDictionary }) => (
  <p className="mt-1 text-body-sm text-ink/80">{t["insights.tapHint"]}</p>
);
