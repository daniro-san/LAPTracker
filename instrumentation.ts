// register(): once per server instance at startup, fail fast on a bad environment (plan §11.2).
// onRequestError(): errors outside a run go to app_errors (plan §6, Phase 6 "Observability").
// Next keeps serving 500s if register() throws, so exit instead: a dead instance is louder than a broken one.
import type { Instrumentation } from "next";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("./lib/env");
  try {
    getEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
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
