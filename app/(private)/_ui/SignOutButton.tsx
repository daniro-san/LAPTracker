"use client";

// "Sign out": a same-origin JSON POST (D71), then the workspace's address again, which shows the sign-in.
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton({ slug, label }: { slug: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      await fetch(`/api/w/${slug}/logout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    } finally {
      router.refresh();
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className="min-h-11 px-2 text-body-sm font-semibold underline underline-offset-4 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
