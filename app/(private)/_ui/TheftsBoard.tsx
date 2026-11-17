"use client";

// The thefts page's body (issue 321): "Add a theft", which opens the form sheet, then the log grouped by
// alliance and attacker. After a save the server renders the page again.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";

import type { AllianceCard, TheftWords } from "./theft-data";
import { TheftCards } from "./TheftCards";
import { TheftForm } from "./TheftForm";

export function TheftsBoard(props: {
  slug: string;
  t: TheftWords;
  language: WorkspaceLanguage;
  alliances: AllianceCard[];
  roster: { uid: number; name: string }[];
  start: { day: string; time: string };
  serverZone: string;
}) {
  const { alliances, ...form } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={buttonClass("primary", "mt-4 w-full sm:w-auto")}
      >
        {props.t["thefts.add"]}
      </button>
      {open && (
        <TheftForm
          {...form}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
      {alliances.length === 0 ? (
        <p className="mt-4 border border-rule px-4 py-5">{props.t["thefts.empty"]}</p>
      ) : (
        <TheftCards alliances={alliances} slug={props.slug} t={props.t} language={props.language} />
      )}
    </>
  );
}
