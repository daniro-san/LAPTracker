// Run logger (plan Phase 6 "Observability", "Logging guarantees"). Every line is one INSERT into
// run_logs. `data` holds counts and codes, never names, and passes through redact() first.
// INVARIANT logger.no-recursion: imports only lib/repo and lib/redact; never logs its own failures.
import { redact } from "./redact";
import type { RunLogLine } from "./repo/run-logs";

export type LogData = Record<string, unknown>;

export interface Logger {
  info(code: string, data?: LogData): Promise<void>;
  warn(code: string, data?: LogData): Promise<void>;
  error(code: string, data?: LogData): Promise<void>;
}

export const consoleLogger: Logger = {
  info: async (code, data) => console.info(code, data ?? {}),
  warn: async (code, data) => console.warn(code, data ?? {}),
  error: async (code, data) => console.error(code, data ?? {}),
};

/** 20 alliances × 3 retries × a few lines, with margin. The 400th line is `log.capped`. */
export const MAX_RUN_LOG_LINES = 400;

/** How long shutdown() waits for inserts in flight; the run's finalise and notify come after it. */
export const LOG_SHUTDOWN_MS = 3_000;

export interface RunLogSink {
  insertRunLog(line: RunLogLine): Promise<void>;
}

export interface RunLogger extends Logger {
  /** Inserts that threw or were still in flight at shutdown, and lines not written (past the cap, or before the snapshot existed). */
  stats(): { failedWrites: number; droppedLines: number };
  /** Awaits inserts still in flight (the collector fires `v1.retry` and forgets), at most LOG_SHUTDOWN_MS. */
  shutdown(): Promise<void>;
}

export interface RunLoggerOptions {
  /** The claimed snapshot; null until the run has claimed one. Omitted for a daily read. */
  snapshotId?: () => number | null;
  /** The daily roster read's day (D60), for a logger that writes a daily read's lines. */
  readDay?: string;
  secrets: readonly string[];
  now: () => Date;
}

export function createRunLogger(sink: RunLogSink, options: RunLoggerOptions): RunLogger {
  let lines = 0;
  let failedWrites = 0;
  let droppedLines = 0;
  const inFlight = new Set<Promise<void>>();

  async function insert(level: RunLogLine["level"], code: string, data: LogData): Promise<void> {
    const snapshotId = options.snapshotId?.() ?? null;
    const readDay = options.readDay ?? null;
    if (snapshotId === null && readDay === null) {
      droppedLines++;
      return;
    }
    const unionId = typeof data.union_id === "number" ? data.union_id : null;
    try {
      const line = { snapshotId, readDay, at: options.now(), level, code, unionId, data };
      await sink.insertRunLog(line);
    } catch {
      // Mirrored once per run, without the error: a dead database must not flood the runtime log.
      if (failedWrites++ === 0) console.error("log.write_failed", { code });
    }
  }

  function write(level: RunLogLine["level"], code: string, raw: LogData | undefined) {
    // INVARIANT logger.capped-400: at most MAX_RUN_LOG_LINES rows per run, the last one log.capped.
    if (lines >= MAX_RUN_LOG_LINES) {
      droppedLines++;
      return Promise.resolve();
    }
    lines++;
    let p: Promise<void>;
    if (lines === MAX_RUN_LOG_LINES) {
      droppedLines++;
      p = insert("warn", "log.capped", { max: MAX_RUN_LOG_LINES });
    } else {
      const data = redact(raw ?? {}, options.secrets) as LogData;
      if (level === "error") console.error(code, data);
      p = insert(level, code, data);
    }
    inFlight.add(p);
    return p.finally(() => inFlight.delete(p));
  }

  return {
    info: (code, data) => write("info", code, data),
    warn: (code, data) => write("warn", code, data),
    error: (code, data) => write("error", code, data),
    stats: () => ({ failedWrites, droppedLines }),
    shutdown: async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const bound = new Promise<void>((resolve) => (timer = setTimeout(resolve, LOG_SHUTDOWN_MS)));
      await Promise.race([Promise.allSettled([...inFlight]), bound]);
      clearTimeout(timer);
      // INVARIANT logger.shutdown-bounded: a line still in flight now is not known to be written.
      failedWrites += inFlight.size;
    },
  };
}
