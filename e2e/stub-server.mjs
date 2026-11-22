// The e2e suite's stand-in for the outside services the desk calls (issue 477, flows 4 and 7), on
// 127.0.0.1:<port>. It answers three routes and keeps every request it answered in memory:
// - GET /v1/quota (LAP_API_BASE_URL): a workspace key's test (D124), with the recorded quota fixture. The
//   site's own key (LAP_API_KEY) gets no answer, as before the stub;
// - POST /groq/openai/v1/chat/completions: Translate (D81), each word of the text written backwards, so the
//   untranslated guard sees none of the source's words;
// - POST /discord/webhooks/<id>/<token>: a notice posted to Discord (D102).
// e2e/no-network.mjs sends Groq's and Discord's webhook URLs here. GET /__stub/received lists what was
// answered, for the specs. A POST to the last two whose body is neither JSON nor a multipart post with a
// `payload_json` part gets 400. Any other request gets no answer: its body is read, then the socket is closed,
// so fetch fails with "fetch failed" and a cause with no system error code, as it did at 127.0.0.1:9 (a
// port fetch refuses before connecting). lib/sources' RequestError and lib/data-unavailable's databaseDown
// read both the same way.
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { URL } from "node:url";

const port = Number(process.argv[2]);
const QUOTA = readFileSync("fixtures/v1-20261116T105019Z/quota-before.json", "utf8");
const SITE_KEY = `Bearer ${process.env.LAP_API_KEY}`;
const WEBHOOK = /^\/discord\/webhooks\/\d+\/[\w-]+$/;

/**
 * What each answered request carried: its path and Authorization header, and for a POST its body as sent
 * (`raw`, as text) and parsed (`body`).
 */
const received = [];
const { Response } = globalThis;

const bytes = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
};

/** A POST's JSON: the body itself, or a multipart post's `payload_json` part (a notice's picture, D119). */
async function payloadOf(req, raw) {
  const type = req.headers["content-type"] ?? "";
  if (!type.startsWith("multipart/form-data")) return JSON.parse(raw.toString("utf8"));
  const form = await new Response(raw, { headers: { "content-type": type } }).formData();
  return JSON.parse(String(form.get("payload_json")));
}

const json = (res, body, status = 200) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

/** Each word of the text inside the prompt's <text> tags, backwards. */
function translated(prompt) {
  const user = prompt.messages.find((m) => m.role === "user")?.content ?? "";
  const inside = /<text>\n([\s\S]*)\n<\/text>/.exec(user)?.[1] ?? "";
  return inside.replace(/\S+/g, (word) => [...word].reverse().join(""));
}

async function answer(req, res) {
  const { pathname } = new URL(req.url, "http://stub");
  const raw = await bytes(req);
  const record = (extra = {}) =>
    received.push({ path: pathname, authorization: req.headers.authorization ?? null, ...extra });
  if (req.method === "GET" && pathname === "/__stub/received") return json(res, received);
  if (req.method === "GET" && pathname === "/v1/quota" && req.headers.authorization !== SITE_KEY) {
    record();
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(QUOTA);
  }
  if (req.method === "POST" && pathname === "/groq/openai/v1/chat/completions") {
    const body = await payloadOf(req, raw);
    const text = translated(body);
    record({ raw: raw.toString("utf8"), body, answer: text });
    return json(res, {
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: text } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
  }
  if (req.method === "POST" && WEBHOOK.test(pathname)) {
    record({ raw: raw.toString("utf8"), body: await payloadOf(req, raw) });
    // `?wait=true`: Discord answers with the message it made.
    return json(res, { id: String(received.length), channel_id: "1" });
  }
  req.socket.destroy();
}

// A body the stub cannot read (not JSON, no payload_json) answers 400; nothing throws out of the handler,
// so one bad request never stops the stub the whole suite shares.
createServer((req, res) =>
  answer(req, res).catch((error) => {
    if (res.headersSent) return res.destroy();
    json(res, { error: String(error?.message ?? error) }, 400);
  }),
).listen(port, "127.0.0.1");
