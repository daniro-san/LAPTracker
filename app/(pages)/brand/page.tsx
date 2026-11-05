// /brand — the Session 7 mock (Phase 5b): tokens, mark, ornaments and one ledger row, before any real
// page is restyled. Static: it reads no database. Not indexed.
import type { ReactNode } from "react";

import { compact, percentText, signOf } from "@/app/_ui/format";
import { Button } from "@/lib/brand/components/Button";
import { Chip } from "@/lib/brand/components/Chip";
import { LaceBorder } from "@/lib/brand/components/LaceBorder";
import { Logo, Mark, MarkLine, WaxedMark } from "@/lib/brand/components/Logo";
import { GrannyStanding, GrannyTea } from "@/lib/brand/components/Mascot";
import { SealButton } from "@/lib/brand/components/SealButton";
import { DroppedStitch, Hourglass, StitchedCheck } from "@/lib/brand/components/StatusIcons";
import { ThemeSwitch } from "@/lib/brand/components/ThemeSwitch";
import { YarnCorner } from "@/lib/brand/components/YarnCorner";
import { copy } from "@/lib/copy";

const t = copy.brand;

export const metadata = { title: `${t.title} · ${copy.site.name}`, robots: { index: false } };

const SWATCHES = [
  ["bg-paper", t.palette.roles.paper],
  ["bg-ink", t.palette.roles.ink],
  ["bg-plum", t.palette.roles.plum],
  ["bg-seal", t.palette.roles.seal],
  ["bg-yarn", t.palette.roles.yarn],
  ["bg-sage", t.palette.roles.sage],
  ["bg-rule", t.palette.roles.rule],
] as const;

const SAMPLE = [
  { label: t.row.might, value: 3_941_203_118, delta: 20_112_406 },
  { label: t.row.kills, value: 61_204_377, delta: 412_880 },
  { label: t.row.members, value: 97, delta: -1, note: t.row.membersNote },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-rule py-8">
      <h2 className="mb-4 font-subhead text-display-md font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ fill, label }: { fill: string; label: string }) {
  return (
    <li className="flex min-h-11 items-center gap-3">
      <span className={`size-11 shrink-0 border border-rule ${fill}`} />
      <span className="text-body-sm">{label}</span>
    </li>
  );
}

