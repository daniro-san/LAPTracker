// /w — "Sign in" from the public site (D131, issue 457). One Discord sign-in finds every alliance this account
// may open; the callback goes straight to the only one, or back here with the list. The list is read from
// this browser's own session cookies, so it names no other workspace. "Request an Officers' Desk for your
// alliance" leads an alliance's leadership to /w/request (D130).
import { cookies } from "next/headers";

import { Measure } from "@/lib/brand/components/layout/Measure";
import { withPageDb } from "@/lib/page";
import { chooserView } from "@/lib/private/chooser";

import { Chooser } from "../../_ui/Chooser";
import { Frame, workspaceWords } from "../../_ui/Frame";

export default async function ChooserPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const jar = await cookies();
  const rows = await withPageDb((db) => chooserView(db, jar, new Date()));
  const { language, t } = await workspaceWords();
  return (
    // Members sign in here too: the bar names the site, not the Officers' Desk.
    <Frame language={language} t={t} title="LAPTracker">
      <Measure form>
        <Chooser rows={rows} e={(await searchParams).e} t={t} />
      </Measure>
    </Frame>
  );
}
