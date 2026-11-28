// What "Send screenshots" sends (issue 299): each picture drawn on a canvas as a PNG, without the phone's
// status bar and at most MAX_WIDTH wide, posted for reading one per request (under Vercel's body limit).
// Moved out of SendScreenshots.tsx for its size.

/** Wide enough for the OCR (it reads at 716 px), small enough to upload quickly. */
const MAX_WIDTH = 1080;

/** The picture as a PNG: the top band of a full-screen phone capture dropped, scaled down when wide. */
export async function toPng(
  file: File,
  statusBar: { share: number; aspect: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const top =
    bitmap.height >= bitmap.width * statusBar.aspect
      ? Math.round(bitmap.height * statusBar.share)
      : 0;
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round((bitmap.height - top) * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(
    bitmap,
    0,
    top,
    bitmap.width,
    bitmap.height - top,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no png"))), "image/png"),
  );
}

/** A POST whose failure throws an Error carrying the HTTP status, and the answer's code as its cause. */
export async function post(url: string, body: BodyInit, type: string) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": type }, body });
  if (!res.ok) {
    const code = ((await res.json().catch(() => null)) as { code?: string } | null)?.code;
    throw new Error(String(res.status), { cause: code });
  }
  return res.json();
}

/** Whether `post` failed on a 401: the session ended (D99). */
export const isSignedOut = (e: unknown) => e instanceof Error && e.message === "401";

/** Whether `post` failed because the free plan's screenshots for the week are used (D162). */
export const isCapReached = (e: unknown) => e instanceof Error && e.cause === "cap_reached";

/**
 * Each picture's text lines, one request each; a picture that cannot be converted or read is skipped.
 * A 401 stops the reading: the session ended, so no picture is wrongly called unreadable (ADV-1). So does
 * the week's cap on the free plan (D162, `capped`).
 */
export async function readAll(
  files: File[],
  slug: string,
  statusBar: { share: number; aspect: number },
  onProgress: (p: { n: number; total: number }) => void,
): Promise<{ pages: string[][]; signedOut: boolean; capped?: true }> {
  const pages: string[][] = [];
  for (const [i, file] of files.entries()) {
    onProgress({ n: i + 1, total: files.length });
    if (!file.type.startsWith("image/")) continue;
    try {
      const png = await toPng(file, statusBar);
      const read = (await post(`/api/w/${slug}/shots/read`, png, "image/png")) as {
        lines: string[];
      };
      pages.push(read.lines);
    } catch (e) {
      if (isSignedOut(e)) return { pages, signedOut: true };
      if (isCapReached(e)) return { pages, signedOut: false, capped: true };
      // Otherwise counted by the caller as a picture that could not be read.
    }
  }
  return { pages, signedOut: false };
}

/**
 * "Read from a screenshot" (D109): the text lines read from each picture, as the paste box holds pasted
 * text, one line per line, so the paste's own reading ("Fill the fields", "Paste updates") runs on it.
 */
export const pictureText = (pages: readonly (readonly string[])[]) =>
  pages
    .flat()
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .join("\n");
