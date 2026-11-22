// An alliance's own line at the top of a post LAPTracker makes for it (#713, D156): pure, for the server and
// the settings card's preview. Officers write it once per post; it is posted as written, never translated.
// In Discord it shows literally and reaches no one: `escapeDiscord` (markdown, @everyone, @here, user and
// role mentions), then what that leaves live in a line that opens a message: a heading or subtext mark at
// its start, a web address, an invite, a channel or command mention.
import { escapeDiscord } from "./discord-format";

/** The most graphemes a line holds: an emoji with its skin tone is one. */
export const CALLOUT_LIMIT = 120;

const graphemes = new Intl.Segmenter();
export const calloutLength = (text: string) => Array.from(graphemes.segment(text)).length;

/**
 * Control characters, zero-width spaces and direction marks, overrides and isolates, which could hide or
 * flip the line. The zero-width joiner stays: emoji such as a family are built with it.
 */
const HIDDEN = /[\p{Cc}\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/gu;

/** The line as stored: one line, single spaces, nothing hidden, trimmed. Empty: no line. */
export const cleanCallout = (text: string) =>
  text.replace(/\s+/g, " ").replace(HIDDEN, "").replace(/ {2,}/g, " ").trim();

const ZWSP = "\u200b";

/** The line as Discord gets it: literal, linking nothing, pinging no one. */
export const discordCallout = (text: string) =>
  escapeDiscord(cleanCallout(text))
    .replace(/^(-#|#)/, "\\$1")
    .replace(/:\/\//g, `:${ZWSP}//`)
    .replace(/discord(app)?\.(gg|com\/invite)/gi, (m) => m.replace(".", `${ZWSP}.`))
    .replace(/<([#/])/g, `<${ZWSP}$1`);

/** The first message's text with the line above it; unchanged with no line. */
export const withCallout = (callout: string | null, content: string) => {
  const line = callout ? discordCallout(callout) : "";
  return line ? `${line}\n${content}` : content;
};
