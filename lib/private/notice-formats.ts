// A notice's text in each place it is pasted or posted (issue 345, D102), pure and browser-safe:
// - the game's notice board: plain text, `\n` line breaks, at most NOTICE_LIMIT characters, cut after the
//   last whole line that fits;
// - the game's mail: the same plain text, not cut (the mail's own limit is unknown);
// - Discord: the title in bold over the text, with the officer's text shown literally (Discord markdown
//   escaped, outside web addresses) and @everyone, @here and user mentions broken, so a paste never pings.
// The game's board and mail have their own title field, so the two game formats carry the text alone.
import { NOTICE_LIMIT, noticeLength } from "./notice-rules";

/** One Discord message's room. */
export const DISCORD_LIMIT = 2000;
/** A forum post's title (thread name) room. */
export const THREAD_NAME_LIMIT = 100;

/** `\n` line ends, no spaces at a line's end, no blank lines at the start or the end. */
export function gameText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/^\n+|\n+$/g, "");
}

const graphemes = new Intl.Segmenter();
const split = (text: string) => Array.from(graphemes.segment(text), (s) => s.segment);
const firstGraphemes = (text: string, n: number) => split(text).slice(0, n).join("");

/** The longest run of whole graphemes from the start whose length (UTF-16, as Discord counts) fits. */
function within(text: string, limit: number): string {
  let head = "";
  for (const g of split(text)) {
    if (head.length + g.length > limit) break;
    head += g;
  }
  return head;
}

/** For the game's notice board: cut after the last whole line (else word) within the limit. */
export function gameNotice(text: string): { text: string; cut: boolean } {
  const plain = gameText(text);
  if (noticeLength(plain) <= NOTICE_LIMIT) return { text: plain, cut: false };
  const all = split(plain);
  const head = all.slice(0, NOTICE_LIMIT).join("");
  // What follows the head: a line break (or a space, for one long line) means the head ends whole.
  const next = all[NOTICE_LIMIT];
  const line = next === "\n" ? head.length : head.lastIndexOf("\n");
  const word = next === " " ? head.length : head.lastIndexOf(" ");
  const at = line > 0 ? line : word > 0 ? word : head.length;
  return { text: head.slice(0, at).trimEnd(), cut: true };
}

/** For the game's mail. */
export const gameMail = (text: string): string => gameText(text);

const WEB = /(https?:\/\/\S+)/;

/** Officer text shown literally in Discord: markdown escaped (web addresses kept), mentions broken. */
export function discordLiteral(text: string): string {
  return text
    .split(WEB)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/[\\*_~`|]/g, "\\$&")))
    .join("")
    .replace(/^([ \t]*)(#|>|-#)/gm, "$1\\$2")
    .replace(/@(everyone|here)/g, "@\u200b$1")
    .replace(/<@/g, "<@\u200b");
}

/** "Copy for Discord": the title in bold, a blank line, the text. */
export const discordPost = (title: string, text: string): string =>
  `**${discordLiteral(title.trim())}**\n\n${discordLiteral(gameText(text))}`;

/**
 * A block longer than one message, split at line breaks; a longer line is split where it must, between
 * whole graphemes, so an emoji or an accented letter is never cut in two.
 */
function pieces(block: string): string[] {
  const out: string[] = [];
  let current = "";
  for (const line of block.split("\n")) {
    for (let rest = line; ;) {
      const next = current === "" ? rest : `${current}\n${rest}`;
      if (next.length <= DISCORD_LIMIT) {
        current = next;
        break;
      }
      if (current !== "") {
        out.push(current);
        current = "";
        continue;
      }
      const head = within(rest, DISCORD_LIMIT);
      out.push(head);
      rest = rest.slice(head.length);
    }
  }
  return current === "" ? out : [...out, current];
}

/**
 * "Publish to Discord": the chosen languages as messages of at most DISCORD_LIMIT characters each. Each
 * language under its name when there are several; the title in bold first unless it is the forum post's
 * own title. Whole languages share a message while they fit. `lead`, a line already made safe for Discord
 * (the alliance's own line, D156), goes first, on a line of its own above the title.
 */
export function discordMessages(
  title: string,
  sections: { name: string; text: string }[],
  titleInBody: boolean,
  lead = "",
): string[] {
  const head = titleInBody ? `**${discordLiteral(title.trim())}**` : "";
  const top = [lead, head].filter(Boolean).join("\n");
  const blocks = [
    ...(top ? [top] : []),
    ...sections.map(({ name, text }) => {
      const body = discordLiteral(gameText(text));
      return sections.length > 1 ? `**${name}**\n${body}` : body;
    }),
  ];
  const messages: string[] = [];
  for (const block of blocks) {
    const last = messages.at(-1);
    if (last !== undefined && last.length + 2 + block.length <= DISCORD_LIMIT) {
      messages[messages.length - 1] = `${last}\n\n${block}`;
    } else messages.push(...pieces(block));
  }
  return messages;
}

/** A forum post's title: the notice's title, cut to the thread name's room. */
export const threadName = (title: string): string =>
  firstGraphemes(title.trim(), THREAD_NAME_LIMIT);
