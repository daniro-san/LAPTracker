// DESIGN.md `empty-state`: the Granny Doctor with her tea, small, above one display-sm line.
import type { ReactNode } from "react";

import { GrannyTea } from "@/lib/brand/components/Mascot";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <GrannyTea className="w-40 text-plum" />
      <p className="mt-3 max-w-[32ch] font-subhead text-display-sm font-semibold">{children}</p>
    </div>
  );
}
