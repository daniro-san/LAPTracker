"use client";

// The one poller of the admin area (#91): it wraps every admin page from AdminShell, so the header's
// live candle is current on sub-pages too. It refreshes the server data (useRunWatch) and keeps the
// "finished" line for /admin's result notice. No other component polls. It also knows when this tab
// is waiting on a press that runs a read (useBusy), so the candle is lit at once, not at the next poll.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { RUN_ACTIONS, type RunningView } from "./actions";
import { LiveIndicator } from "./parts";
import { useRunWatch } from "./useRunWatch";

/** The last "{phase} of {event}: {state}" line; `n` changes on every new one, even with equal text. */
export interface Finished {
  text: string;
  n: number;
}

const FinishedContext = createContext<Finished | null>(null);
const PressContext = createContext({ pressing: false, setPressing: (_: boolean) => {} });

/** The newest "a run just ended" line, or null; /admin's AdminActions shows it as its result. */
export const useRunFinished = () => useContext(FinishedContext);

/** The action this tab is sending, as state; while it is one that runs a read, the candle is lit. */
export function useBusy() {
  const { setPressing } = useContext(PressContext);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setPressing(busy !== null && RUN_ACTIONS.has(busy));
    return () => setPressing(false);
  }, [busy, setPressing]);
  return [busy, setBusy] as const;
}

/** The header's candle: on while the server reports a run, or while this tab waits on one. */
export function LiveNow({ on }: { on: boolean }) {
  const { pressing } = useContext(PressContext);
  return <LiveIndicator on={on || pressing} />;
}

export function RunWatch({
  running,
  latest,
  children,
}: {
  running: RunningView[];
  latest: { event: string; phase: string; status: string } | null;
  children: ReactNode;
}) {
  const [finished, setFinished] = useState<Finished | null>(null);
  const [pressing, setPressing] = useState(false);
  const press = useMemo(() => ({ pressing, setPressing }), [pressing]);
  const say = useCallback((text: string) => setFinished((f) => ({ text, n: (f?.n ?? 0) + 1 })), []);
  useRunWatch(running, latest, say);
  return (
    <PressContext.Provider value={press}>
      <FinishedContext.Provider value={finished}>{children}</FinishedContext.Provider>
    </PressContext.Provider>
  );
}
