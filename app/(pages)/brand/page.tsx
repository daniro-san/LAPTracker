// /brand — the brand guidelines: logo, colour, type, drawing style, components and voice, each shown
// with the pieces the site uses. Static: it reads no database. Not indexed (owner, 2026-11-04).
import { LaceBorder } from "@/lib/brand/components/LaceBorder";
import { Logo } from "@/lib/brand/components/Logo";
import { ThemeSwitch } from "@/lib/brand/components/ThemeSwitch";
import { YarnCorner } from "@/lib/brand/components/YarnCorner";
import { copy } from "@/lib/copy";

import { ColourSection } from "./ColourSection";
import { ComponentsSection } from "./ComponentsSection";
import { DrawingSection } from "./DrawingSection";
import { LogoSection } from "./LogoSection";
import { TypeSection } from "./TypeSection";
import { VoiceSection } from "./VoiceSection";

const t = copy.brand;

export const metadata = { title: `${t.title} · ${copy.site.name}`, robots: { index: false } };

const NAV = ["logo", "colour", "type", "drawing", "components", "voice"] as const;

export default function BrandPage() {
  return (
    <div lang="en" className="min-h-screen bg-paper font-body text-ink">
      <header className="sticky top-0 z-30 text-plum">
        <div className="bg-plum text-paper">
          <div className="mx-auto flex max-w-[960px] items-center justify-between gap-2 px-4 py-1 sm:px-6">
            <Logo name={copy.site.name} />
            <ThemeSwitch label={copy.site.darkMode} />
          </div>
        </div>
        <LaceBorder className="block" />
      </header>
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 pt-6 pb-8 sm:px-6">
        <h1 className="font-display text-display-lg">{t.title}</h1>
        <p className="mt-2 max-w-[60ch] text-ink/70">{t.intro}</p>
        <nav aria-label={t.nav.label} className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {NAV.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="drawn-frame-soft tint-button inline-flex min-h-11 items-center px-3 text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                >
                  {t.nav[id]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <LogoSection />
        <ColourSection />
        <TypeSection />
        <DrawingSection />
        <ComponentsSection />
        <VoiceSection />
      </main>
      <footer className="relative mx-auto h-32 max-w-[960px] px-4 text-plum sm:px-6">
        <hr className="drawn-rule mb-4" />
        <p className="text-right text-body-sm text-ink">
          {copy.site.ledger} · {copy.site.byline}
        </p>
        <YarnCorner className="absolute bottom-2 left-0" />
      </footer>
    </div>
  );
}
