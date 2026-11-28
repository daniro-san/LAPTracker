// The link preview card of a public alliance, player or event page (issue 830, D164): 1200 × 630, the
// product's band in plum, then the page's name, one line under it and the figures (or, for an event, its top
// ledger rows) the page itself shows. Drawn by next/og with the brand's fonts, mark and yarn; no game art (no
// badge, no photo) and no URL. Text goes through `drawable`, so the renderer never fetches a font or emoji.
import { ImageResponse } from "next/og";

import { MarkLine } from "./brand/components/Logo";
import { YarnCorner } from "./brand/components/YarnCorner";
import { tokenColor } from "./brand/palette";
import { copy } from "./copy";
import { drawable, loadFonts } from "./event-image-parts";

export const CARD_SIZE = { width: 1200, height: 630 };

/** As long as the public JSON routes: the shared reads behind it change with every run (D143). */
export const CARD_CACHE = "public, max-age=300, s-maxage=300, stale-while-revalidate=3600";

/** A card URL with any query string (even a bare `?`), sent with a 308 to the same URL without it, before
 * anything is read or drawn: a made-up `?v=` cannot force a fresh render past the CDN copy. Null when the URL
 * has no query string. */
export function canonicalRedirect(request: Request): Response | null {
  if (!request.url.includes("?")) return null;
  const url = new URL(request.url);
  url.search = "";
  return Response.redirect(url.href.replace(/\?$/, ""), 308);
}

/** A change or a rank beside a figure: up in yarn, down in seal, a rank or no change in ink. */
export interface CardNote {
  text: string;
  sign: number;
}

export interface CardFigure {
  label: string;
  value: string;
  note?: CardNote | null;
}

export interface CardRow {
  rank: string;
  tag: string;
  name: string;
  value: string;
  note?: CardNote | null;
}

export interface LinkCard {
  title: string;
  subtitle: string | null;
  figures: CardFigure[];
  /** An event's top ledger rows, in place of figures. */
  rows?: CardRow[];
}

const c = {
  paper: tokenColor("paper"),
  ink: tokenColor("ink"),
  plum: tokenColor("plum"),
  seal: tokenColor("seal"),
  yarn: tokenColor("yarn"),
  rule: tokenColor("rule"),
};
const tone = (n: CardNote) => (n.sign > 0 ? c.yarn : n.sign < 0 ? c.seal : c.ink);
const line = { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" } as const;
const PAD = 64;

function Figure({ f }: { f: CardFigure }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 4 }}>
      <div style={{ fontFamily: "Alegreya Sans", fontWeight: 700, fontSize: 30, color: c.plum }}>
        {f.label}
      </div>
      <div style={{ fontFamily: "Source Sans 3", fontWeight: 600, fontSize: 72, lineHeight: 1 }}>
        {f.value}
      </div>
      {f.note && (
        <div
          style={{
            fontFamily: "Source Sans 3",
            fontWeight: 600,
            fontSize: 36,
            color: tone(f.note),
          }}
        >
          {f.note.text}
        </div>
      )}
    </div>
  );
}

function Row({ r }: { r: CardRow }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 62,
        gap: 18,
        fontFamily: "Source Sans 3",
        fontSize: 36,
        borderBottom: `2px solid ${c.rule}`,
      }}
    >
      <span style={{ width: 64, fontWeight: 600 }}>{r.rank}</span>
      <span style={{ display: "flex", flex: 1, gap: 12, minWidth: 0 }}>
        <span style={{ fontWeight: 600, flexShrink: 0 }}>{r.tag}</span>
        <span style={line}>{r.name}</span>
      </span>
      <span style={{ width: 170, justifyContent: "flex-end" }}>{r.value}</span>
      <span
        style={{
          width: 190,
          justifyContent: "flex-end",
          fontWeight: 600,
          color: r.note ? tone(r.note) : c.ink,
        }}
      >
        {r.note?.text ?? ""}
      </span>
    </div>
  );
}

const drawn = (f: CardFigure): CardFigure => ({ ...f, label: drawable(f.label) });

/** The card as a PNG response, cached like the public JSON routes. */
export function linkCardResponse(card: LinkCard): ImageResponse {
  const rows = card.rows?.map((r) => ({ ...r, tag: drawable(r.tag), name: drawable(r.name) }));
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        width: "100%",
        height: "100%",
        background: c.paper,
        color: c.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          height: 104,
          padding: `0 ${PAD}px`,
          background: c.plum,
          color: c.paper,
          fontFamily: "Alegreya",
          fontSize: 40,
        }}
      >
        <MarkLine size={72} />
        {copy.site.name}
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: `36px ${PAD}px 0` }}>
        <div style={{ ...line, fontFamily: "Alegreya", fontSize: 76, lineHeight: 1.15 }}>
          {drawable(card.title) || copy.site.shortName}
        </div>
        {card.subtitle && (
          <div style={{ ...line, fontFamily: "Source Sans 3", fontSize: 36, opacity: 0.75 }}>
            {drawable(card.subtitle)}
          </div>
        )}
      </div>
      {rows ? (
        <div style={{ display: "flex", flexDirection: "column", padding: `16px ${PAD}px 0` }}>
          {rows.map((r) => (
            <Row key={r.rank + r.tag} r={r} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 40, padding: `44px ${PAD}px 0` }}>
          {card.figures.map((f) => (
            <Figure key={f.label} f={drawn(f)} />
          ))}
        </div>
      )}
      <div style={{ display: "flex", position: "absolute", right: 24, bottom: 16, color: c.yarn }}>
        <YarnCorner />
      </div>
    </div>,
    {
      ...CARD_SIZE,
      fonts: loadFonts(),
      headers: { "Cache-Control": CARD_CACHE },
    },
  );
}
