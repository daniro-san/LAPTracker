// /brand "Type": the three families in their roles and the type scale (docs/DESIGN.md "Typography").
import { copy } from "@/lib/copy";

import { Section, Sub } from "./parts";

const t = copy.brand.type;

const FACES = [
  ["display", "font-display"],
  ["subhead", "font-subhead"],
  ["body", "font-body"],
] as const;

// Each step of the scale: copy key, DESIGN.md token name, the classes the site uses for it.
const SCALE = [
  ["displayXl", "display-xl", "font-display text-display-xl"],
  ["displayLg", "display-lg", "font-display text-display-lg"],
  ["displayMd", "display-md", "font-subhead text-display-md"],
  ["displaySm", "display-sm", "font-subhead text-display-sm"],
  ["body", "body", "text-body"],
  ["bodySm", "body-sm", "text-body-sm"],
  ["numeral", "numeral", "font-medium tabular-nums"],
  ["label", "label", "text-label font-semibold tracking-[0.04em] uppercase"],
] as const;

export function TypeSection() {
  return (
    <Section id="type" title={t.title} lede={t.lede}>
      <ul className="grid gap-6 sm:grid-cols-3">
        {FACES.map(([key, face]) => (
          <li key={key} className="border border-rule p-4">
            <p className={`${face} text-display-xl text-plum`} aria-hidden="true">
              {t.specimen}
            </p>
            <p className={`${face} mt-2 text-display-sm`}>{t.faces[key].name}</p>
            <p className="mt-1 text-body-sm text-ink/70">{t.faces[key].role}</p>
          </li>
        ))}
      </ul>
      <Sub title={t.scaleTitle}>
        <ul className="border-t border-rule">
          {SCALE.map(([key, token, style]) => (
            <li
              key={key}
              className="grid gap-x-6 gap-y-1 border-b border-rule py-3 sm:grid-cols-[1fr_16rem] sm:items-baseline"
            >
              <p className={`${style} break-words`}>{t.scale[key].sample}</p>
              <p className="text-body-sm text-ink/70">
                <code className="font-body text-ink">{token}</code> · {t.scale[key].spec} ·{" "}
                {t.scale[key].use}
              </p>
            </li>
          ))}
        </ul>
      </Sub>
    </Section>
  );
}
