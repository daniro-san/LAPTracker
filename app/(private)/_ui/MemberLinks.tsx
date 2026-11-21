"use client";

// A member's "This is me" link on the desk (D142). On Home's "To review": each pending link with Approve and
// Reject, and the name hint (a nickname can be changed, so it proves nothing). On the member card: "Linked to Discord: <name>" with Remove link (asks first), or the pending
// line with Approve and Reject. Each answer names the workspace user who holds the link, so it never reaches
// a later claim of the same player.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import { fill, isolate } from "@/lib/copy";
import type { LinkWords } from "@/lib/private/dictionary.me";
import type { CardLink as CardLinkData, LinkReview } from "@/lib/private/me-link";

import { AskSheet } from "./AskSheet";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Words = LinkWords;
type Action = "approve" | "unlink";
/** The claim as the officer saw it: the user and the player. */
type Claim = { userId: number; uid: number };

async function send(slug: string, action: Action, claim: Claim): Promise<string> {
  const res = await fetch(`/api/w/${slug}/member-links`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, user: claim.userId, uid: claim.uid }),
  }).catch(() => null);
  if (res?.ok) return "ok";
  if (res?.status === 404) return "changed";
  if (res?.status === 409) return "taken";
  return res?.status === 401 ? SIGNED_OUT : "failed";
}

/** One answer at a time; on success the server's page is read again. */
function useAnswer(slug: string, words: Words) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const answer = async (action: Action, claim: Claim) => {
    setBusy(true);
    const r = await send(slug, action, claim);
    setBusy(false);
    if (r !== "ok") {
      const key =
        r === "taken" ? "me.review.taken" : r === "changed" ? "me.review.changed" : "me.failed";
      setError(r === SIGNED_OUT ? SIGNED_OUT : words[key]);
      // The claim changed since the page was read: read it again.
      if (r === "changed") router.refresh();
      return false;
    }
    setError("");
    router.refresh();
    return true;
  };
  return { busy, error, answer };
}

/** Home's "To review": the links an officer still has to look at. */
export function LinkReviews(props: { slug: string; reviews: LinkReview[]; words: Words }) {
  const { words: t } = props;
  const { busy, error, answer } = useAnswer(props.slug, t);
  if (props.reviews.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {props.reviews.map((r) => (
        <li key={r.userId} className="border border-rule px-3 py-2">
          <p className="font-semibold">
            {fill(t["me.review.line"], {
              discord: isolate(r.discordName),
              player: isolate(r.player),
            })}
          </p>
          <p className="text-body-sm text-ink/75">
            {t[r.nameMatch ? "me.review.match" : "me.review.noMatch"]} {t["me.review.lead"]}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer("approve", r)}
              className={buttonClass("primary")}
            >
              {t["me.review.approve"]}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer("unlink", r)}
              className={buttonClass("secondary")}
            >
              {t["me.review.reject"]}
            </button>
          </div>
        </li>
      ))}
      {error && <RefusalLine text={error} className="text-body-sm font-semibold text-seal" />}
    </ul>
  );
}

const LINE = {
  approved: "me.card.linked",
  pending: "me.card.pending",
} as const;

/** The member card's line: who on Discord is linked to this player, with its answers. */
export function CardLink(props: { slug: string; link: CardLinkData; words: Words }) {
  const { words: t, link } = props;
  const { busy, error, answer } = useAnswer(props.slug, t);
  const [asking, setAsking] = useState(false);
  // The card is read once when it opens, so it keeps the outcome of its own answers.
  const [state, setState] = useState<CardLinkData["state"] | "removed">(link.state);
  const act = async (action: Action) => {
    if (await answer(action, link)) setState(action === "approve" ? "approved" : "removed");
  };
  const name = { name: isolate(link.discordName) };
  if (state === "removed")
    return (
      <p role="status" className="mt-1 text-body-sm text-ink/80">
        {t["me.card.removed"]}
      </p>
    );
  const pending = state === "pending";
  return (
    <div className="mt-1 text-body-sm">
      <p className="text-ink/80">{fill(t[LINE[state]], name)}</p>
      <p className="mt-1 flex flex-wrap gap-2">
        {pending && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("approve")}
            className={chip()}
          >
            {t["me.review.approve"]}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => (pending ? void act("unlink") : setAsking(true))}
          className={chip()}
        >
          {t[pending ? "me.review.reject" : "me.card.remove"]}
        </button>
      </p>
      {error && <RefusalLine text={error} className="font-semibold text-seal" />}
      {asking && (
        <AskSheet
          id={`link-ask-${link.userId}`}
          question={fill(t["me.card.removeAsk"], name)}
          yes={t["me.card.remove"]}
          no={t["me.card.keep"]}
          busy={busy}
          seal
          onAnswer={(yes) => {
            setAsking(false);
            if (yes) void act("unlink");
          }}
        />
      )}
    </div>
  );
}
