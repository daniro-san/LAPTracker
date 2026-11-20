// The body of /w (D131, issue 457): the error or "none" line, the alliances signed in on this device, the
// sign-in, what Discord shows us, and the way to request a Desk (D130). The page reads the rows; this draws.
import { buttonClass } from "@/lib/brand/components/Button";
import type { ChooserRow } from "@/lib/private/chooser";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

const ERRORS = ["denied", "discord", "not_configured"] as const;

/** The alliances open on this device, one tap each, then "Missing an alliance?" and the sign-in again. */
function ChooserList({ rows, t }: { rows: ChooserRow[]; t: WorkspaceDictionary }) {
  return (
    <section aria-labelledby="chooser-list" className="mt-4">
      <h2 id="chooser-list" className="font-subhead text-body-lg">
        {t["chooser.list"]}
      </h2>
      <ul className="mt-2 grid gap-3">
        {rows.map((r) => (
          <li key={r.slug}>
            <a
              href={r.href}
              className="drawn-card tint-button flex min-h-14 items-center gap-3 px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold break-words">
                  <bdi>
                    [{r.tag}] {r.name}
                  </bdi>
                </span>
                <span className="block text-body-sm text-ink/75">
                  {t[r.tier === "officer" ? "app.name" : "board.name"]}
                </span>
              </span>
              <span aria-hidden="true">→</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4">{t["chooser.again"]}</p>
      <a href="/api/w/login" className={buttonClass("secondary", "mt-2 w-full sm:w-auto")}>
        {t["chooser.button"]}
      </a>
    </section>
  );
}

/**
 * `e`: the callback's answer. "none" (the sign-in just found no alliance) shows its line above the list
 * even when this device holds other alliances' sessions.
 */
export function Chooser({
  rows,
  e,
  t,
}: {
  rows: ChooserRow[];
  e: string | string[] | undefined;
  t: WorkspaceDictionary;
}) {
  const error = ERRORS.find((x) => x === e);
  const none = e === "none";
  return (
    <>
      <h1 className="font-display text-display-lg">{t["chooser.title"]}</h1>
      {error && (
        <p role="alert" className="mt-3 font-semibold text-seal">
          {t[`signin.e.${error}`]}
        </p>
      )}
      {none && (
        <p role="status" className="mt-3 font-semibold">
          {t["chooser.none"]}
        </p>
      )}
      {rows.length > 0 ? (
        <ChooserList rows={rows} t={t} />
      ) : (
        <>
          {!none && <p className="mt-2">{t["chooser.lead"]}</p>}
          <a href="/api/w/login" className={buttonClass("primary", "mt-4 w-full sm:w-auto")}>
            {t["chooser.button"]}
          </a>
        </>
      )}
      <p className="mt-2 text-body-sm text-ink/75">{t["chooser.note"]}</p>
      <section aria-labelledby="chooser-leader" className="mt-8 border-t border-rule pt-4">
        <h2 id="chooser-leader" className="font-subhead text-body-lg">
          {t["chooser.leader"]}
        </h2>
        <a
          href="/w/request"
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          {t["chooser.request"]}
        </a>
      </section>
    </>
  );
}
