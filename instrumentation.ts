// Runs once per server instance at startup: fail fast on a bad environment (plan §11.2).
// Next keeps serving 500s if register() throws, so exit instead: a dead instance is louder than a broken one.
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
