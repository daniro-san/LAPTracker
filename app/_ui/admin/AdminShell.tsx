// Frame for every /admin page: the PIN sheet until the session cookie exists, then a small nav.
import Link from "next/link";
import type { ReactNode } from "react";

import { isAdmin } from "@/lib/admin-session";
import { copy } from "@/lib/copy";

import { PinGate } from "./PinGate";

const NAV = [
  { href: "/admin", label: copy.admin.nav.overview },
  { href: "/admin/runs", label: copy.admin.nav.runs },
  { href: "/admin/errors", label: copy.admin.nav.errors },
];

export async function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  if (!(await isAdmin())) return <PinGate />;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-rule bg-paper">
        <nav
          className="mx-auto flex max-w-[960px] items-center gap-1 px-2 sm:px-4"
          aria-label={copy.admin.nav.label}
        >
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex min-h-11 items-center px-3 text-sm font-medium"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <h1 className="mb-3 font-display text-display-lg font-semibold">{title}</h1>
        {children}
      </main>
    </>
  );
}
