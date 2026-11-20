// Alliance settings → Discord (D129): the one request both parts send, and the line under a button.
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export type Note = { ok: boolean; text: string } | null;

/**
 * POST /api/w/[slug]/discord. `code`: null when it went through, else the refusal's code ("failed" for no
 * answer). `refusal`: the signed-out note's marker when the session is gone, for RefusalLine.
 */
export async function postDiscord(
  slug: string,
  body: object,
): Promise<{ code: string | null; refusal: string | null; body: Record<string, unknown> }> {
  try {
    const res = await fetch(`/api/w/${slug}/discord`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    if (res.ok) return { code: null, refusal: null, body: json };
    const code = typeof json.code === "string" ? json.code : "failed";
    return { code, refusal: code === SIGNED_OUT ? SIGNED_OUT : null, body: json };
  } catch {
    return { code: "failed", refusal: null, body: {} };
  }
}

/** What went through, or the refusal (the signed-out note included). */
export function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  if (!note.ok) return <RefusalLine text={note.text} className="mt-2 font-semibold text-seal" />;
  return (
    <p role="status" className="mt-2 font-semibold">
      {note.text}
    </p>
  );
}
