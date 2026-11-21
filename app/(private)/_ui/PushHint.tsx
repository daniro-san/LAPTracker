"use client";

// Home's one-time hint (D148): "Get notifications on this phone → Alliance settings". Officers only (Home is the
// desk), only when the site has push keys. Gone once hidden on this device (browser storage, a convenience),
// or once this device has notifications on. Nothing shows until the browser has checked.
import { useEffect, useState } from "react";

import { currentSubscription } from "./push-client";

const keyOf = (slug: string) => `lap-push-hint:${slug}`;

/** Hidden on this device before; false when storage cannot be read. */
const wasHidden = (slug: string) => {
  try {
    return localStorage.getItem(keyOf(slug)) === "hidden";
  } catch {
    return false;
  }
};

export function PushHint(props: {
  slug: string;
  words: { hint: string; link: string; close: string };
}) {
  const { slug, words } = props;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (wasHidden(slug)) return;
    void currentSubscription(slug)
      .catch(() => null)
      .then((sub) => setShown(!sub));
  }, [slug]);
  if (!shown) return null;
  const hide = () => {
    setShown(false);
    try {
      localStorage.setItem(keyOf(slug), "hidden");
    } catch {
      // Without storage the hint comes back on the next visit; nothing else depends on it.
    }
  };
  return (
    <p className="flex flex-wrap items-center gap-x-3 border-l-4 border-plum pl-3 text-ink">
      <span>{words.hint}</span>
      <a
        href={`/w/${slug}/settings#push`}
        className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
      >
        {words.link} →
      </a>
      <button
        type="button"
        onClick={hide}
        className="min-h-11 min-w-11 px-2 text-body-sm font-semibold underline underline-offset-4"
      >
        {words.close}
      </button>
    </p>
  );
}
