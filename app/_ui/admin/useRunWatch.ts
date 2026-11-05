"use client";

// While a run is in progress /admin asks the server again every few seconds; when it ends, the outcome
// is said once. Idle pages never poll.
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { copy, fill } from "@/lib/copy";

import type { RunningView } from "./actions";
import { RESULT_MARK } from "./outcome";
import { phaseWord, stateWord } from "./words";

export const POLL_MS = 4000;

export function useRunWatch(
  running: RunningView[],
  latest: { event: string; phase: "before" | "after"; status: string } | null,
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
            phase: phaseWord(latest.phase),
            event: latest.event,
            state: stateWord(latest.status),
          }),
        );
      }
      wasRunning.current = false;
      return;
    }
    wasRunning.current = true;
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [running.length, latest, router, say]);
}
