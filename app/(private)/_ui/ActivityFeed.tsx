"use client";

// Home's "Recent activity" lines (D108, 2026-11-18). The first page comes from the server; "Show more"
// reads the next page from /api/w/[slug]/activity with the cursor, "Show less" goes back to the first page
// and puts the focus on "Show more", so the page does not jump. A run ("Rook added 6 entries to the
// Calendar") is a <details> that opens its lines in place, without script; every control is 44 px. A run of
// new members added opens their names instead (drilldown batch C).
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { countBucket } from "@/lib/analytics/count-bucket";
import { track } from "@/lib/analytics/events";
import type { ActivityPageView, ActivityView } from "@/lib/private/desk-activity-words";

import { collapsed, listOf, withPage } from "./activity-list";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

const Ago = ({ line }: { line: Pick<ActivityView, "at" | "ago"> }) => (
  <span className="whitespace-nowrap text-body-sm text-ink/70">
    {" · "}
    <time dateTime={line.at}>{line.ago}</time>
  </span>
);

/**
 * "Rook added 3 new members" opens its names in name order, two columns at 360 px, each wrapping in full
 * (drilldown batch C): the count's own array. Typed names with no card yet, so plain text.
 */
const Names = ({ names }: { names: string[] }) => (
  <ul className="ph-no-capture mb-2 ml-1 grid grid-cols-2 gap-x-4 border-l-2 border-rule pl-3 sm:grid-cols-3">
    {names.map((name, i) => (
      <li key={`${name}-${i}`} className="flex min-h-11 min-w-0 items-center break-words">
        <bdi translate="no" className="min-w-0">
          {name}
        </bdi>
      </li>
    ))}
  </ul>
);

function Line({ line, onNames }: { line: ActivityView; onNames: (n: number) => void }) {
  if (line.run.length === 0) {
    return (
      <li className="py-2">
        {line.text}
        <Ago line={line} />
      </li>
    );
  }
  const { names } = line;
  return (
    <li>
      <details
        className="group"
        onToggle={(e) => {
          if (names && e.currentTarget.open) onNames(names.length);
        }}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 py-2 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            {line.text}
            <Ago line={line} />
          </span>
          <span aria-hidden="true" className="inline-block text-plum group-open:rotate-180">
            ▾
          </span>
        </summary>
        {names ? (
          <Names names={names} />
        ) : (
          <ul className="mb-2 ml-1 border-l-2 border-rule pl-3">
            {line.run.map((one, i) => (
              <li key={`${one.at}-${i}`} className="py-1 text-body-sm">
                {one.text}
                <Ago line={one} />
              </li>
            ))}
          </ul>
        )}
      </details>
    </li>
  );
}

/** A new-members line opened: `ws_drilldown_opened` once per page view, a bucket of the names only. */
function useNamesOpened() {
  const sent = useRef(false);
  return (n: number) => {
    if (sent.current) return;
    sent.current = true;
    track("ws_drilldown_opened", {
      surface: "home",
      kind: "new_members",
      count_bucket: countBucket(n),
    });
  };
}

const TEXT_BUTTON =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4 disabled:opacity-60";

export function ActivityFeed(props: {
  slug: string;
  first: ActivityPageView;
  words: { more: string; less: string; failed: string };
}) {
  const { words } = props;
  const [list, setList] = useState(() => listOf(props.first));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const lessButton = useRef<HTMLButtonElement>(null);
  const onNames = useNamesOpened();

  const more = async () => {
    const cursor = list.next;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/w/${props.slug}/activity?before=${cursor}`).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      const page = (await res.json()) as ActivityPageView;
      // A page that answers a cursor the list has moved from (Show less meanwhile) is dropped.
      flushSync(() => setList((now) => (now.next === cursor ? withPage(now, page) : now)));
      // The button was off while it read, which drops the focus: it goes back to "Show more", or to "Show
      // less" once the last page took "Show more" away. Without scrolling: the new lines stay where the
      // officer reads (issue 412 UX pass).
      (moreButton.current ?? lessButton.current)?.focus({ preventScroll: true });
      return;
    }
    const code = res ? ((await res.json().catch(() => ({}))) as { code?: string }).code : undefined;
    setError(code === SIGNED_OUT ? code : words.failed);
  };
  const less = () => {
    flushSync(() => {
      setList(collapsed);
      setError(null);
    });
    moreButton.current?.focus();
  };

  return (
    <>
      <ul className="mt-1 divide-y divide-rule">
        {[...list.first, ...list.more].map((line, i) => (
          <Line key={`${line.at}-${i}`} line={line} onNames={onNames} />
        ))}
      </ul>
      {/* From 1024, in the sticky margin that scrolls on its own, the two buttons stay in view at its
          foot while the lines run past it (issue 412 UX pass). */}
      {(list.next !== null || list.more.length > 0) && (
        <div className="flex flex-wrap gap-x-6 border-t border-rule bg-paper lg:sticky lg:bottom-0">
          {/* A failed "Show more" says so next to the button, in view at the margin's foot. */}
          {error && (
            <RefusalLine
              text={error}
              className="mt-2 w-full border-l-4 border-seal pl-3 text-body-sm font-semibold"
            />
          )}
          {list.next !== null && (
            <button
              ref={moreButton}
              type="button"
              disabled={busy}
              onClick={() => void more()}
              className={TEXT_BUTTON}
            >
              {words.more}
            </button>
          )}
          {list.more.length > 0 && (
            <button ref={lessButton} type="button" onClick={less} className={TEXT_BUTTON}>
              {words.less}
            </button>
          )}
        </div>
      )}
    </>
  );
}
