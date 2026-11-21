// A page whose database does not answer (D143): its read throws DataUnavailableError, whose digest Next keeps
// to the error boundary (app/error.tsx), which then says "Data temporarily unavailable" instead of "Something
// cracked". No server import, so the client boundary can read the digest from here.

export const DATA_UNAVAILABLE = "data-unavailable";

export class DataUnavailableError extends Error {
  readonly digest = DATA_UNAVAILABLE;
  constructor(cause: unknown) {
    super("database unavailable", { cause });
    this.name = "DataUnavailableError";
  }
}

// Postgres class 08 (connection exception), 53300 (too many connections) and 57P01–57P03 (shutting down,
// cannot connect now); not 57014, a cancelled query.
const DOWN_CODE = /^(08|53300$|57P0[1-3]$)/;
const DOWN_SYSCALL =
  /^(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH)$/;
// The driver's own words when it cannot reach the database (pg-pool's connect timeout, a dropped socket).
const DOWN_MESSAGE =
  /timeout exceeded when trying to connect|Connection terminated|Couldn't connect to compute/i;

/** True when `error`, or an error it wraps (Drizzle wraps the driver's), says the database cannot be reached. */
export function databaseDown(error: unknown): boolean {
  for (let e = error, depth = 0; depth < 5; depth++) {
    // The Neon driver's WebSocket did not open: it rejects with the socket's error event itself.
    if (e instanceof Event) return e.type === "error";
    if (!(e instanceof Error)) return false;
    const { code } = e as { code?: unknown };
    if (typeof code === "string" && (DOWN_CODE.test(code) || DOWN_SYSCALL.test(code))) return true;
    if (DOWN_MESSAGE.test(e.message)) return true;
    if (e instanceof AggregateError && e.errors.some(databaseDown)) return true;
    e = e.cause;
  }
  return false;
}
