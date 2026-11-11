// /brand "Hover and press": each kind of control at rest, hovered and pressed, pinned with `data-state`
// (issue 232). The samples are inert: they only show the looks.
import { Button } from "@/lib/brand/components/Button";
import { SealButton } from "@/lib/brand/components/SealButton";
import { copy } from "@/lib/copy";

import { Spec } from "./parts";

const t = copy.brand.components;
const STATES = ["rest", "hover", "press"] as const;

export function ButtonStates() {
  const s = t.states;
  return (
    <Spec name={s.name} use={s.use}>
      {STATES.map((state) => {
        const pin = state === "rest" ? undefined : state;
        return (
          <div key={state} className="flex flex-col items-center gap-3">
            <p className="text-label font-semibold text-ink/70 uppercase">{s[state]}</p>
            <div inert className="flex flex-col items-center gap-3">
              <Button data-state={pin}>{t.primary.label}</Button>
              <Button variant="secondary" data-state={pin}>
                {t.secondary.label}
              </Button>
              <SealButton label={t.seal.label} data-state={pin} />
              <span
                data-state={pin}
                className="drawn-frame-soft tint-button inline-flex min-h-11 items-center px-3 text-body-sm font-medium text-plum"
              >
                {s.chip}
              </span>
              <span
                data-state={pin}
                className="text-button inline-flex min-h-11 items-center font-medium text-plum"
              >
                {s.text}
              </span>
            </div>
          </div>
        );
      })}
    </Spec>
  );
}
