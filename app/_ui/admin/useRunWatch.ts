"use client";

// /admin asks the server again every few seconds while a run is in progress. Idle, it asks every 20 seconds
// only in the 5 minutes after a tick (batchMayRun) and only from `pollFrom` on, the next tick at which the
// clock can start a run (D141 amendment, issue 521). So a run a tick starts shows up by itself, and between
// such ticks an idle tab sends nothing and the database can sleep. Every refresh brings a new `pollFrom`.
// When a run ends, the outcome is said once. A hidden tab does not poll; becoming visible asks at once.
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { copy, fill } from "@/lib/copy";
import { batchMayRun } from "@/lib/tick-batch";

import type { RunningView } from "./actions";
import { RESULT_MARK } from "./outcome";
import { stateWord } from "./words";

export const POLL_MS = 4000;
export const IDLE_POLL_MS = 20_000;

export function useRunWatch(
  running: RunningView[],
  /** The newest run, its phase already in words ("Before snapshot", "Daily roster read"). */
  latest: { event: string; phase: string; status: string } | null,
  /** Epoch ms from which the idle poll may ask (lib/tick-gate.ts `pollFrom`); null: not before a refresh. */
  pollFrom: number | null,
  say: (message: string) => void,
) {
  const router = useRouter();
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running.length === 0) {
      if (wasRunning.current && latest) {
        say(
          fill(copy.admin.run.live.finished, {
            mark: RESULT_MARK[latest.status] ?? "✗",
            phase: latest.phase,
            event: latest.event,
            state: stateWord(latest.status),
          }),
        );
      }
      wasRunning.current = false;
    } else {
      wasRunning.current = true;
    }
    const idle = running.length === 0;
    const mayAsk = (now: number) => pollFrom !== null && now >= pollFrom && batchMayRun(now);
    const id = setInterval(
      () => {
        if (!document.hidden && (!idle || mayAsk(Date.now()))) router.refresh();
      },
      idle ? IDLE_POLL_MS : POLL_MS,
    );
    const onVisibility = () => {
      if (!document.hidden) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [running.length, latest, pollFrom, router, say]);
}
