// Text people type, shown literally in a Discord message: the one escaper, in a module that imports nothing,
// so lib/private (fenced off lib/notify* and lib/discord-*, D71) can make an officer's line safe (D156)
// without reaching a module that sends. lib/discord-format.ts re-exports it for its own callers.

/**
 * Text people type (a round's name; an alliance's tag and name, or a member's name, typed in game) shows
 * literally: Discord markdown is backslash-escaped and mentions get a zero-width space after the `@`. Pure,
 * so the desk's "Copy names" uses it in the browser too (issue 585).
 */
export const escapeDiscord = (text: string) =>
  text
    .replace(/[\\*_~`|>[\]]/g, "\\$&")
    .replace(/@(everyone|here)/g, "@\u200B$1")
    .replace(/<@/g, "<@\u200B");
