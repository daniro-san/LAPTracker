// One webhook post's body for "Publish to Discord" (D102): JSON, or with the notice's picture (D119) the
// multipart form Discord's webhook takes. Apart from notice-publish.ts for its size.

/** A notice's picture as Discord receives it (D119): a file beside the first message. */
export interface PostedPicture {
  data: Uint8Array;
  type: string;
}

const EXTENSION: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * The request's body: JSON, or with a picture `payload_json` beside `files[0]`, the embed's image pointing at
 * the attachment.
 */
export function bodyOf(payload: object, picture: PostedPicture | null): RequestInit {
  if (!picture) {
    return { headers: { "content-type": "application/json" }, body: JSON.stringify(payload) };
  }
  const name = `notice.${EXTENSION[picture.type] ?? "webp"}`;
  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      ...payload,
      embeds: [{ image: { url: `attachment://${name}` } }],
      attachments: [{ id: 0, filename: name }],
    }),
  );
  form.append("files[0]", new Blob([new Uint8Array(picture.data)], { type: picture.type }), name);
  // No content-type of our own: fetch sets multipart/form-data with its boundary.
  return { body: form };
}
