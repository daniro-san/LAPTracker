"use client";

// "Share the thanks" (issue 404, D114) from the thanks box on Members and Home. Step one: who to thank
// (ShareThanksPick.tsx). Step two: the weekly appreciation post in EN, PT and FR, drafted by the writing
// help (or written by hand), edited freely, then copied for the game, posted to the members' Discord channel
// or put on the members' board, each once per request id (ShareThanksEdit.tsx, D100). Nothing is posted on
// its own; nobody is listed as missing (D75).
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import { fill } from "@/lib/copy";

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

const EMPTY: Texts = { en: "", "pt-BR": "", fr: "" };

/** "Write the thank-you": the draft route's three texts, or blank fields to write by hand. */
function useWrite(props: ShareThanksProps, chosen: (SharePerson & { note: string })[]) {
  const { words } = props;
  const [texts, setTexts] = useState<Texts | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const write = async () => {
    if (chosen.length === 0) return setNote(words["share.pickOne"]);
    setNote(null);
    if (!props.ai) return setTexts(EMPTY);
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
      return setTexts(EMPTY);
    }
    setNote(words[answer === "busy" ? "share.ai.busy" : "share.ai.failed"]);
  };
  const back = () => {
    setTexts(null);
    setNote(null);
  };
  return { texts, setTexts, busy, note, write, back };
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
    onClick: () => w.setTexts(EMPTY),
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
