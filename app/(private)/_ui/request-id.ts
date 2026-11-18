// A write's request id (D100), a v4 UUID. `crypto.randomUUID` is missing on Safari before 15.4 and on older
// Android WebViews, where calling it threw a TypeError and broke the theft form, the notice editor and the
// calendar's entry form (issue 395, D115). Those browsers build the same kind of id from getRandomValues.
export function newRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
