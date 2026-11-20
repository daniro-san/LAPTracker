"use client";

// "Share the thanks", step two (issue 404, D114): the post in each language, editable, one language at a
// time (the officer's own first), with its length against the game's 1,000 characters; then the three ways
// to share it. Discord and the board each send once per request id (D100); after Discord refused, the next
// tap takes a new id. A share that went through says where, and its button rests.
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { fill } from "@/lib/copy";
import { gameNotice } from "@/lib/private/notice-formats";
import { NOTICE_LIMIT, noticeLength, type NoticeLanguage } from "@/lib/private/notice-rules";

import { CopyButton } from "./CopyButton";
import { newRequestId } from "./request-id";
import type { ShareThanksProps } from "./share-thanks-data";
import { ERROR, TextField, Way, type State, type Texts } from "./ShareThanksParts";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export type { Texts } from "./ShareThanksParts";
type Target = "discord" | "board";
type Words = ShareThanksProps["words"];

const BACK =
  "mt-4 inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/** The share route's answer: "ok", or its code; "lost" when no answer came (it may have posted). */
async function send(slug: string, body: object): Promise<string> {
  try {
    const res = await fetch(`/api/w/${slug}/thanks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return "ok";
    const { code } = (await res.json().catch(() => ({}))) as { code?: string };
    return code ?? "failed";
  } catch {
    return "lost";
  }
}

/** A refusal's words; SIGNED_OUT for the signed-out note (RefusalLine shows it). */
function refusal(code: string, target: Target, words: Words): string {
  if (code === SIGNED_OUT) return SIGNED_OUT;
  if (code === "posting") return words["share.busy"];
  if (code === "recent") return words["share.recent"];
  if (code === "not_set_up") return words["share.discord.off"];
  return words[target === "discord" ? "share.failed" : "share.boardFailed"];
}

/** Each way's state, last refusal and request id (D100): one id per way until Discord refuses it. */
function useShare(
  props: ShareThanksProps & { names: string[]; texts: Texts; onShared: () => void },
) {
  const { words, week } = props;
  const [state, setState] = useState<Record<Target, State>>({ discord: "idle", board: "idle" });
  const [error, setError] = useState<Record<Target, string | null>>({ discord: null, board: null });
  const [ids, setIds] = useState(() => ({
    discord: newRequestId(),
    board: newRequestId(),
  }));
  const share = async (target: Target) => {
    const texts = Object.fromEntries(Object.entries(props.texts).map(([l, t]) => [l, t.trim()]));
    if (Object.values(texts).every((t) => t === "")) {
      return setError((e) => ({ ...e, [target]: words["share.empty"] }));
    }
    setState((s) => ({ ...s, [target]: "busy" }));
    setError((e) => ({ ...e, [target]: null }));
    const answer = await send(props.slug, {
      action: "share",
      target,
      week: week.monday,
      title: `${words["share.discord.title"]} · ${week.range}`,
      texts,
      names: props.names,
      requestId: ids[target],
    });
    setState((s) => ({ ...s, [target]: answer === "ok" ? "done" : "idle" }));
    if (answer === "ok") {
      track("ws_thanks_shared", { to: target });
      return props.onShared();
    }
    if (answer === "failed") setIds((i) => ({ ...i, [target]: newRequestId() }));
    setError((e) => ({ ...e, [target]: refusal(answer, target, words) }));
  };
  return { state, error, share };
}

/**
 * Step two: the text, then the ways to share it. The members' board is the one main action; Discord and
 * Copy for the game follow, all full width. A way that went through rests; the others stay open.
 */
/** "On the members' board" (D114), with the board's link once it is there. */
function BoardWay(p: {
  slug: string;
  words: Words;
  state: State;
  error: string | null;
  disabled: boolean;
  onShare: () => void;
}) {
  const { words } = p;
  return (
    <Way
      primary
      label={words["share.board"]}
      busy={words["share.posting"]}
      where={words["share.board.where"]}
      done={
        <>
          {words["share.board.done"]}{" "}
          <a
            href={`/w/${p.slug}/board`}
            className="inline-flex min-h-11 items-center text-plum underline underline-offset-4"
          >
            {words["share.board.see"]}
          </a>
        </>
      }
      state={p.state}
      error={p.error}
      disabled={p.disabled}
      onShare={p.onShare}
    />
  );
}

export function ShareThanksEdit(
  props: ShareThanksProps & {
    names: string[];
    texts: Texts;
    onTexts: (t: Texts) => void;
    /** The writing help's last word (off, failed …), shown above the fields. */
    note: string | null;
    onShared: () => void;
    onBack: () => void;
  },
) {
  const { words, channel } = props;
  const { state, error, share } = useShare(props);
  const [language, setLanguage] = useState<NoticeLanguage>(props.language);
  const tooLong = Object.values(props.texts).some((t) => noticeLength(t.trim()) > NOTICE_LIMIT);
  return (
    <>
      {props.note && <RefusalLine text={props.note} className={`${ERROR} mt-0 mb-3`} />}
      <p className="text-body-sm">{words["share.edit"]}</p>
      <TextField
        words={words}
        texts={props.texts}
        language={language}
        onLanguage={setLanguage}
        onTexts={props.onTexts}
      />
      <h3 className="mt-4 font-subhead text-display-sm">{words["share.where"]}</h3>
      {/* D126: left out while the members' board is turned off for the alliance. */}
      {props.board && (
        <BoardWay
          slug={props.slug}
          words={words}
          state={state.board}
          error={error.board}
          disabled={tooLong}
          onShare={() => void share("board")}
        />
      )}
      <Way
        label={words["share.discord"]}
        busy={words["share.posting"]}
        where={
          channel === null
            ? words["share.discord.off"]
            : fill(words["share.discord.where"], { channel })
        }
        done={fill(words["share.discord.done"], { channel: channel ?? "" })}
        state={state.discord}
        error={error.discord}
        disabled={channel === null || tooLong}
        onShare={() => void share("discord")}
      />
      <div className="mt-3">
        <CopyButton
          text={gameNotice(props.texts[language]).text}
          labels={{
            copy: words["share.copy"],
            copied: words["share.copied"],
            failed: words["share.copyFailed"],
          }}
          onCopied={() => track("ws_thanks_shared", { to: "game" })}
          className="w-full justify-center"
        />
      </div>
      <button type="button" onClick={props.onBack} className={BACK}>
        {words["share.again"]}
      </button>
    </>
  );
}
