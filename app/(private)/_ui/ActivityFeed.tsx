"use client";

// Home's "Recent activity" lines (D108, 2026-11-18). The first page comes from the server; "Show more"
// reads the next page from /api/w/[slug]/activity with the cursor, "Show less" goes back to the first page
// and puts the focus on "Show more", so the page does not jump. A run ("Rook added 6 entries to the
// Calendar") is a <details> that opens its lines in place, without script; every control is 44 px.
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import type { ActivityPageView, ActivityView } from "@/lib/private/desk-activity-words";

import { collapsed, listOf, withPage } from "./activity-list";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

const Ago = ({ line }: { line: Pick<ActivityView, "at" | "ago"> }) => (
  <span className="whitespace-nowrap text-body-sm text-ink/70">
    {" · "}
    <time dateTime={line.at}>{line.ago}</time>
  </span>
);

function Line({ line }: { line: ActivityView }) {
  if (line.run.length === 0) {
    return (
      <li className="py-2">
        {line.text}
        <Ago line={line} />
      </li>
    );
  }
  return (
    <li>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 py-2 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            {line.text}
            <Ago line={line} />
          </span>
          <span aria-hidden="true" className="inline-block text-plum group-open:rotate-180">
            ▾
          </span>
        </summary>
        <ul className="mb-2 ml-1 border-l-2 border-rule pl-3">
          {line.run.map((one, i) => (
            <li key={`${one.at}-${i}`} className="py-1 text-body-sm">
              {one.text}
              <Ago line={one} />
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
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
      // The last page took "Show more" away: the focus goes to "Show less".
      if (!moreButton.current) lessButton.current?.focus();
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
          <Line key={`${line.at}-${i}`} line={line} />
        ))}
      </ul>
      {(list.next !== null || list.more.length > 0) && (
        <div className="flex flex-wrap gap-x-6 border-t border-rule">
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
      {error && (
        <RefusalLine
          text={error}
          className="mt-2 border-l-4 border-seal pl-3 text-body-sm font-semibold"
        />
      )}
    </>
  );
}
