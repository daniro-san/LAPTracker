// `next start --import ./e2e/no-network.mjs` in the e2e suite (issue 477): the server may reach only this
// machine. Two places are guarded, and each refusal writes the host to E2E_OUTBOUND_LOG (the file is made on
// the first refusal), which the global teardown requires to be absent or empty:
// - a name lookup of any host but localhost (fetch, http, https, net, tls and WebSocket all look names up
//   through node:dns);
// - a socket opened to an IP address that is not loopback (tls and every client above open theirs through
//   net.Socket.prototype.connect), so an address that needs no lookup is caught too.
// The configured Discord API and PostHog hosts are 127.0.0.1:9, which is loopback; the tracker is the stub
// (e2e/stub-server.mjs). Groq's chat endpoint and Discord's webhooks have fixed https URLs in the app, so
// fetch sends those to the stub at E2E_STUB_URL instead: the app's code and its URLs are unchanged.
import dns from "node:dns";
import { appendFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";

const LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);
const loopback = (ip) => /^(::ffff:)?127\./.test(ip) || ip === "::1";

function refused(host) {
  appendFileSync(process.env.E2E_OUTBOUND_LOG, `${host}\n`);
  return Object.assign(new Error("e2e: outside host refused"), {
    code: "ENOTFOUND",
    hostname: host,
  });
}

const lookup = dns.lookup;
dns.lookup = function (host, options, callback) {
  if (LOCAL.has(host)) return lookup.call(this, host, options, callback);
  process.nextTick(typeof options === "function" ? options : callback, refused(host));
};
const lookupPromise = dns.promises.lookup;
dns.promises.lookup = (host, options) =>
  LOCAL.has(host) ? lookupPromise(host, options) : Promise.reject(refused(host));

// connect(options[, cb]), connect(port[, host][, cb]), connect(path[, cb]), or Node's own normalized
// [options, cb] array (net.connect and tls.connect pass that).
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host =
    typeof first === "object" && first !== null
      ? first.path
        ? null
        : first.host
      : typeof first === "number" && typeof args[1] === "string"
        ? args[1]
        : null;
  if (host && net.isIP(host) && !loopback(host)) {
    const error = refused(host);
    process.nextTick(() => this.destroy(error));
    return this;
  }
  return connect.apply(this, args);
};
syncBuiltinESMExports();

// Only with E2E_STUB_URL set (the e2e servers); other users of this preload, such as
// scripts/record-fixture.test.ts, keep fetch as it is.
const STUB = process.env.E2E_STUB_URL;
if (STUB) {
  const TO_STUB = [
    ["https://api.groq.com/", `${STUB}/groq/`],
    ["https://discord.com/api/webhooks/", `${STUB}/discord/webhooks/`],
  ];
  const send = globalThis.fetch;
  const { Request } = globalThis;
  globalThis.fetch = function (input, init) {
    const url = input instanceof Request ? input.url : String(input);
    const route = TO_STUB.find(([from]) => url.startsWith(from));
    if (!route) return send.call(this, input, init);
    const to = route[1] + url.slice(route[0].length);
    return send.call(this, input instanceof Request ? new Request(to, input) : to, init);
  };
}
