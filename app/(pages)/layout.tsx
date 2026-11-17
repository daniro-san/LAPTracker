// The public pages and /admin: the "Game data is delayed" banner above them (D27). The workspace (/w)
// does not get it: its calendar, notices and thefts are the officers' own, and Members names its own
// read (panel ADV-16).
import type { ReactNode } from "react";

import { UpstreamBanner } from "../_ui/UpstreamBanner";

export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UpstreamBanner />
      {children}
    </>
  );
}
