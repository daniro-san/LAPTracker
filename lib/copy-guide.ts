// What each error means and what to do about it (D61), on /admin and in the daily read's admin message.
// Split out of lib/copy-admin.ts to keep each file readable; it is `copy.admin.guide`. English only (D48).
export const guideCopy = {
  title: "What it means",
  details: "Details",
  path: "Request",
  status: "HTTP status",
  timeout: "Waited",
  timeoutValue: "{s} s, no answer",
  cause: "Cause",
  headers: "Headers",
  body: "Answer (start)",
  message: "Message",
  stack: "Where",
  entries: {
    timeout: {
      meaning: "The game's API did not answer within 30 seconds.",
      action:
        "The problem is on their side. Wait a while, then use Retry or press the snapshot again.",
    },
    network: {
      meaning: "The request did not reach the game's API (DNS, TLS or a dropped connection).",
      action: "It usually passes by itself. If it repeats for hours, their host may be down.",
    },
    gateway: {
      meaning: "The game's API answered HTTP {status}, still after 3 retries.",
      action: "Their service is overloaded or down. Wait, then retry.",
    },
    quota: {
      meaning: "Today's 1,000 API requests are spent (HTTP 429).",
      action: "Wait for the reset at 00:00 UTC (22:00 server time).",
    },
    quotaRule: {
      meaning: "Too few requests were left to read and still keep the reserve for the event.",
      action: "Wait for the reset at 00:00 UTC (22:00 server time).",
    },
    auth: {
      meaning: "The game's API refused the key (HTTP {status}).",
      action: "Check LAP_API_KEY in Vercel: the key may be expired or revoked.",
    },
    notFound: {
      meaning: "The game's API has no alliance with this id.",
      action: "The alliance may be gone. Check its id in config/alliances.ts.",
    },
    http: {
      meaning: "The game's API answered HTTP {status}.",
      action: "Open the details: their answer usually says why.",
    },
    schema: {
      meaning: "The API's answer no longer has the fields the app reads.",
      action: "Send the details to the maintainer: the parser needs an update.",
    },
    notFetched: {
      meaning: "The read stopped before it reached this alliance.",
      action: "Follow the advice for the reason it stopped and for the other alliances' errors.",
    },
    deadline: {
      meaning: "The run reached its 100-second limit.",
      action: "The game's API was slow. Wait, then retry.",
    },
    callCap: {
      meaning: "The run used all of its 120 calls.",
      action: "Many calls were retried. Check the other errors.",
    },
    page: {
      meaning: "A page or an API route failed on the server.",
      action:
        "The message and the first lines of 'Where' say what broke. Send them to the maintainer.",
    },
    unknown: {
      meaning: "No explanation for this error yet.",
      action: "Send the details to the maintainer.",
    },
  },
};