function SampleRow() {
  return (
    <div>
      <div className="hidden grid-cols-[2.4fr_1fr_1fr_1fr] gap-x-3 border-b border-rule px-3 pb-1 text-label font-semibold tracking-[0.04em] uppercase sm:grid">
        <span>{t.row.lead}</span>
        {SAMPLE.map((m) => (
          <span key={m.label} className="text-right">
            {m.label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-y-1 border border-rule p-3 sm:grid-cols-[2.4fr_1fr_1fr_1fr] sm:gap-x-3 sm:border-0 sm:border-b">
        <div>
          <span className="mr-2 tabular-nums">#2</span>
          <span className="font-semibold text-plum">OGs</span>
          <div className="text-body-sm">Old Grandmas</div>
        </div>
        {SAMPLE.map((m) => (
          <div
            key={m.label}
            className="flex flex-wrap items-baseline gap-x-2 sm:block sm:text-right"
          >
            <span className="w-20 text-label font-semibold uppercase sm:hidden">{m.label}</span>
            <span className="font-medium tabular-nums">{compact(m.value)}</span>
            <span
              className={`block font-medium tabular-nums ${m.delta > 0 ? "text-yarn" : "text-seal"}`}
            >
              <span aria-hidden="true">{m.delta > 0 ? "▲ " : "▼ "}</span>
              {signOf(m.delta)}
              {compact(m.delta)}
              {m.label !== t.row.members && ` (${percentText((m.delta / m.value) * 100)})`}
            </span>
            {"note" in m && <span className="text-body-sm tabular-nums sm:block">{m.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function MarkSection() {
  return (
    <Section title={t.mark.title}>
      <div className="flex flex-wrap items-end gap-8">
        <figure className="text-plum">
          <MarkLine size={200} />
          <figcaption className="mt-2 max-w-60 text-body-sm text-ink">{t.mark.large}</figcaption>
        </figure>
        <figure>
          <div className="flex items-center gap-3">
            <span className="text-plum">
              <Mark size={32} />
            </span>
            <span className="inline-grid size-11 place-items-center bg-plum text-paper">
              <Mark size={24} />
            </span>
          </div>
          <figcaption className="mt-2 max-w-48 text-body-sm">{t.mark.small}</figcaption>
        </figure>
      </div>
    </Section>
  );
}

function MascotSection() {
  return (
    <Section title={t.mascot.title}>
      <div className="flex flex-wrap items-end gap-8 text-plum">
        <figure>
          <GrannyStanding className="w-40" />
          <figcaption className="mt-2 max-w-40 text-body-sm text-ink">
            {t.mascot.standing}
          </figcaption>
        </figure>
        <figure>
          <GrannyTea className="w-56" />
          <figcaption className="mt-2 text-body-sm text-ink">{t.mascot.tea}</figcaption>
        </figure>
      </div>
    </Section>
  );
}

function PaletteSection() {
  return (
    <Section title={t.palette.title}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {SWATCHES.map(([fill, label]) => (
          <Swatch key={fill} fill={fill} label={label} />
        ))}
      </ul>
    </Section>
  );
}

function FacesSection() {
  const roles = [
    [t.faces.primary, "font-display"],
    [t.faces.secondary, "font-subhead"],
    [t.faces.body, "font-body"],
  ] as const;
  return (
    <Section title={t.faces.title}>
      <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
        {roles.map(([label, face]) => (
          <li key={label}>
            <p className="mb-1 font-body text-body-sm">{label}</p>
            {t.faces.samples.map((line, i) => (
              <p
                key={line}
                className={`${face} ${i === 0 ? "text-display-lg" : "text-display-sm"} font-semibold`}
              >
                {line}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TypeSection() {
  return (
    <Section title={t.type.title}>
      <p className="font-display text-display-lg font-semibold">{t.type.displayLg}</p>
      <p className="font-subhead text-display-md font-semibold">{t.type.displayMd}</p>
      <p className="font-subhead text-display-sm font-semibold">{t.type.displaySm}</p>
      <p className="mt-1 mb-6 text-body-sm">{t.type.displayNote}</p>
      <p className="max-w-[65ch] text-body">{t.type.body}</p>
      <p className="text-body-sm">{t.type.bodySm}</p>
      <p className="mt-2 font-medium tabular-nums">3,941,203,118 · 61,204,377 · 97</p>
      <p className="text-label font-semibold tracking-[0.04em] uppercase">{t.type.label}</p>
      <p className="mt-1 text-body-sm">{t.type.bodyNote}</p>
    </Section>
  );
}

function OrnamentsSection() {
  return (
    <Section title={t.ornaments.title}>
      <div className="text-plum">
        <LaceBorder className="block" />
      </div>
      <p className="mt-2 text-body-sm">{t.ornaments.lace}</p>
      <p className="mt-2 text-body-sm">{t.ornaments.corner}</p>
    </Section>
  );
}

function ControlsSection() {
  return (
    <Section title={t.controls.title}>
      <div className="flex flex-wrap items-start gap-8">
        <figure className="flex flex-col items-start gap-3">
          <Button>{t.controls.primary}</Button>
          <figcaption className="max-w-48 text-body-sm">{t.controls.inked}</figcaption>
        </figure>
        <figure className="flex flex-col items-start gap-3">
          <Button variant="secondary">{t.controls.secondary}</Button>
          <figcaption className="max-w-48 text-body-sm">{t.controls.framed}</figcaption>
        </figure>
        <figure className="flex flex-col items-center">
          <SealButton label={t.controls.seal} />
          <figcaption className="mt-2 max-w-40 text-center text-body-sm">
            {t.controls.sealNote}
          </figcaption>
        </figure>
        <figure className="flex flex-col items-start gap-3">
          <span className="rounded-xs bg-sage px-2 py-1 text-label font-semibold tracking-[0.04em] text-paper uppercase">
            {t.controls.badge}
          </span>
          <figcaption className="text-body-sm">{t.controls.badgeNote}</figcaption>
        </figure>
      </div>
      <p className="mt-8 mb-3 text-body-sm">{t.controls.waxTitle}</p>
      <div className="flex flex-wrap items-center gap-4 bg-plum p-4">
        <WaxedMark size={56} tone="paper" />
        <WaxedMark size={56} tone="seal" />
        <WaxedMark size={56} tone="yarn" />
      </div>
    </Section>
  );
}

function StatusSection() {
  return (
    <Section title={t.status.title}>
      <ul className="flex flex-wrap gap-3">
        <li>
          <Chip tone="ink" icon={<StitchedCheck />}>
            {t.status.before} {t.status.complete} 16:01
          </Chip>
        </li>
        <li>
          <Chip tone="plum" icon={<Hourglass />}>
            {t.status.after} {t.status.running} 16:01
          </Chip>
        </li>
        <li>
          <Chip tone="seal" icon={<DroppedStitch />}>
            {t.status.after} {t.status.partial} 16:01
          </Chip>
        </li>
        <li>
          <Chip tone="muted">
            {t.status.after} {t.status.notYet}
          </Chip>
        </li>
      </ul>
    </Section>
  );
}

export default function BrandPage() {
  return (
    <div className={"min-h-screen bg-paper font-body text-ink"}>
      <header className="sticky top-0 z-30 text-plum">
        <div className="bg-plum text-paper">
          <div className="mx-auto flex max-w-[960px] items-center justify-between gap-2 px-4 py-1 sm:px-6">
            <Logo name={copy.site.name} />
            <ThemeSwitch label={copy.site.darkMode} />
          </div>
        </div>
        <LaceBorder className="block" />
      </header>
      <main className="mx-auto max-w-[960px] px-4 pt-6 pb-8 sm:px-6">
        <h1 className="font-display text-display-lg font-semibold">{t.title}</h1>
        <p className="mt-2 mb-6 text-body-sm">{t.intro}</p>
        <FacesSection />
        <MarkSection />
        <MascotSection />
        <PaletteSection />
        <TypeSection />
        <OrnamentsSection />
        <ControlsSection />
        <StatusSection />
        <Section title={t.row.title}>
          <SampleRow />
        </Section>
      </main>
      <footer className="relative mx-auto h-32 max-w-[960px] px-4 text-plum sm:px-6">
        <p className="text-right text-body-sm text-ink">
          {copy.site.ledger} · {copy.site.byline}
        </p>
        <YarnCorner className="absolute bottom-2 left-0" />
      </footer>
    </div>
  );
}
