"use client";

// "Share the thanks" (issue 404, D114) from the thanks box on Members and Home. Step one: who to thank
// (ShareThanksPick.tsx). Step two: the weekly appreciation post in EN, PT and FR, the template of
// thanks-post.ts with the writing help's highlight lines (or the officer's words as typed), edited freely, then copied for the game, posted to the members' Discord channel
// or put on the members' board, each once per request id (ShareThanksEdit.tsx, D100). Nothing is posted on
// its own; nobody is listed as missing (D75).
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import { thanksPost } from "@/lib/private/thanks-post";
import { fill } from "@/lib/words";

import type { SharePerson, ShareThanksProps } from "./share-thanks-data";
import { ShareThanksEdit, type Texts } from "./ShareThanksEdit";
import { PickStep, usePick } from "./ShareThanksPick";
import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

/** The draft route's answer: the three texts, or its code; "lost" when no answer came. */
async function draft(slug: string, body: object): Promise<Texts | string> {
  try {
    const res = await fetch(`/api/w/${slug}/thanks/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { texts?: Texts; code?: string };
    return res.ok && json.texts ? json.texts : (json.code ?? "failed");
  } catch {
    return "lost";
  }
}

/** The post's template in the three languages, each person's few words as typed (issue 772). */
const template = (chosen: (SharePerson & { note: string })[], lastWeek: boolean): Texts => ({
  en: thanksPost(chosen, "en", lastWeek),
  "pt-BR": thanksPost(chosen, "pt-BR", lastWeek),
  fr: thanksPost(chosen, "fr", lastWeek),
});

/**
 * "Write the thank-you": the draft route's three texts; or the template to edit by hand, without the
 * writing help or when nobody has a few words (then the route is not asked).
 */
function useWrite(props: ShareThanksProps, chosen: (SharePerson & { note: string })[]) {
  const { words } = props;
  const [texts, setTexts] = useState<Texts | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const write = async () => {
    if (chosen.length === 0) return setNote(words["share.pickOne"]);
    setNote(null);
    const own = template(chosen, props.week.lastWeek);
    if (!props.ai || chosen.every((p) => !p.note)) return setTexts(own);
    setBusy(true);
    const answer = await draft(props.slug, {
      people: chosen.map((p) => ({ name: p.name, did: p.did, ...(p.note && { note: p.note }) })),
      lastWeek: props.week.lastWeek,
    });
    setBusy(false);
    if (typeof answer !== "string") return setTexts(answer);
    if (answer === SIGNED_OUT) return setNote(SIGNED_OUT);
    // D126: turned off for the alliance reads like no writing help; a used-up daily limit says so.
    if (answer === "not_set_up" || answer === "turned_off" || answer === "cap_reached") {
      setNote(words[answer === "cap_reached" ? "features.cap.ai" : "share.ai.off"]);
      return setTexts(own);
    }
    setNote(words[answer === "busy" ? "share.ai.busy" : "share.ai.failed"]);
  };
  const back = () => {
    setTexts(null);
    setNote(null);
  };
  const own = () => setTexts(template(chosen, props.week.lastWeek));
  return { texts, setTexts, own, busy, note, write, back };
}

/** Step one's bar: Write the thank-you (or Write it yourself without the writing help), then the other. */
function pickActions(props: ShareThanksProps, w: ReturnType<typeof useWrite>) {
  const { words } = props;
  const primary = {
    label: w.busy ? words["share.writing"] : words[props.ai ? "share.write" : "share.writeOwn"],
    disabled: w.busy,
    onClick: () => void w.write(),
  };
  const own = {
    label: words["share.writeOwn"],
    onClick: w.own,
    disabled: w.busy,
  };
  return { primary, ...(props.ai && { secondary: own }) };
}

function ShareSheet(props: ShareThanksProps & { onClose: () => void }) {
  const { words, week } = props;
  const pick = usePick(props.people);
  const w = useWrite(props, pick.chosen);
  const [shared, setShared] = useState(false);
  const title = `${words[week.lastWeek ? "share.title.last" : "share.title.this"]} · ${week.range}`;
  const note = w.texts === null && w.note && (
    <RefusalLine
      text={w.note}
      className="mb-2 border-l-4 border-seal pl-3 text-body-sm font-semibold"
    />
  );
  return (
    <Sheet
      labelledBy="share-title"
      onCancel={props.onClose}
      title={title}
      words={sheetWords(words)}
      dirty={w.texts !== null && !shared}
      {...(w.texts === null && pickActions(props, w))}
      note={note}
    >
      {week.lastWeek && (
        <p className="mb-3 text-body-sm">{fill(words["share.lastWeek"], { range: week.range })}</p>
      )}
      {w.texts === null ? (
        <PickStep pick={pick} roster={props.roster} words={words} noteLimit={props.noteLimit} />
      ) : (
        <ShareThanksEdit
          {...props}
          names={pick.chosen.map((p) => p.name)}
          texts={w.texts}
          onTexts={w.setTexts}
          note={w.note}
          onShared={() => setShared(true)}
          onBack={w.back}
        />
      )}
    </Sheet>
  );
}

/** The thanks box's button, with the gentle Sunday and Monday line on Home (`nudge`). */
export function ShareThanks(props: ShareThanksProps & { nudge?: boolean }) {
  const [open, setOpen] = useState(false);
  const { words } = props;
  return (
    <div className="mt-2">
      {props.nudge && <p className="text-body-sm font-semibold">{words["share.nudge"]}</p>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("secondary", "mt-1")}
      >
        {words["share.open"]}
      </button>
      {open && <ShareSheet {...props} onClose={() => setOpen(false)} />}
    </div>
  );
}
