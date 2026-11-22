// The members' board's account line (D105), on the board and on a member's own page (D142): "Signed in as
// … · Sign out"; an officer's preview names no officer, and reads as a member's would.
import { isolate } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { fill } from "@/lib/words";

import { SignOutButton } from "./SignOutButton";

export function BoardAccount(props: {
  officer: boolean;
  name: string;
  slug: string;
  t: WorkspaceDictionary;
}) {
  const { t } = props;
  if (props.officer) return <span className="min-w-0 truncate py-2">{t["board.previewing"]}</span>;
  return (
    <>
      <span className="min-w-0 truncate">
        {fill(t["shell.signedIn"], { name: isolate(props.name) })}
      </span>
      <SignOutButton
        slug={props.slug}
        words={{ label: t["shell.signOut"], ask: t["shell.signOutAsk"], stay: t["shell.stay"] }}
      />
    </>
  );
}
