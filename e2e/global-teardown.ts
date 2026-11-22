// After the suite: the run fails if the server tried to reach any host but this machine (e2e/no-network.mjs).
import { existsSync, readFileSync } from "node:fs";

import { OUTBOUND_LOG } from "./env";

export default function globalTeardown() {
  // The preload makes the file on its first refusal: no file, no refusal.
  if (!existsSync(OUTBOUND_LOG)) return;
  const hosts = [...new Set(readFileSync(OUTBOUND_LOG, "utf8").split("\n").filter(Boolean))];
  if (hosts.length > 0) throw new Error(`e2e: the server tried to reach ${hosts.join(", ")}`);
}
