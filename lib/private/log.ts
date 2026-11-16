// The workspace's one log (D71): a code and numbers. No names, Discord ids, tokens or roster fields can
// reach it, because the type takes nothing else. lib/private never imports lib/notify* or lib/discord-*.
export function privateLog(code: string, numbers: Record<string, number> = {}): void {
  console.info(JSON.stringify({ code, ...numbers }));
}
