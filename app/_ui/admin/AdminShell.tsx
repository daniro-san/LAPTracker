// Frame for every /admin page: the PIN sheet until the session cookie exists, then a small nav.
import Link from "next/link";
import type { ReactNode } from "react";

import { isAdmin } from "@/lib/admin-session";

import { PinGate } from "./PinGate";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/runs", label: "Runs" },
  { href: "/admin/errors", label: "Errors" },
];

export async function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  if (!(await isAdmin())) return <PinGate />;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-zinc-300 bg-white/95 dark:border-zinc-700 dark:bg-zinc-950/95">
        <nav className="mx-auto flex max-w-4xl items-center gap-1 px-2" aria-label="Admin">
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
      <main className="mx-auto max-w-4xl px-4 py-4">
        <h1 className="mb-3 text-xl font-bold">{title}</h1>
        {children}
      </main>
    </>
  );
}
