// register(): once per server instance at startup, fail fast on a bad environment (plan §11.2).
// onRequestError(): errors outside a run go to app_errors (plan §6, Phase 6 "Observability").
// On a long-running server a `process.exit` would be louder than a throw, but on Vercel an invocation that
// throws here fails the same way an exited one does, and Turbopack's Edge bundle flagged `process.exit`
// (it is never reached there, but the static check cannot tell). So: log, then throw.
import type { Instrumentation } from "next";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("./lib/env");
  try {
    getEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    throw error;
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ getAppContext }, { recordAppError }] = await Promise.all([
    import("./lib/app-context"),
    import("./lib/app-errors"),
  ]);
  const digest =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : null;
  await recordAppError(getAppContext(), {
    route: context.routePath,
    kind: context.routeType,
    digest,
    error,
  });
};
