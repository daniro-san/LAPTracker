"use client";

// /admin asks the server again every few seconds while a run is in progress and every 20 seconds when
// idle (so a run the tick starts shows up by itself); when a run ends, the outcome is said once. A
// hidden tab does not poll.
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { copy, fill } from "@/lib/copy";

import type { RunningView } from "./actions";
import { RESULT_MARK } from "./outcome";
import { stateWord } from "./words";

export const POLL_MS = 4000;
export const IDLE_POLL_MS = 20_000;

export function useRunWatch(
  running: RunningView[],
  /** The newest run, its phase already in words ("Before snapshot", "Daily roster read"). */
  latest: { event: string; phase: string; status: string } | null,
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
    const id = setInterval(
      () => {
        if (!document.hidden) router.refresh();
      },
      running.length === 0 ? IDLE_POLL_MS : POLL_MS,
    );
    return () => clearInterval(id);
  }, [running.length, latest, router, say]);
}
