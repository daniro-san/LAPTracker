// One request to Follow-up's route (issue 340, D104): a record or an undo, from Follow-up's list and panel
// and from the member card (issue 516). Its own module, so the card and the panel share it without one
// importing the other. Null when no answer came back.
type Sent = { status: number; body: { version?: number; said?: string } };

export async function send(slug: string, body: object): Promise<Sent | null> {
  const res = await fetch(`/api/w/${slug}/follow-up`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return null;
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Sent["body"] };
}
