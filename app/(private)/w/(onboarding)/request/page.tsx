// /w/request — "Request an Officers' Desk" (D130, issue 453), with no account. The form, or, once sent, the
// browser's own request and its answer: waiting, approved ("Continue" opens the invite the owner made for it)
// or declined with the owner's reason. Nothing of any other request is read.
import { cookies } from "next/headers";

import { buttonClass } from "@/lib/brand/components/Button";
import { Measure } from "@/lib/brand/components/layout/Measure";
import { fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import {
  REQUEST_COOKIE,
  requestChoices,
  requestView,
  type RequestView,
} from "@/lib/private/access-request";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { Frame, workspaceWords } from "../../../_ui/Frame";
import { CopyLink, RequestForm } from "../../../_ui/RequestForm";

function Answer({ view, t }: { view: NonNullable<RequestView>; t: WorkspaceDictionary }) {
  const alliance = `[${view.alliance.tag}] ${view.alliance.name}`.trim();
  if (view.state === "approved") {
    return (
      <>
        <h1 className="font-display text-display-lg">{t["request.approved.title"]}</h1>
        <p className="mt-3">{fill(t["request.approved.text"], { alliance })}</p>
        <a href="/api/w/request/continue" className={buttonClass("primary", "mt-4 w-full")}>
          {t["request.approved.button"]}
        </a>
      </>
    );
  }
  if (view.state === "declined") {
    return (
      <>
        <h1 className="font-display text-display-lg">{t["request.declined.title"]}</h1>
        <p className="mt-3">{fill(t["request.declined.text"], { alliance })}</p>
        {view.reason && (
          <p className="mt-2 break-words">
            {fill(t["request.declined.reason"], { reason: view.reason })}
          </p>
        )}
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-display-lg">{t["request.waiting.title"]}</h1>
      <p className="mt-3">{fill(t["request.waiting.text"], { alliance, name: view.player })}</p>
      <p className="mt-4 text-body-sm">{t["request.waiting.keep"]}</p>
      <CopyLink path={`/api/w/request/${view.credential}`} t={t} />
    </>
  );
}

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const jar = await cookies();
  const [view, alliances] = await withPageDb((db) =>
    Promise.all([requestView(db, jar.get(REQUEST_COOKIE)?.value), requestChoices(db)]),
  );
  const { language, t } = await workspaceWords();
  const badLink = (await searchParams).e === "link";
  return (
    <Frame language={language} t={t}>
      <Measure form>
        {badLink && (
          <p role="alert" className="mb-3 font-semibold text-seal">
            {t["request.e.link"]}
          </p>
        )}
        {view ? (
          <Answer view={view} t={t} />
        ) : (
          <>
            <h1 className="font-display text-display-lg">{t["request.title"]}</h1>
            <p className="mt-2">{t["request.lead"]}</p>
            <RequestForm t={t} alliances={alliances} />
          </>
        )}
      </Measure>
    </Frame>
  );
}
