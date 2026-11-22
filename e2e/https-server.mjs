// The `iphone` project's server (D150, amendment 2026-11-22): the same production build that `next start`
// serves, over HTTPS on 127.0.0.1:<port>, reached as https://localhost:<port>. WebKit on Linux keeps cookies in
// libsoup, which sends a Secure cookie only to an https URL, localhost included, so the session's __Host-
// cookie never reached `next start` over http. `next start` takes no certificate (only `next dev` does), so
// this is Next's own custom server, which goes through the same request handlers as `next start`; it is told
// its port, so a write's Origin (https://localhost:<port>) is the origin the app computes. The certificate
// is self-signed and made for this run by openssl; it and its key stay in memory, never on disk (only a
// minimal openssl config file is written to a temporary directory, and removed once openssl returns).
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

import next from "next";

const port = Number(process.argv[2]);
// Its own minimal config, in a file: a runner's system openssl.cnf may include directories that do not exist,
// and /dev/stdin cannot be opened when Node's stdin is a socket (Linux). Only this file is ever on disk.
const dir = mkdtempSync(join(tmpdir(), "lap-e2e-tls-"));
const config = join(dir, "openssl.cnf");
writeFileSync(config, "[req]\ndistinguished_name = dn\n[dn]\n");
// No -keyout: with no default_keyfile in the config, openssl writes the key, then the certificate, to stdout
// (a pipe), so the key never touches disk and nothing opens /dev/stdout, which a socket refuses on Linux.
const made = spawnSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-config",
    config,
    "-subj",
    "/CN=localhost",
    "-days",
    "1",
  ],
  { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: config } },
);
rmSync(dir, { recursive: true, force: true });
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
