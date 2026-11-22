// The e2e suite's stand-in for the outside services the desk calls (issue 477, flows 4 and 7), on
// 127.0.0.1:<port>. It answers three routes and keeps every request it answered in memory:
// - GET /v1/quota (LAP_API_BASE_URL): a workspace key's test (D124), with the recorded quota fixture. The
//   site's own key (LAP_API_KEY) gets no answer, as before the stub;
// - POST /groq/openai/v1/chat/completions: Translate (D81), each word of the text written backwards, so the
//   untranslated guard sees none of the source's words;
// - POST /discord/webhooks/<id>/<token>: a notice posted to Discord (D102).
// e2e/no-network.mjs sends Groq's and Discord's webhook URLs here. GET /__stub/received lists what was
// answered, for the specs. Any other request gets no answer: its body is read, then the socket is closed,
// so fetch fails with "fetch failed" and a cause with no system error code, as it did at 127.0.0.1:9 (a
// port fetch refuses before connecting). lib/sources' RequestError and lib/data-unavailable's databaseDown
// read both the same way.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { URL } from "node:url";

const port = Number(process.argv[2]);
const QUOTA = readFileSync("fixtures/v1-20261116T105019Z/quota-before.json", "utf8");
const SITE_KEY = `Bearer ${process.env.LAP_API_KEY}`;
const WEBHOOK = /^\/discord\/webhooks\/\d+\/[\w-]+$/;

/** What each answered request carried: its path, the Authorization header, and the parsed JSON body. */
const received = [];

const text = async (req) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
};

const json = (res, body) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

/** Each word of the text inside the prompt's <text> tags, backwards. */
function translated(prompt) {
  const user = prompt.messages.find((m) => m.role === "user")?.content ?? "";
  const inside = /<text>\n([\s\S]*)\n<\/text>/.exec(user)?.[1] ?? "";
  return inside.replace(/\S+/g, (word) => [...word].reverse().join(""));
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://stub");
  const body = await text(req);
  const record = (extra = {}) =>
    received.push({ path: pathname, authorization: req.headers.authorization ?? null, ...extra });
  if (req.method === "GET" && pathname === "/__stub/received") return json(res, received);
  if (req.method === "GET" && pathname === "/v1/quota" && req.headers.authorization !== SITE_KEY) {
    record();
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(QUOTA);
  }
  if (req.method === "POST" && pathname === "/groq/openai/v1/chat/completions") {
    const answer = translated(JSON.parse(body));
    record({ body: JSON.parse(body), answer });
    return json(res, {
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: answer } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
  }
  if (req.method === "POST" && WEBHOOK.test(pathname)) {
    record({ body: JSON.parse(body) });
    // `?wait=true`: Discord answers with the message it made.
    return json(res, { id: String(received.length), channel_id: "1" });
  }
  req.socket.destroy();
}).listen(port, "127.0.0.1");
