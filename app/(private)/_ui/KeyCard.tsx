// Home's tracker-key card (D124): no key of the alliance's own (or the site's key meanwhile), or a key the
// tracker paused, with the way to Alliance settings; while there is no key of its own, where to get one
// (issue 500).
import { getEnv } from "@/lib/env";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { KeyState } from "@/lib/private/tracker-key";
import { fill } from "@/lib/words";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/** D124: no key of the alliance's own (or the site's key meanwhile), or a key the tracker paused. */
export function KeyCard({
  slug,
  t,
  state,
  headroom,
}: {
  slug: string;
  t: WorkspaceDictionary;
  state: KeyState;
  /** Issue 869: today's plan needs more calls than the key has left; set only for a key that works. */
  headroom: { planned: number; left: number } | null;
}) {
  if (state === "ok" && headroom) {
    return (
      <p role="status" className="mt-4 border-l-4 border-seal pl-3 first:mt-0">
        {fill(t["headroom.home"], { planned: headroom.planned, left: headroom.left })}{" "}
        <a href={`/w/${slug}/settings`} className={LINK}>
          {t["settings.link"]}
        </a>
      </p>
    );
  }
  if (state === "off" || state === "ok") return null;
  const fix = state === "invalid" || state === "out_of_quota" || state === "reenter";
  return (
    <section aria-labelledby="home-key" className="drawn-card mt-4 px-4 py-3 first:mt-0">
      <h2 id="home-key" className="font-subhead text-display-sm">
        {t[fix ? "key.card.fix" : "key.card.add"]}
      </h2>
      <p className="mt-1">{t[`key.card.${state}`]}</p>
      {(state === "none" || state === "site") && (
        <>
          <p className="mt-1">{t["key.card.where"]}</p>
          <a
            href={new URL("/account", getEnv().LAP_API_BASE_URL).href}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
          >
            {t["key.card.whereLink"]}
          </a>
        </>
      )}
      <a href={`/w/${slug}/settings`} className={LINK}>
        {t["settings.link"]}
      </a>
    </section>
  );
}
