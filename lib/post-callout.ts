// An alliance's own line at the top of a post LAPTracker makes for it (#713, D156): pure, for the server and
// the settings card's preview and count. Officers write it once per post; it is posted as written, never
// translated. In Discord it shows literally and reaches no one: `escapeDiscord` (markdown, @everyone, @here,
// user and role mentions), then what that leaves live in a line that opens a message: a heading or subtext
// mark at its start, a web address or a bare domain, a channel or command mention. It imports only
// lib/markdown-escape.ts, so lib/private may use it without reaching lib/notify* or lib/discord-* (D71).
import { escapeDiscord } from "./markdown-escape";

/** The most graphemes a line holds: an emoji with its skin tone is one. */
export const CALLOUT_LIMIT = 120;
/** One Discord message's room (UTF-16 code units, as Discord counts). */
const MESSAGE_LIMIT = 2000;

const graphemes = new Intl.Segmenter();
export const calloutLength = (text: string) => Array.from(graphemes.segment(text)).length;

/**
 * Control and format characters (General_Category Cc and Cf: zero-width spaces, direction marks and
 * overrides, the soft hyphen, the Arabic letter mark, the Mongolian vowel separator, tag characters …),
 * which could hide or flip the line. The zero-width joiner stays: emoji such as a family are built with it.
 * Variation selectors are not Cf, so an emoji's style stays too.
 */
const HIDDEN = /(?!\u200D)[\p{Cc}\p{Cf}]/gu;

/** The line as stored and counted: one line, single spaces, nothing hidden, trimmed. Empty: no line. */
export const cleanCallout = (text: string) =>
  text.replace(/\s+/g, " ").replace(HIDDEN, "").replace(/ {2,}/g, " ").trim();

const ZWSP = "\u200B";
/** A dot between two characters of a host name: label.tld, an address's dots, the ideographic dots too. */
const HOST_DOT = /(?<=[\p{L}\p{N}-])[.\u3002\uFF0E\uFF61](?=[\p{L}\p{N}])/gu;

/**
 * The line as Discord gets it: literal, linking nothing, pinging no one. A web address's `://` and every dot
 * inside a host name get a zero-width space, the same invisible break D102 uses after `@`: a host name holds
 * only letters, digits and hyphens (RFC 1123), so no link finder reads `evil\u200B.example` as one host.
 */
export const discordCallout = (text: string) =>
  escapeDiscord(cleanCallout(text))
    .replace(/^(-#|#)/, "\\$1")
    .replace(/:\/\//g, `:${ZWSP}//`)
    .replace(HOST_DOT, (dot) => `${ZWSP}${dot}`)
    .replace(/<([#/])/g, `<${ZWSP}$1`);

/**
 * A one-message post's text with the line above it. Left out when the two would pass Discord's 2,000
 * characters (a line of stacked combining marks is short in graphemes, long in characters), so the post
 * itself is never cut.
 */
export const withCallout = (line: string, content: string) =>
  line && line.length + 1 + content.length <= MESSAGE_LIMIT ? `${line}\n${content}` : content;
