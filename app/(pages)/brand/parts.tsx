// Layout pieces shared by the /brand sections: a section with its anchor, a sub-heading, a specimen
// with its name and when to use it, and the do/don't verdict (icon, word and colour together).
import type { ReactNode } from "react";

import { DroppedStitch, StitchedCheck } from "@/lib/brand/components/StatusIcons";
import { copy } from "@/lib/copy";

export function Section(props: { id: string; title: string; lede: string; children: ReactNode }) {
  return (
    <section id={props.id} aria-labelledby={`${props.id}-title`} className="scroll-mt-20 py-8">
      <hr className="drawn-rule mb-8 text-plum/40" />
      <h2 id={`${props.id}-title`} className="font-subhead text-display-md">
        {props.title}
      </h2>
      <p className="mt-2 mb-6 max-w-[60ch] text-ink/70">{props.lede}</p>
      {props.children}
    </section>
  );
}

export function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-10">
      <h3 className="mb-4 font-subhead text-display-sm">{title}</h3>
      {children}
    </div>
  );
}

/** A specimen box over its name and when to use it. `plate` adds the framed paper plate. */
export function Spec(props: { name: string; use?: string; plate?: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-3">
      <div
        className={`flex min-h-28 flex-wrap items-center justify-center gap-4 border border-rule p-4 ${props.plate ?? ""}`}
      >
        {props.children}
      </div>
      <figcaption>
        <p className="font-semibold">{props.name}</p>
        {props.use && <p className="text-body-sm text-ink/70">{props.use}</p>}
      </figcaption>
    </figure>
  );
}

export function Verdict({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className={`flex items-start gap-1.5 text-body-sm ${ok ? "text-ink" : "text-seal"}`}>
      <span aria-hidden="true" className="mt-0.5 inline-flex">
        {ok ? <StitchedCheck /> : <DroppedStitch />}
      </span>
      <span>
        <span className="font-semibold">{ok ? copy.brand.do : copy.brand.dont}:</span> {children}
      </span>
    </p>
  );
}

export function Rules({ items }: { items: readonly string[] }) {
  return (
    <ul className="max-w-[60ch] list-disc space-y-2 pl-5 marker:text-plum">
      {items.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}
