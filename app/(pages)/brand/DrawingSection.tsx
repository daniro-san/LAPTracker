// /brand "Drawing style": the confident-nib rules (docs/brand/DRAWING.md) with the drawings as examples.
import { GrannyStanding, GrannyTea } from "@/lib/brand/components/Mascot";
import { Crown, OfficerStar } from "@/lib/brand/components/RoleMark";
import { Hourglass } from "@/lib/brand/components/StatusIcons";
import { CrackedBottle, Teacup, YarnLeftBehind } from "@/lib/brand/components/Vignettes";
import { Wax } from "@/lib/brand/components/Wax";
import { copy } from "@/lib/copy";

import { Rules, Section, Spec, Sub } from "./parts";

const t = copy.brand.drawing;
const PLATE = "text-plum";

export function DrawingSection() {
  return (
    <Section id="drawing" title={t.title} lede={t.lede}>
      <Rules items={t.rules} />
      <Sub title={t.vignettes}>
        <div className="grid gap-6 sm:grid-cols-3">
          <Spec name={t.yarn} plate={PLATE}>
            <YarnLeftBehind className="w-40" />
          </Spec>
          <Spec name={t.bottle} plate={PLATE}>
            <CrackedBottle className="w-40" />
          </Spec>
          <Spec name={t.teacup} plate={PLATE}>
            <Teacup className="w-40" />
          </Spec>
        </div>
      </Sub>
      <Sub title={t.mascot}>
        <p className="-mt-2 mb-4 text-body-sm text-ink/70">{t.mascotNote}</p>
        <div className="grid gap-6 sm:grid-cols-3">
          <Spec name={t.standing} plate={PLATE}>
            <GrannyStanding className="w-28" />
          </Spec>
          <Spec name={t.tea} plate={PLATE}>
            <GrannyTea className="w-40" />
          </Spec>
        </div>
      </Sub>
      <Sub title={t.ornaments}>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <Spec name={t.wax} plate="text-seal">
            <Wax className="size-16" />
          </Spec>
          <Spec name={t.hourglass} plate="text-plum [&_svg]:size-12">
            <Hourglass />
          </Spec>
          <Spec name={t.crown} plate="text-plum [&_svg]:size-12">
            <Crown />
          </Spec>
          <Spec name={t.officer} plate="text-sage [&_svg]:size-12">
            <OfficerStar />
          </Spec>
        </div>
      </Sub>
    </Section>
  );
}
