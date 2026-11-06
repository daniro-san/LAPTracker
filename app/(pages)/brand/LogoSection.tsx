// /brand "Logo": the three cuts, clear space, minimum sizes, correct and incorrect use.
import type { ReactNode } from "react";

import { Mark, MarkLine, WaxedMark } from "@/lib/brand/components/Logo";
import type { WaxTone } from "@/lib/brand/components/Wax";
import { copy } from "@/lib/copy";

import { Section, Spec, Sub, Verdict } from "./parts";

const t = copy.brand.logo;
const TONES: readonly WaxTone[] = ["paper", "seal", "yarn"];
const LINE_SIZES = [24, 32, 48];
const SOLID_SIZES = [16, 24, 32];

function Sized({ size, children }: { size: number; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-1">
      {children}
      <span className="text-body-sm text-ink/70 tabular-nums">
        {size} {copy.brand.unit}
      </span>
    </span>
  );
}

function Cuts() {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <Spec name={t.line.name} use={t.line.use} plate="text-plum">
        <MarkLine size={96} />
      </Spec>
      <Spec name={t.waxed.name} use={t.waxed.use} plate="bg-plum text-paper">
        {TONES.map((tone) => (
          <span key={tone} className="flex flex-col items-center gap-1">
            <WaxedMark size={56} tone={tone} />
            <span className="text-body-sm">{t.tones[tone]}</span>
          </span>
        ))}
      </Spec>
      <Spec name={t.solid.name} use={t.solid.use} plate="text-plum">
        <Mark size={32} />
        <span className="inline-grid size-11 place-items-center bg-plum text-paper">
          <Mark size={24} />
        </span>
      </Spec>
    </div>
  );
}

function ClearAndMinimum() {
  return (
    <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2">
      <div>
        <h3 className="mb-4 font-subhead text-display-sm">{t.clearTitle}</h3>
        <div className="relative inline-block border border-dashed border-plum/60 p-6 text-plum">
          <span className="absolute top-1 left-1/2 -translate-x-1/2 text-label">
            {t.clearLabel}
          </span>
          <span className="absolute top-1/2 left-1.5 -translate-y-1/2 text-label">
            {t.clearLabel}
          </span>
          <div className="outline outline-rule">
            <MarkLine size={96} />
          </div>
        </div>
        <p className="mt-3 max-w-[40ch] text-body-sm text-ink/70">{t.clear}</p>
      </div>
      <div>
        <h3 className="mb-4 font-subhead text-display-sm">{t.minTitle}</h3>
        <div className="flex items-end gap-5 text-plum">
          {LINE_SIZES.map((s) => (
            <Sized key={s} size={s}>
              <MarkLine size={s} />
            </Sized>
          ))}
        </div>
        <p className="mt-2 mb-6 text-body-sm">{t.minLine}</p>
        <div className="flex items-end gap-5 text-plum">
          {SOLID_SIZES.map((s) => (
            <Sized key={s} size={s}>
              <Mark size={s} />
            </Sized>
          ))}
        </div>
        <p className="mt-2 text-body-sm">{t.minSolid}</p>
      </div>
    </div>
  );
}

const TILE = "grid h-24 place-items-center overflow-hidden border border-rule";

function Usage() {
  const dos = [
    <span key="0" className={`${TILE} text-plum`}>
      <MarkLine size={56} />
    </span>,
    <span key="1" className={`${TILE} bg-plum text-paper`}>
      <MarkLine size={56} />
    </span>,
    <span key="2" className={`${TILE} bg-plum`}>
      <WaxedMark size={56} tone="paper" />
    </span>,
  ];
  const donts = [
    <span key="0" className={`${TILE} text-plum`}>
      <MarkLine size={56} className="scale-x-150" />
    </span>,
    <span key="1" className={`${TILE} text-plum`}>
      <MarkLine size={56} className="-rotate-30" />
    </span>,
    <span key="2" className={`${TILE} text-yarn`}>
      <MarkLine size={56} />
    </span>,
    <span key="3" className={`${TILE} text-plum`}>
      <MarkLine size={14} />
    </span>,
  ];
  return (
    <Sub title={t.useTitle}>
      <ul className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {dos.map((tile, i) => (
          <li key={i} className="flex flex-col gap-2">
            {tile}
            <Verdict ok>{t.dos[i]}</Verdict>
          </li>
        ))}
      </ul>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {donts.map((tile, i) => (
          <li key={i} className="flex flex-col gap-2">
            {tile}
            <Verdict ok={false}>{t.donts[i]}</Verdict>
          </li>
        ))}
      </ul>
    </Sub>
  );
}

export function LogoSection() {
  return (
    <Section id="logo" title={t.title} lede={t.lede}>
      <Cuts />
      <ClearAndMinimum />
      <Usage />
    </Section>
  );
}
