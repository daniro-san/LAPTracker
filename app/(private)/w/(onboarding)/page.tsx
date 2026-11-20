// /w — "Sign in" from the public site (D131, issue 457). One Discord sign-in finds every alliance this account
// may open; the callback goes straight to the only one, or back here with the list. The list is read from
// this browser's own session cookies, so it names no other workspace. "No Desk yet? Request one" leads an
// alliance's leadership to /w/request (D130).
import { cookies } from "next/headers";

import { buttonClass } from "@/lib/brand/components/Button";
import { Measure } from "@/lib/brand/components/layout/Measure";
import { withPageDb } from "@/lib/page";
import { chooserView, type ChooserRow } from "@/lib/private/chooser";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { Frame, workspaceWords } from "../../_ui/Frame";

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

export default async function ChooserPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const jar = await cookies();
  const rows = await withPageDb((db) => chooserView(db, jar, new Date()));
  const { language, t } = await workspaceWords();
  const e = (await searchParams).e;
  const error = ERRORS.find((x) => x === e);
  const none = e === "none" && rows.length === 0;
  return (
    // Members sign in here too: the bar names the site, not the Officers' Desk.
    <Frame language={language} t={t} title="LAPTracker">
      <Measure form>
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
      </Measure>
    </Frame>
  );
}
