// /w/[slug]/requests (issue 868): Members → Requests, the `/join` requests of the alliance's Discord server that
// are younger than 7 days, the oldest first. Each shows who asked (the name Discord showed) and what they
// typed, and the newest roster's players that matches; an officer approves one of them or declines. The access
// check runs before anything is read (D71); with `/join` turned off for the alliance, the page goes to Home
// (D126). Desk only: no public page shows a request.
import { PageHead } from "@/lib/brand/components/layout/PageHead";
import { dateWords } from "@/lib/date-words";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { joinRequestsView, type JoinRequestView } from "@/lib/private/join-requests";
import { fill } from "@/lib/words";

import { SignedInFrame } from "../../../_ui/Frame";
import { JoinRequests, type JoinWords, type RequestRow } from "../../../_ui/JoinRequests";
import { ViewSwitch } from "../../../_ui/MembersHead";
import { openRollCall } from "../../../_ui/roll-call-page";

function rowOf(r: JoinRequestView, t: WorkspaceDictionary, day: (at: Date) => string): RequestRow {
  return {
    id: r.id,
    asked: fill(t["join.asked"], { who: r.who, typed: r.typed }),
    when: fill(t["join.when"], { day: day(r.at) }),
    candidates: r.candidates.map((p) => ({
      uid: p.uid,
      label: fill(t["join.approveAs"], { player: [p.name, p.rank].filter(Boolean).join(" · ") }),
    })),
    none: r.candidates.length === 0 ? t["join.notInRoster"] : null,
  };
}

const wordsOf = (t: WorkspaceDictionary): JoinWords => ({
  decline: t["join.decline"],
  approved: t["join.approved"],
  declined: t["join.declined"],
  given: t["join.given"],
  giveFailed: t["join.giveFailed"],
  noRole: t["join.noRole"],
  welcomed: t["join.welcomed"],
  welcomeFailed: t["join.welcomeFailed"],
  gone: t["join.gone"],
  taken: t["join.taken"],
  failed: t["join.failed"],
});

export default async function RequestsPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = await openRollCall(
    params,
    "requests",
    (db, access) => joinRequestsView(db, access, new Date()),
    "discord_join",
  );
  const { access, slug, t, language, data, waiting } = page;
  const day = dateWords(language, page.zone).day;
  return (
    <SignedInFrame access={access} language={language} t={t} current="requests" waiting={waiting}>
      <PageHead title={t["join.view"]} />
      <ViewSwitch slug={slug} open="requests" on={access.features.on} t={t} />
      <p className="mt-2 max-w-(--measure) text-body-sm text-ink/80">{t["join.lead"]}</p>
      <p className="mt-1 max-w-(--measure) text-body-sm text-ink/80">{t["join.how"]}</p>
      {data.length === 0 ? (
        <p className="drawn-card mt-4 px-4 py-5">{t["join.none"]}</p>
      ) : (
        <JoinRequests slug={slug} rows={data.map((r) => rowOf(r, t, day))} words={wordsOf(t)} />
      )}
    </SignedInFrame>
  );
}
