// Home's one-time notifications hint (D148), on the server: only while the site has push keys. The browser
// part (hidden once, or once this device has notifications on) is PushHint.
import { getEnv } from "@/lib/env";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { pushConfig } from "@/lib/push";

import { PushHint } from "./PushHint";

export function NotificationsHint({ slug, t }: { slug: string; t: WorkspaceDictionary }) {
  if (!pushConfig(getEnv())) return null;
  const words = { hint: t["push.hint"], link: t["push.hintLink"], close: t["push.hintClose"] };
  return <PushHint slug={slug} words={words} />;
}
