// `pnpm db:local:*`: a plain Postgres cluster for local work, no Docker (issue 126, D47).
//   start   — initdb into .pglocal/ on first use, start it on 127.0.0.1 at DATABASE_URL's port, create the database
//   stop    — stop it
//   migrate — apply drizzle/ through psql, in journal order
//   check   — only the host check below (run before `pnpm db:local:seed`)
// Every command refuses unless DATABASE_URL's host is exactly localhost or 127.0.0.1: `db:seed --reset`
// truncates, so a hosted URL must never get this far. The Postgres binaries (initdb, pg_ctl, psql) come
// from the machine, not from npm.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL, URL } from "node:url";

const DATA_DIR = ".pglocal";

// The Neon driver and libpq (psql) do not split the string as `new URL` does: the driver ends the host at
// a `\`, and libpq ends the user at the first `@`, even one after a `?`. So the string must also start
// `postgres://user[:password]@host[:port]`, with no `@`, `/`, `?`, `#` or `\` in the user or password.
const PLAIN_AUTHORITY =
  /^postgres(?:ql)?:\/\/[^@/?#\\]*@(?:localhost|127\.0\.0\.1)(?::\d+)?(?:[/?]|$)/;
// Parameters that the driver (`host`) or libpq (all three) follow instead of the URL's host.
const HOST_PARAMETERS = ["host", "hostaddr", "service"];

/** The parsed URL when every reader of it connects to localhost or 127.0.0.1, else null. */
export function localDatabaseUrl(raw) {
  try {
    const url = new URL(raw ?? "");
    const local =
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      PLAIN_AUTHORITY.test(raw) &&
      !HOST_PARAMETERS.some((name) => url.searchParams.has(name));
    return local ? url : null;
  } catch {
    return null;
  }
}

function run(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    stdio: [input === undefined ? "inherit" : "pipe", "pipe", "inherit"],
    encoding: "utf8",
    env: {
      ...process.env,
      // macOS: initdb needs a UTF-8 locale. Elsewhere the machine's own locale is used.
      ...(process.platform === "darwin" ? { LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" } : {}),
      // libpq would follow these to another server, after the host check has passed.
      PGHOSTADDR: undefined,
      PGSERVICE: undefined,
    },
  });
  if (result.error || result.status !== 0) {
    console.error(`db:local: ${command} failed${result.error ? ` (${result.error.code})` : ""}`);
    process.exit(1);
  }
  return result.stdout;
}

const running = () =>
  spawnSync("pg_ctl", ["-D", DATA_DIR, "status"], { stdio: "ignore" }).status === 0;

function start(url) {
  if (!existsSync(join(DATA_DIR, "PG_VERSION"))) {
    // `password` (cleartext) auth: the Neon driver pipelines a cleartext password (pipelineConnect).
    const user = decodeURIComponent(url.username);
    run(
      "initdb",
      ["-D", DATA_DIR, "-U", user, "--pwfile=/dev/stdin", "--auth=password", "-E", "UTF8"],
      decodeURIComponent(url.password),
    );
    // TCP on 127.0.0.1 only: a Unix socket path over 103 bytes breaks on macOS.
    appendFileSync(
      join(DATA_DIR, "postgresql.conf"),
      "\nlisten_addresses = '127.0.0.1'\nunix_socket_directories = ''\n",
    );
  }
  if (running()) {
    console.log("db:local: the cluster is already running");
  } else {
    const port = url.port || "5432";
    run("pg_ctl", [
      "-D",
      DATA_DIR,
      "-l",
      join(DATA_DIR, "server.log"),
      "-o",
      `-p ${port}`,
      "-w",
      "start",
    ]);
  }
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const database = decodeURIComponent(url.pathname.slice(1));
  run(
    "psql",
    [admin.href, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-v", `db=${database}`],
    "SELECT format('CREATE DATABASE %I', :'db') WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db') \\gexec\n",
  );
  console.log(`db:local: Postgres on 127.0.0.1:${url.port || "5432"}, database ${database}`);
}

// Same journal table and hashing as scripts/migrate.ts, so "already applied" means the same thing:
// every journal entry newer than the newest applied `created_at` runs, with its journal row, in one transaction.
function migrate(url) {
  // -X: a ~/.psqlrc that prints (\timing on) would end up in the journal time read below.
  const psql = (sql, ...flags) =>
    run("psql", [url.href, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-tA", ...flags], sql);
  psql(
    "SET client_min_messages = warning;\nCREATE SCHEMA IF NOT EXISTS drizzle;\nCREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);\n",
  );
  const lastAppliedAt = Number(
    psql("SELECT coalesce(max(created_at), 0) FROM drizzle.__drizzle_migrations;\n").trim(),
  );
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  const pending = journal.entries.filter((e) => e.when > lastAppliedAt);
  for (const entry of pending) {
    const file = readFileSync(join("drizzle", `${entry.tag}.sql`), "utf8");
    const hash = createHash("sha256").update(file).digest("hex");
    psql(
      `${file}\n;\nINSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('${hash}', ${entry.when});\n`,
      "--single-transaction",
    );
    console.log(`db:local: applied ${entry.tag}`);
  }
  console.log(
    `db:local: ${pending.length} applied, journal at ${pending.at(-1)?.when ?? lastAppliedAt}`,
  );
}

// Only as the entry point. realpath: argv[1] can be a symlinked path (import.meta.url never is), and that
// must not skip the check. existsSync: under the preload, argv[1] may be no file at all.
const entry = process.argv[1];
if (entry && existsSync(entry) && import.meta.url === pathToFileURL(realpathSync(entry)).href) {
  const command = process.argv[2];
  const url = localDatabaseUrl(process.env.DATABASE_URL);
  if (!url) {
    console.error(
      "db:local: DATABASE_URL must be postgres://user:password@localhost[:port]/database (or 127.0.0.1), with no host, hostaddr or service parameter",
    );
    process.exit(2);
  }
  if (command === "start") start(url);
  else if (command === "stop") run("pg_ctl", ["-D", DATA_DIR, "-m", "fast", "stop"]);
  else if (command === "migrate") migrate(url);
  else if (command !== "check") {
    console.error("db:local: expected start, stop, migrate or check");
    process.exit(2);
  }
}
