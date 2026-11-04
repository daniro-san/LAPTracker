// Run logger interface (plan Phase 6 "Observability"). Session 3 ships a console implementation;
// Session 4 replaces it with one INSERT per line into run_logs that never throws and never recurses.
// `data` holds counts and codes, never names.

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
