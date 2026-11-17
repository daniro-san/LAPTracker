// The alliance page's three links beside its title: the member history (D60), the merge simulator, which
// opens with this alliance as A (D84), and the member flow (D89).
import { TextLink } from "@/lib/brand/components/TextLink";
import type { Dictionary } from "@/lib/copy";

import { FLOW_PATH } from "./FlowPicker";
import { mergeHref } from "./MergePicker";

const LINK = "inline-flex min-h-11 items-center px-2 text-sm font-medium";

export function AllianceLinks({ unionId, copy }: { unionId: number; copy: Dictionary }) {
  return (
    <>
      <TextLink href={`/alliances/${unionId}/history`} className={LINK}>
        {copy.history.title} <span aria-hidden="true">&nbsp;→</span>
      </TextLink>
      <TextLink href={mergeHref(unionId, null)} className={LINK}>
        {copy.merge.link} <span aria-hidden="true">&nbsp;→</span>
      </TextLink>
      <TextLink href={FLOW_PATH} className={LINK}>
        {copy.flow.title} <span aria-hidden="true">&nbsp;→</span>
      </TextLink>
    </>
  );
}
