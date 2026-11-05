// DESIGN.md `empty-state`: a cup of tea, small, above one display-sm line.
import type { ReactNode } from "react";

import { Teacup } from "@/lib/brand/components/Vignettes";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <Teacup className="w-32 text-plum" />
      <p className="mt-3 max-w-[32ch] font-display text-display-sm font-semibold">{children}</p>
    </div>
  );
}
