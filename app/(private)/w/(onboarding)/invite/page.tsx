// /w/invite — a new alliance sets up its Officers' Desk from the owner's one-time link (D130, issue 453). The
// link's secret arrived as a cookie (/api/w/invite/<link>); this page reads only that invite, and after the
// Discord sign-in, the servers Discord listed for this account. Four steps: sign in, the server, the bot,
// the roles; then the Desk opens.
import { cookies } from "next/headers";

import { getAppContext } from "@/lib/app-context";
import { buttonClass } from "@/lib/brand/components/Button";
import { Measure } from "@/lib/brand/components/layout/Measure";
import { fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import { inviteView, type InviteView } from "@/lib/private/invite";

import { Frame, workspaceWords } from "../../../_ui/Frame";
import { InviteOpened } from "../../../_ui/invite-client";
import { InviteSteps } from "../../../_ui/InviteSteps";

const ERRORS = ["link", "denied", "discord", "claimed", "not_configured"] as const;

function Closed({
  view,
  t,
}: {
  view: Extract<InviteView, { state: "closed" }>;
  t: WorkspaceDictionary;
}) {
  if (view.why === "used" && view.slug) {
    return (
      <>
        <p className="mt-3">{t["invite.used.mine"]}</p>
        <a href={`/w/${view.slug}`} className={buttonClass("primary", "mt-4 w-full sm:w-auto")}>
          {t["invite.used.open"]}
        </a>
      </>
    );
  }
  const key: WorkspaceKey = view.why === "used" ? "invite.used.other" : `invite.${view.why}`;
  return <p className="mt-3">{t[key]}</p>;
}

/** Steps 2 to 4 before sign-in: their heads only, so she sees what comes. */
function Ahead({ t }: { t: WorkspaceDictionary }) {
  return (
    <ol className="mt-6 grid gap-3 text-ink/70" aria-label={t["invite.title"]}>
      {(["invite.server.head", "invite.bot.head", "invite.roles.head"] as const).map((k) => (
        <li key={k} className="font-subhead text-body-lg">
          {t[k]}
        </li>
      ))}
    </ol>
  );
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const jar = await cookies();
  const { env } = getAppContext();
  const now = new Date();
  const view = await withPageDb((db) => inviteView(db, jar, env, now));
  const { language, t } = await workspaceWords();
  const e = (await searchParams).e;
  const error = ERRORS.find((x) => x === e);
  const subtitle =
    view.state === "open" ? `[${view.alliance.tag}] ${view.alliance.name}`.trim() : undefined;
  return (
    <Frame language={language} t={t} {...(subtitle && { subtitle })}>
      <Measure form>
        <h1 className="font-display text-display-lg">
          {view.state === "open" ? t["invite.title"] : t["invite.none.title"]}
        </h1>
        {error && (
          <p role="alert" className="mt-3 font-semibold text-seal">
            {t[`invite.e.${error}`]}
          </p>
        )}
        {view.state === "none" && !error && <p className="mt-3">{t["invite.none.text"]}</p>}
        {view.state === "closed" && <Closed view={view} t={t} />}
        {view.state === "open" && (
          <>
            <p className="mt-2">{fill(t["invite.lead"], { alliance: subtitle ?? "" })}</p>
            <p className="mt-1 text-body-sm text-ink/75">
              {fill(t["invite.expires"], {
                date: new Intl.DateTimeFormat(language, {
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                }).format(view.expiresAt),
              })}
            </p>
            {view.signedIn ? (
              <InviteSteps
                t={t}
                tag={view.alliance.tag}
                signedIn={view.signedIn}
                installUrl={view.installUrl}
                rolesInstallUrl={view.rolesInstallUrl}
                ready={view.ready}
              />
            ) : (
              <section aria-labelledby="invite-signin" className="drawn-card mt-6 px-4 py-3">
                <InviteOpened />
                <h2 id="invite-signin" className="font-subhead text-display-sm">
                  {t["invite.signin.head"]}
                </h2>
                <p className="mt-1">{t["invite.signin.tip"]}</p>
                <a href="/api/w/invite/login" className={buttonClass("primary", "mt-3 w-full")}>
                  {t["invite.signin.button"]}
                </a>
              </section>
            )}
            {!view.signedIn && <Ahead t={t} />}
          </>
        )}
      </Measure>
    </Frame>
  );
}
