"use client";

// "Add a roll call" (issue 298): a KvK shield, an Undead Siege or plunders on a day, for an occasion the
// Calendar does not hold. The sheet makes one request id when it opens (D100), so a retry after a lost
// answer opens the same roll call; a second add of the same kind and day opens the first one too.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import { ADDED_KINDS } from "@/lib/private/roll-call-rules";

import { Choice, Labeled, TextInput } from "./CalendarFields";
import { sendRoll } from "./roll-call-client";
import type { RollSheetWords } from "./roll-call-data";
import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Kind = (typeof ADDED_KINDS)[number];

function AddSheet(props: {
  slug: string;
  day: string;
  words: RollSheetWords;
  onClose: () => void;
}) {
  const { words } = props;
  const router = useRouter();
  const [requestId] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<Kind>("shield");
  const [day, setDay] = useState(props.day);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    const { status, json } = await sendRoll<{ id: number }>(props.slug, {
      action: "add",
      kind,
      day,
      requestId,
    });
    setBusy(false);
    if (status === 200 && json.id)
      return router.push(`/w/${props.slug}/roll-call/mark?id=${json.id}`);
    setError(status === 401 ? SIGNED_OUT : words["roll.add.failed"]);
  };
  return (
    <Sheet
      labelledBy="roll-add-title"
      onCancel={props.onClose}
      title={words["roll.add.title"]}
      words={sheetWords(words)}
      dirty={kind !== "shield" || day !== props.day}
      primary={{ label: words["roll.add.save"], onClick: save, disabled: busy || day === "" }}
      note={error && <RefusalLine text={error} className="mb-2 text-seal" />}
    >
      <Choice
        legend={words["roll.add.kind"]}
        name="roll-kind"
        value={kind}
        options={ADDED_KINDS.map((k) => ({ value: k, label: words[`roll.kind.${k}`] }))}
        onChange={setKind}
      />
      <Labeled id="roll-day" label={words["roll.add.day"]}>
        <TextInput
          id="roll-day"
          type="date"
          required
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </Labeled>
      <p className="mt-4 text-body-sm text-ink/75">{words["roll.add.elixir"]}</p>
    </Sheet>
  );
}

export function AddRollCall(props: { slug: string; day: string; words: RollSheetWords }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary")}>
        {props.words["roll.add"]}
      </button>
      {open && <AddSheet {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
