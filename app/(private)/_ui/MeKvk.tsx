"use client";

// "KvK roles" on a member's own page (issue 831, D161 amended): the next KvK members can see, its day and
// time in server time and in the member's own (D116), and each role of its plan with the people officers
// confirmed, in name order. The member says "I'm in" for a role, or withdraws while no officer confirmed it;
// the uid is their link's, the server's. Roles are jobs, never a ranking (D75). Every control is 44 px or
// more; never in replay (ph-no-capture).
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";
import type { KvkPlanWords } from "@/lib/private/dictionary.kvk-plan";
import type { MeKvkView } from "@/lib/private/kvk-claims";
import { fill } from "@/lib/words";

import { Times } from "./YourTime";

type Role = MeKvkView["roles"][number];

function RoleRow(props: {
  role: Role;
  words: KvkPlanWords;
  busy: boolean;
  onSend: (action: "ask" | "withdraw") => void;
}) {
  const { role, words: w } = props;
  return (
    <li className="border-t border-rule py-3">
      <p className="font-semibold">{role.name}</p>
      <p translate="no" className="text-body-sm">
        {role.names.length > 0 ? role.names.join(", ") : w["meKvk.nobody"]}
      </p>
      {role.mine === "in" && <p className="mt-1 text-body-sm font-semibold">{w["meKvk.in"]}</p>}
      {role.mine === "asked" && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-body-sm font-semibold">{w["meKvk.asked"]}</span>
          <button
            type="button"
            disabled={props.busy}
            aria-label={fill(w["meKvk.withdrawOf"], { role: role.name })}
            onClick={() => props.onSend("withdraw")}
            className={buttonClass("secondary")}
          >
            {w["meKvk.withdraw"]}
          </button>
        </p>
      )}
      {role.mine === null && (
        <p className="mt-1">
          <button
            type="button"
            disabled={props.busy}
            aria-label={fill(w["meKvk.askOf"], { role: role.name })}
            onClick={() => props.onSend("ask")}
            className={buttonClass("primary")}
          >
            {w["meKvk.ask"]}
          </button>
        </p>
      )}
    </li>
  );
}

export function MeKvk(props: {
  slug: string;
  view: MeKvkView;
  /** The KvK's server day in the member's language ("Saturday, November 28") and its time ("12:00 ST"). */
  day: string;
  st: string;
  words: KvkPlanWords;
  calendar: CalendarWords;
}) {
  const { view, words: w } = props;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const send = async (role: string, action: "ask" | "withdraw") => {
    setBusy(true);
    setFailed(false);
    const res = await fetch(`/api/w/${props.slug}/me/kvk`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entry: view.entry, role, action }),
    }).catch(() => null);
    setBusy(false);
    // Confirmed meanwhile, or no longer on the roster: the page says so once read again.
    if (res?.ok || res?.status === 409) return router.refresh();
    setFailed(true);
  };
  return (
    <section aria-labelledby="me-kvk" className="ph-no-capture drawn-card mt-4 px-4 py-4">
      <h2 id="me-kvk" className="font-subhead text-display-sm">
        {w["meKvk.head"]}
      </h2>
      <p className="mt-1">
        <span>{`${props.day} · `}</span>
        <Times st={props.st} at={view.at} day={view.day} words={props.calendar} />
      </p>
      <p className="mt-1 text-body-sm">{w["meKvk.lead"]}</p>
      <ul className="mt-2">
        {view.roles.map((role) => (
          <RoleRow
            key={role.name}
            role={role}
            words={w}
            busy={busy}
            onSend={(action) => void send(role.name, action)}
          />
        ))}
      </ul>
      {failed && (
        <p role="alert" className="mt-2 text-body-sm font-semibold text-seal">
          {w["meKvk.failed"]}
        </p>
      )}
    </section>
  );
}
