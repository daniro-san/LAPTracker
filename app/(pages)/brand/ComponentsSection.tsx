// /brand "Components": every control and ornament the site uses, each with when to use it. The
// fields are live but belong to no form; nothing here submits.
import { MEMBER_MARK } from "@/app/_ui/format";
import { MemberMark } from "@/app/_ui/Num";
import { Button } from "@/lib/brand/components/Button";
import { CheckField } from "@/lib/brand/components/CheckField";
import { Chip } from "@/lib/brand/components/Chip";
import { FactList } from "@/lib/brand/components/FactList";
import { LaceBorder } from "@/lib/brand/components/LaceBorder";
import { Notice } from "@/lib/brand/components/Notice";
import { RadioField } from "@/lib/brand/components/RadioField";
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
        <Spec name={t.memberMark.name} use={t.memberMark.use}>
          <span className="font-medium text-seal">
            {t.memberMark.sample}
            <MemberMark />
          </span>
          <span className="text-xs text-ink/70">
            <span aria-hidden="true" className="font-semibold text-ink">
              {MEMBER_MARK}{" "}
            </span>
            {copy.legend.members}
          </span>
        </Spec>
        <Spec name={t.badge.name} use={t.badge.use}>
          <span className="rounded-xs bg-sage px-2 py-1 text-label font-semibold tracking-[0.04em] text-paper uppercase">
            {t.badge.label}
          </span>
        </Spec>
        <Fields />
        <Spec name={t.check.name} use={t.check.use}>
          <div className="flex w-full flex-col items-start gap-3">
            <CheckField label={t.check.label} help={t.check.help} defaultChecked />
            <CheckField variant="chip" label={t.check.chip} />
          </div>
        </Spec>
        <Spec name={t.radio.name} use={t.radio.use}>
          <fieldset className="flex w-full flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">{t.radio.legend}</legend>
            {t.radio.options.map(([label, help], i) => (
              <RadioField
                key={label}
                name="brand-radio"
                label={label}
                help={help}
                defaultChecked={i === 0}
              />
            ))}
          </fieldset>
        </Spec>
        <Spec name={t.notice.name} use={t.notice.use}>
          <div className="flex w-full flex-col gap-2">
            <Notice tone="ok">{t.notice.ok}</Notice>
            <Notice tone="busy">{t.notice.busy}</Notice>
            <Notice tone="fail">{t.notice.fail}</Notice>
            <Notice>{t.notice.info}</Notice>
          </div>
        </Spec>
        <Spec name={t.facts.name} use={t.facts.use}>
          <div className="w-full">
            <FactList items={t.facts.items.map(([label, value]) => ({ label, value }))} />
          </div>
        </Spec>
        <Ornaments />
      </div>
    </Section>
  );
}
