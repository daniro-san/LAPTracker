// The Roll call tab's one write call (issue 298): a same-origin JSON POST (D71) and its answer as data. A
// 401 is SIGNED_OUT, which RefusalLine shows as the sign-in note (D99); no answer at all is status 0.
export async function sendRoll<T extends object>(
  slug: string,
  body: object,
): Promise<{ status: number; json: Partial<T> & { code?: string } }> {
  try {
    const res = await fetch(`/api/w/${slug}/roll-call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Partial<T> };
  } catch {
    return { status: 0, json: {} };
  }
}
