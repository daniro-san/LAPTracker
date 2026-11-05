// The Discord webhook transport (D31): post a message and keep its id, or edit the one we posted.
// The webhook URL is a secret: never log it, never put it in an error (a fetch error can carry it).
const SEND_TIMEOUT_MS = 5_000;

async function call(fetchFn: typeof fetch, method: "POST" | "PATCH", url: string, body: object) {
  try {
    return await fetchFn(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

async function post(fetchFn: typeof fetch, webhook: string, body: object) {
  const res = await call(fetchFn, "POST", `${webhook}?wait=true`, body);
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
): Promise<string | null> {
  if (!webhook) return null;
  if (!messageId) return post(fetchFn, webhook, body);
  const res = await call(
    fetchFn,
    "PATCH",
    `${webhook}/messages/${encodeURIComponent(messageId)}`,
    body,
  );
  if (res?.ok) return messageId;
  if (res?.status === 404) return post(fetchFn, webhook, body);
  console.error("notify.failed", { http_status: res?.status ?? null });
  return messageId;
}
