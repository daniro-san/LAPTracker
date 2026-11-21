// `next start --import ./e2e/no-network.mjs` in the e2e suite (issue 477): the server may reach only this
// machine. A name lookup of any other host (fetch, http, https and net all look up through node:dns) is
// refused and its host written to E2E_OUTBOUND_LOG, which the global teardown requires to be empty. The
// configured upstream, Discord and PostHog hosts are 127.0.0.1:9, an address that needs no lookup.
import dns from "node:dns";
import { appendFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);

function refused(host) {
  appendFileSync(process.env.E2E_OUTBOUND_LOG, `${host}\n`);
  return Object.assign(new Error("e2e: lookup refused"), { code: "ENOTFOUND", hostname: host });
}

const lookup = dns.lookup;
dns.lookup = function (host, options, callback) {
  if (LOCAL.has(host)) return lookup.call(this, host, options, callback);
  process.nextTick(typeof options === "function" ? options : callback, refused(host));
};
const lookupPromise = dns.promises.lookup;
dns.promises.lookup = (host, options) =>
  LOCAL.has(host) ? lookupPromise(host, options) : Promise.reject(refused(host));
syncBuiltinESMExports();
