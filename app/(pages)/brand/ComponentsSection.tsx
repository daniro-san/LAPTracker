// /brand "Components": every control and ornament the site uses, each with when to use it. The
// fields are live but belong to no form; nothing here submits.
import { Button } from "@/lib/brand/components/Button";
import { Chip } from "@/lib/brand/components/Chip";
import { LaceBorder } from "@/lib/brand/components/LaceBorder";
import { SealButton } from "@/lib/brand/components/SealButton";
import { DroppedStitch, Hourglass, StitchedCheck } from "@/lib/brand/components/StatusIcons";
import { YarnCorner } from "@/lib/brand/components/YarnCorner";
import { copy } from "@/lib/copy";

import { Section, Spec } from "./parts";

const t = copy.brand.components;
const c = t.chips;

function Chips() {
  return (
    <Spec name={c.name} use={c.use}>
      <Chip tone="ink" icon={<StitchedCheck />}>
        {c.before} {c.done} 12:01
      </Chip>
      <Chip tone="plum" icon={<Hourglass />}>
        {c.after} {c.running}
      </Chip>
      <Chip tone="seal" icon={<DroppedStitch />}>
        {c.after} {c.partial} 16:01
      </Chip>
      <Chip tone="muted">
        {c.after} {c.notYet}
      </Chip>
    </Spec>
  );
}

function Fields() {
  return (
    <Spec name={t.field.name} use={t.field.use}>
      <div className="flex w-full flex-col gap-3">
        <input
          type="text"
          aria-label={t.field.label}
          placeholder={t.field.label}
          className="drawn-field min-h-11 w-full px-3"
        />
        <select aria-label={t.field.select} className="drawn-field min-h-11 w-full px-3">
          {t.field.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
    </Spec>
  );
}

function Ornaments() {
  return (
    <>
      <Spec name={t.rule.name} use={t.rule.use} plate="text-plum">
        <hr className="drawn-rule w-full" />
      </Spec>
      <Spec name={t.lace.name} use={t.lace.use} plate="text-plum">
        <div className="w-full">
          <div className="h-6 bg-plum" />
          <LaceBorder className="block" />
        </div>
      </Spec>
      <Spec name={t.corner.name} use={t.corner.use} plate="text-plum">
        <YarnCorner />
      </Spec>
    </>
  );
}

export function ComponentsSection() {
  return (
    <Section id="components" title={t.title} lede={t.lede}>
      <div className="grid gap-6 sm:grid-cols-3">
        <Spec name={t.primary.name} use={t.primary.use}>
          <Button>{t.primary.label}</Button>
        </Spec>
        <Spec name={t.secondary.name} use={t.secondary.use}>
          <Button variant="secondary">{t.secondary.label}</Button>
        </Spec>
        <Spec name={t.seal.name} use={t.seal.use}>
          <SealButton label={t.seal.label} />
        </Spec>
        <div className="sm:col-span-2">
          <Chips />
        </div>
        <Spec name={t.badge.name} use={t.badge.use}>
          <span className="rounded-xs bg-sage px-2 py-1 text-label font-semibold tracking-[0.04em] text-paper uppercase">
            {t.badge.label}
          </span>
        </Spec>
        <Fields />
        <Spec name={t.check.name} use={t.check.use}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" defaultChecked className="drawn-check" />
            {t.check.label}
          </label>
        </Spec>
        <Ornaments />
      </div>
    </Section>
  );
}
