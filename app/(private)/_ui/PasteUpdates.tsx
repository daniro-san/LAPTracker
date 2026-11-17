"use client";

// "Paste updates" on Members (issue 347, D109): several members' main squad and AD Tech % at once, one
// member per line, in any order ("Ana 10.2M 74%"), typed, pasted or read from screenshots. The lines
// become a member-update draft, read by the same reader and name matcher as a chat screenshot, and the
// officer lands on its review: each line before → after, the member to confirm, then Save. Nothing is
// saved before that. The button stays busy until the draft exists (D100's desk rule), so a second tap
// cannot make a second draft.
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import { Sheet } from "@/lib/brand/components/Sheet";

import type { UpdatesWords } from "./facts-form";
import { ReadScreenshot } from "./ReadScreenshot";
import { isSignedOut, post } from "./screenshot-upload";
import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

/** The shots route's limits: 400 lines of at most 400 characters. */
const MAX_LINES = 400;
const MAX_LINE = 400;

/** The draft made from the lines, or null when no line had a name and a value. */
async function makeDraft(slug: string, text: string): Promise<number | null> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().slice(0, MAX_LINE))
    .filter((l) => l !== "")
    .slice(0, MAX_LINES);
  const made = (await post(
    `/api/w/${slug}/shots`,
    JSON.stringify({ pictures: [{ lines }], pick: { kind: "member_update", scope: null } }),
    "application/json",
  )) as { drafts: { id: number }[] };
  return made.drafts[0]?.id ?? null;
}

export function PasteUpdates({ slug, words }: { slug: string; words: UpdatesWords }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const id = await makeDraft(slug, text);
      if (id === null) {
        setError(words["updates.nothing"]);
        setBusy(false);
        return;
      }
      track("ws_screenshot_sent", { kind: "member_update" });
      // A full load: the open sheet owns a history entry, and its close would undo a soft navigation.
      window.location.assign(`/w/${slug}/shots/${id}`);
    } catch (e) {
      setError(isSignedOut(e) ? SIGNED_OUT : words["updates.failed"]);
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary")}>
        {words["updates.open"]}
      </button>
      {open && (
        <Sheet
          labelledBy="updates-title"
          onCancel={() => {
            setOpen(false);
            setText("");
            setError(null);
          }}
          dirty={text.trim() !== ""}
          title={words["updates.open"]}
          words={sheetWords(words)}
          primary={{
            label: words["updates.read"],
            onClick: () => void check(),
            disabled: busy || text.trim() === "",
          }}
        >
          <p className="text-body-sm text-ink/80">{words["updates.help"]}</p>
          <textarea
            data-initial-focus
            aria-label={words["updates.open"]}
            value={text}
            rows={8}
            maxLength={20_000}
            onChange={(e) => setText(e.target.value)}
            className={`${FIELD} mt-2`}
          />
          <ReadScreenshot
            slug={slug}
            multiple
            words={{
              read: words["shot.read"],
              reading: words["shot.reading"],
              failed: words["shot.failed"],
            }}
            onText={(read) => setText((was) => (was.trim() === "" ? read : `${was}\n${read}`))}
          />
          <p className="mt-2 text-body-sm text-ink/80">{words["updates.after"]}</p>
          {error && <RefusalLine text={error} className="mt-2 text-seal" />}
        </Sheet>
      )}
    </div>
  );
}
