// Frame for every /admin page: the site's own header, lace and footer like every other page (07c S3c),
// the admin nav under the header, and the PIN card until the session cookie exists. The header has no
// event selector here: admin pages are not about one event.
import Link from "next/link";
import type { ReactNode } from "react";

import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { isAdmin } from "@/lib/admin-session";
import { copy } from "@/lib/copy";

import { PinGate } from "./PinGate";

const NAV = [
  { href: "/admin", label: copy.admin.nav.overview },
  { href: "/admin/runs", label: copy.admin.nav.runs },
  { href: "/admin/errors", label: copy.admin.nav.errors },
];

export async function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const unlocked = await isAdmin();
  return (
    // English whatever the viewer's language (D39): the lang attribute says so for this subtree.
    <div lang="en">
      <SiteHeader events={[]} currentId={null} copy={copy} publicPage={false} />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        {unlocked ? (
          <>
            <nav
              aria-label={copy.admin.nav.label}
              className="mb-3 flex flex-wrap gap-x-1 border-b border-rule"
            >
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="flex min-h-11 items-center px-3 text-sm font-medium text-plum hover:underline"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <h1 className="mb-3 font-display text-display-lg">{title}</h1>
            {children}
          </>
        ) : (
          <PinGate />
        )}
      </main>
      <SiteFooter copy={copy} />
    </div>
  );
}
