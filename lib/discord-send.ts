// The Discord webhook transport (D31): post a message and keep its id, or edit the one we posted.
// The webhook URL is a secret: never log it, never put it in an error (a fetch error can carry it).
const SEND_TIMEOUT_MS = 5_000;

/** A file sent with the message (D58): `files[0]` beside `payload_json`, as Discord's upload expects. */
export interface Attachment {
  name: string;
  data: Uint8Array<ArrayBuffer>;
}

/** A new body per request: the 404 re-post sends the same message again. */
function encode(body: object, file?: Attachment): RequestInit {
  if (!file) {
    return { headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  }
  // No content-type of our own: fetch sets multipart/form-data with its boundary.
  const form = new FormData();
  form.append("payload_json", JSON.stringify(body));
  form.append("files[0]", new Blob([file.data], { type: "image/png" }), file.name);
  return { body: form };
}

async function call(
  fetchFn: typeof fetch,
  method: "POST" | "PATCH",
  url: string,
  body: object,
  file?: Attachment,
) {
  try {
    return await fetchFn(url, {
      method,
      ...encode(body, file),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

async function post(fetchFn: typeof fetch, webhook: string, body: object, file?: Attachment) {
  const res = await call(fetchFn, "POST", `${webhook}?wait=true`, body, file);
  if (!res?.ok) {
    console.error("notify.failed", { http_status: res?.status ?? null });
    return null;
  }
  const created = (await res.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof created?.id === "string") return created.id;
  console.error("notify.no_message_id");
  return null;
}

/**
 * Edits `messageId` when given, else posts. Returns the id to store, or null when Discord returned
 * none. A 404 (the message was deleted) posts a new one; any other failed edit keeps the id, since a
 * later edit may work and posting now would make the second message this exists to avoid.
 */
export async function sendOrEdit(
  fetchFn: typeof fetch,
  webhook: string | undefined,
  body: object,
  messageId?: string | null,
  file?: Attachment,
): Promise<string | null> {
  if (!webhook) return null;
  if (!messageId) return post(fetchFn, webhook, body, file);
  const res = await call(
    fetchFn,
    "PATCH",
    `${webhook}/messages/${encodeURIComponent(messageId)}`,
    body,
    file,
  );
  if (res?.ok) return messageId;
  if (res?.status === 404) return post(fetchFn, webhook, body, file);
  console.error("notify.failed", { http_status: res?.status ?? null });
  return messageId;
}
