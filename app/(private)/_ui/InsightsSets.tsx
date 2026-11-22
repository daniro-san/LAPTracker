// Insights' counts that open their members (issue 678), server-rendered: a native <details> whose summary is
// the count's own row (44 px, nothing hover-only), and the members' names under it in name order with
// nothing beside a name (D75), each a 44 px link to their card. Per-member names are ph-no-capture (issue 549).
import type { ReactNode } from "react";

import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { MemberSet, Who } from "@/lib/private/insights-sets";

/** A member's card from a set: Members' card (`?m=`, D122), or the former members' view for a leaver. */
const cardHref = (slug: string, p: Who) =>
  `/w/${slug}/members?${p.current ? "" : "view=former&"}m=${p.uid}`;

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

/** A set's names, in two columns at 360 px, with a plum line beside them that ties them to their row. */
export function Names({ set, slug, label }: { set: MemberSet; slug: string; label: string }) {
  return (
    <ul
      aria-label={label}
      className="ph-no-capture ms-1 mb-2 grid grid-cols-2 gap-x-4 border-s-2 border-plum/30 ps-3 sm:grid-cols-3"
    >
      {/* A flow week lists moves: one person can be in it twice. */}
      {set.people.map((p, i) => (
        <li key={`${p.uid}-${i}`} className="min-w-0">
          <a href={cardHref(slug, p)} className="text-link flex min-h-11 min-w-0 items-center">
            <bdi translate="no" className="name-fit">
              {p.name}
            </bdi>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * A count that opens its members in place: its id is the open set's address fragment (`#who-<key>`) and
 * `data-set` its analytics kind, both read by `InsightsSetMemory`.
 */
export function SetFold(props: {
  kind: MemberSet["kind"];
  setKey: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <details id={`who-${props.setKey}`} data-set={props.kind} className="group/set">
      <summary className="tint-button flex min-h-11 cursor-pointer list-none flex-col justify-center py-1.5 focus-visible:outline-plum [&::-webkit-details-marker]:hidden">
        {props.summary}
      </summary>
      {props.children}
    </details>
  );
}

/** "Tap a count to see who.", once per card with sets, above its first one. */
export const TapHint = ({ t }: { t: WorkspaceDictionary }) => (
  <p className="mt-1 text-body-sm text-ink/80">{t["insights.tapHint"]}</p>
);
