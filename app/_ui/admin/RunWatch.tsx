"use client";

// The one poller of the admin area (#91): it wraps every admin page from AdminShell, so the header's
// live candle is current on sub-pages too. It refreshes the server data (useRunWatch) and keeps the
// "finished" line for /admin's result notice. No other component polls.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import type { RunningView } from "./actions";
import { useRunWatch } from "./useRunWatch";

/** The last "{phase} of {event}: {state}" line; `n` changes on every new one, even with equal text. */
export interface Finished {
  text: string;
  n: number;
}

const FinishedContext = createContext<Finished | null>(null);

/** The newest "a run just ended" line, or null; /admin's AdminActions shows it as its result. */
export const useRunFinished = () => useContext(FinishedContext);

export function RunWatch({
  running,
  latest,
  children,
}: {
  running: RunningView[];
  latest: { event: string; phase: "before" | "after"; status: string } | null;
  children: ReactNode;
}) {
  const [finished, setFinished] = useState<Finished | null>(null);
  const say = useCallback((text: string) => setFinished((f) => ({ text, n: (f?.n ?? 0) + 1 })), []);
  useRunWatch(running, latest, say);
  return <FinishedContext.Provider value={finished}>{children}</FinishedContext.Provider>;
}
