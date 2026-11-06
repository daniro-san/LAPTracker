// /brand "Voice": docs/DESIGN.md "Voice", with the site's own lines as samples.
import { copy } from "@/lib/copy";

import { Rules, Section, Sub, Verdict } from "./parts";

const t = copy.brand.voice;
const SAMPLES = [
  copy.empty.kettle,
  t.quota,
  copy.errors.notFound.title,
  copy.errors.server.title,
  copy.errors.server.body,
];

export function VoiceSection() {
  return (
    <Section id="voice" title={t.title} lede={t.lede}>
      <Rules items={t.rules} />
      <Sub title={t.samplesTitle}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SAMPLES.map((line, i) => (
            <li key={i} className="border border-rule p-4 font-subhead text-display-sm">
              {line}
            </li>
          ))}
        </ul>
      </Sub>
      <ul className="mt-8 grid gap-6 sm:grid-cols-2">
        {t.pairs.map((pair, i) => (
          <li key={i} className="flex flex-col gap-2">
            <Verdict ok>{pair.do}</Verdict>
            <Verdict ok={false}>{pair.dont}</Verdict>
          </li>
        ))}
      </ul>
    </Section>
  );
}
