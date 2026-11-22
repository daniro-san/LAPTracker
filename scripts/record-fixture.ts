// `pnpm fixture:record` (the record-fixture skill, .claude/skills/record-fixture): calls the upstream /v1 API
// and saves each body. SPENDS QUOTA, 1 per line; never run it from a test. LAP_API_KEY comes from the
// environment, or from the local env file through the pnpm script's --env-file-if-exists, so the agent never
// opens that file; the key is never printed.
// stdin, one line per call: <path under /v1> <output file>. Only an explicit /tmp path gets the raw body;
// every other path gets it neutralised (D76). Stops at the first 401, 403 or 429.
import { readFileSync, writeFileSync } from "node:fs";

import { envSchema } from "../lib/env";
import { neutraliseFixture } from "./neutralise-fixture";

const UA = "laptracker/1.0 (+https://github.com/daniro-san/LAPTracker)";
// Always the real upstream (lib/env.ts's default): a local LAP_API_BASE_URL points at 127.0.0.1:9.
const API = envSchema.shape.LAP_API_BASE_URL.parse(undefined);

const key = envSchema.shape.LAP_API_KEY.safeParse(process.env.LAP_API_KEY);
if (!key.success) {
  console.error("fixture:record: LAP_API_KEY is not set to a lap_ key; no call made");
  process.exit(1);
}

for (const line of readFileSync(0, "utf8").split("\n")) {
  const [path, out] = line.trim().split(/\s+/);
  if (!path || !out) continue;
  const started = performance.now();
  const response = await fetch(`${API}/${path}`, {
    headers: { "User-Agent": UA, Authorization: `Bearer ${key.data}`, Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.text();
  writeFileSync(out, out.startsWith("/tmp/") ? body : neutraliseFixture(body));
  const seconds = ((performance.now() - started) / 1000).toFixed(2);
  console.log(`${path} -> ${response.status} ${seconds}s`);
  if ([401, 403, 429].includes(response.status)) {
    console.log("STOP");
    break;
  }
}
