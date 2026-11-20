"use client";

// Review requests on a notice (issue 402, D113). At the top of the read page, each open request: "Review
// asked by Ana · Français", who it is for, and "Jump to Français"; the officer it is for (or, for the team's,
// anyone but the asker) gets "Approve Français" and "Edit Français and save", which opens the editor at that
// language. Lower down, the "Review" section: the answered requests ("Rook approved Português · Tue 19:08")
// and "Ask for a review". The ask sheet picks the whole notice or one language (preselected when opened from
// a language), and the whole team or one officer. Each write carries a request id (D100). Nothing here blocks
// Publish.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { chip } from "@/lib/brand/components/controls";
import { Notice } from "@/lib/brand/components/Notice";
import { RadioField } from "@/lib/brand/components/RadioField";
import { Sheet } from "@/lib/brand/components/Sheet";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { NoticeLanguage } from "@/lib/private/notice-rules";

import { LANGUAGE_NAME } from "./languages";
import { newRequestId } from "./request-id";
import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export interface ReviewProps {
  /** Open requests, newest first, with their lines made on the server. */
  open: {
    id: number;
    language: NoticeLanguage | null;
    line: string;
    sub: string;
    mine: boolean;
    /** "Approve Français", "Edit Français and save", and "Jump to Français" (null for the whole notice). */
    approve: string;
    edit: string;
    jump: string | null;
  }[];
  /** Answered requests: "Rook approved Português · Tue, Nov 17 19:08", in server time. */
  done: string[];
  /** The officers a request can name, without the viewer, by the name they show. */
  officers: { id: number; name: string }[];
}

