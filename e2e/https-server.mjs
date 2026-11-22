// The `iphone` project's server (D150, amendment 2026-11-22): the same production build that `next start`
// serves, over HTTPS on 127.0.0.1:<port>, reached as https://localhost:<port>. WebKit on Linux keeps cookies in
// libsoup, which sends a Secure cookie only to an https URL, localhost included, so the session's __Host-
// cookie never reached `next start` over http. `next start` takes no certificate (only `next dev` does), so
// this is Next's own custom server, which goes through the same request handlers as `next start`; it is told
// its port, so a write's Origin (https://localhost:<port>) is the origin the app computes. The certificate
// is self-signed and made for this run by openssl; it and its key stay in memory, never on disk.
import { spawnSync } from "node:child_process";
import { createServer } from "node:https";

import next from "next";

const port = Number(process.argv[2]);
const made = spawnSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "/dev/stdout",
    "-config",
    "/dev/stdin",
    "-subj",
    "/CN=localhost",
    "-days",
    "1",
  ],
  // Its own minimal config, so a runner's system openssl.cnf (whose includes may be missing) is never read.
  {
    encoding: "utf8",
    env: { ...process.env, OPENSSL_CONF: "/dev/null" },
    input: "[req]\ndistinguished_name = dn\n[dn]\n",
    stdio: ["pipe", "pipe", "pipe"],
  },
);
if (made.status !== 0 || !made.stdout.includes("PRIVATE KEY"))
  throw new Error(
    `e2e: openssl could not make the certificate: ${made.error?.message ?? made.stderr}`,
  );

const app = next({ dev: false, hostname: "localhost", port });
await app.prepare();
// The PEM holds the key, then the certificate; each option reads the block of its own kind.
createServer({ key: made.stdout, cert: made.stdout }, app.getRequestHandler()).listen(
  port,
  "127.0.0.1",
);
