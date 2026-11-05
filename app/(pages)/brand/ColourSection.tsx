// /brand "Colour": every token with its role and its light and dark values, read from
// lib/brand/tokens.css (lib/brand/palette.ts), so no colour literal is typed here.
import { tokenColor, TOKENS, type Token } from "@/lib/brand/palette";
import { copy } from "@/lib/copy";

import { Rules, Section } from "./parts";

const t = copy.brand.colour;

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-11 shrink-0 border border-rule"
        style={{ background: value }}
      />
      <div>
        <p className="text-label font-semibold tracking-[0.04em] uppercase">{label}</p>
        <p className="font-medium tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function TokenRow({ name }: { name: Token }) {
  return (
    <li className="grid gap-x-6 gap-y-3 border-b border-rule py-4 sm:grid-cols-[1fr_auto]">
      <div>
        <p className="font-semibold">
          {t.names[name]} <code className="font-body text-body-sm text-ink/70">--{name}</code>
        </p>
        <p className="text-body-sm text-ink/70">{t.roles[name]}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:w-72">
        <Value label={t.light} value={tokenColor(name, "light")} />
        <Value label={t.dark} value={tokenColor(name, "dark")} />
      </div>
    </li>
  );
}

export function ColourSection() {
  return (
    <Section id="colour" title={t.title} lede={t.lede}>
      <ul className="mb-8 border-t border-rule">
        {TOKENS.map((name) => (
          <TokenRow key={name} name={name} />
        ))}
      </ul>
      <Rules items={t.rules} />
    </Section>
  );
}