/** The route's answer: "ok" or its code ("lost" when no answer came). */
async function send(slug: string, body: object): Promise<string> {
  try {
    const res = await fetch(`/api/w/${slug}/notices/reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return "ok";
    return ((await res.json().catch(() => ({}))) as { code?: string }).code ?? "failed";
  } catch {
    return "lost";
  }
}

const refusal = (code: string, t: WorkspaceDictionary) =>
  code === SIGNED_OUT
    ? SIGNED_OUT
    : t[code === "closed" ? "notices.review.closed" : "notices.review.failed"];

function OpenRequest(props: {
  slug: string;
  t: WorkspaceDictionary;
  request: ReviewProps["open"][number];
  /** The tab in view: no "Jump to" it (issue 412). */
  active: NoticeLanguage;
  onEdit: () => void;
  onJump: (language: NoticeLanguage) => void;
}) {
  const { t, request } = props;
  const router = useRouter();
  // One per request shown (D100): a double tap or a retry after a lost answer approves once.
  const [requestId] = useState(() => newRequestId());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approve = async () => {
    setBusy(true);
    setError(null);
    const answer = await send(props.slug, { action: "approve", review: request.id, requestId });
    setBusy(false);
    if (answer === "ok") {
      track("ws_review_approved");
      return router.refresh();
    }
    setError(answer);
  };
  return (
    <li>
      <Notice tone="info">
        <p className="font-semibold">{request.line}</p>
        <p className="text-body-sm text-ink/75">{request.sub}</p>
        {request.jump && request.language && request.language !== props.active && (
          // Opens that language's tab and scrolls to the tabs (issue 412).
          <a
            href="#read-tabs"
            onClick={() => request.language && props.onJump(request.language)}
            className="inline-flex min-h-11 items-center text-body-sm font-semibold text-plum underline underline-offset-4"
          >
            {request.jump}
          </a>
        )}
        {request.mine && (
          <span className="mt-1 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void approve()} className={chip()}>
              {request.approve}
            </button>
            <button type="button" onClick={props.onEdit} className={chip()}>
              {request.edit}
            </button>
          </span>
        )}
        {error && (
          <RefusalLine
            text={refusal(error, t)}
            className="mt-2 text-body-sm font-semibold text-seal"
          />
        )}
      </Notice>
    </li>
  );
}

/** The open requests, at the top of the read page; nothing when there are none. */
export function ReviewRequests(props: {
  slug: string;
  t: WorkspaceDictionary;
  reviews: ReviewProps;
  active: NoticeLanguage;
  onEdit: (review: number, language: NoticeLanguage | null) => void;
  /** "Jump to Français": that language's tab comes into view. */
  onJump: (language: NoticeLanguage) => void;
}) {
  if (props.reviews.open.length === 0) return null;
  return (
    <ul aria-label={props.t["notices.review"]} className="mt-3 space-y-2">
      {props.reviews.open.map((r) => (
        <OpenRequest
          key={r.id}
          slug={props.slug}
          t={props.t}
          request={r}
          active={props.active}
          onEdit={() => props.onEdit(r.id, r.language)}
          onJump={props.onJump}
        />
      ))}
    </ul>
  );
}

/** The ask sheet's two choices: the whole notice or one written language, the team or one officer. */
function AskFields(props: {
  t: WorkspaceDictionary;
  written: NoticeLanguage[];
  officers: ReviewProps["officers"];
  language: NoticeLanguage | null;
  reviewer: number | null;
  onLanguage: (language: NoticeLanguage | null) => void;
  onReviewer: (reviewer: number | null) => void;
}) {
  const { t, written, officers, language, reviewer } = props;
  const setLanguage = props.onLanguage;
  const setReviewer = props.onReviewer;
  return (
    <>
      <fieldset>
        <legend className="font-semibold">{t["notices.review.what"]}</legend>
        <div className="mt-2 space-y-1">
          {[null, ...written].map((l) => (
            <RadioField
              key={l ?? "all"}
              name="review-what"
              label={l === null ? t["notices.review.whole"] : LANGUAGE_NAME[l]}
              checked={language === l}
              onChange={() => setLanguage(l)}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="font-semibold">{t["notices.review.who"]}</legend>
        <div className="mt-2 space-y-1">
          <RadioField
            name="review-who"
            label={t["notices.review.team"]}
            help={t["notices.review.team.help"]}
            checked={reviewer === null}
            onChange={() => setReviewer(null)}
          />
          {officers.map((o) => (
            <RadioField
              key={o.id}
              name="review-who"
              label={<bdi translate="no">{o.name}</bdi>}
              checked={reviewer === o.id}
              onChange={() => setReviewer(o.id)}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function AskSheet(props: {
  slug: string;
  id: number;
  t: WorkspaceDictionary;
  officers: ReviewProps["officers"];
  written: NoticeLanguage[];
  /** Opened from a language's card: that language is chosen; else the whole notice. */
  initial: NoticeLanguage | null;
  onClose: () => void;
}) {
  const { t } = props;
  const router = useRouter();
  const [language, setLanguage] = useState<NoticeLanguage | null>(props.initial);
  const [reviewer, setReviewer] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One per opened sheet (D100): a double tap or a retry stores one request.
  const [requestId] = useState(() => newRequestId());
  const ask = async () => {
    setBusy(true);
    setError(null);
    const body = { action: "ask", notice: props.id, language, reviewer, requestId };
    const answer = await send(props.slug, body);
    setBusy(false);
    if (answer !== "ok") return setError(answer);
    track("ws_review_requested", {
      scope: language === null ? "notice" : "language",
      to: reviewer === null ? "team" : "officer",
    });
    props.onClose();
    router.refresh();
  };
  return (
    <Sheet
      labelledBy="review-title"
      describedBy="review-help"
      onCancel={props.onClose}
      title={t["notices.review.ask"]}
      words={sheetWords(t)}
      dirty={language !== props.initial || reviewer !== null}
      primary={{
        label: busy ? t["notices.review.sending"] : t["notices.review.send"],
        disabled: busy,
        onClick: () => void ask(),
      }}
      note={
        error && (
          <RefusalLine
            text={refusal(error, t)}
            className="mb-2 border-l-4 border-seal pl-3 text-body-sm font-semibold"
          />
        )
      }
    >
      <AskFields
        t={t}
        written={props.written}
        officers={props.officers}
        language={language}
        reviewer={reviewer}
        onLanguage={setLanguage}
        onReviewer={setReviewer}
      />
      <p id="review-help" className="mt-3 text-body-sm text-ink/70">
        {t["notices.review.help"]}
      </p>
    </Sheet>
  );
}

/** The "Review" section: the answered requests (times in server time, said once) and "Ask for a review". */
export function ReviewSection(props: { t: WorkspaceDictionary; reviews: ReviewProps }) {
  const { t, reviews } = props;
  // Asking is in the tab's panel (issue 412): the section shows only when a request was answered.
  if (reviews.done.length === 0) return null;
  return (
    <section aria-labelledby="notice-review" className="mt-6 border-t border-rule pt-3">
      <h2 id="notice-review" className="font-subhead text-display-sm">
        {t["notices.review"]}
      </h2>
      <ul className="mt-1 space-y-1 text-body-sm text-ink/80">
        {reviews.done.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <p className="mt-1 text-body-sm text-ink/70">{t["notices.review.times"]}</p>
    </section>
  );
}
