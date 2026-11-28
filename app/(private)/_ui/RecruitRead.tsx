"use client";

// Members → Recruit check (issue 833): "Read from the tracker" for a player the stores do not hold yet. One
// press is one read on the alliance's own key (counted, at most 20 a UTC day); once kept, the page shows the
// facts. A refusal says why in a line.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/lib/brand/components/Button";

import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export interface RecruitReadWords {
  read: string;
  capReached: string;
  notFound: string;
  noKey: string;
  failed: string;
}

function refusal(status: number | undefined, words: RecruitReadWords): string {
  if (status === 401) return SIGNED_OUT;
  if (status === 429) return words.capReached;
  if (status === 404) return words.notFound;
  if (status === 409) return words.noKey;
  return words.failed;
}

export function RecruitRead({
  slug,
  uid,
  words,
}: {
  slug: string;
  uid: number;
  words: RecruitReadWords;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const read = async () => {
    setBusy(true);
    setRefused(null);
    const res = await fetch(`/api/w/${slug}/recruit-check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uid }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setRefused(refusal(res?.status, words));
      return;
    }
    router.refresh();
  };
  return (
    <div className="mt-3">
      <Button type="button" onClick={read} disabled={busy}>
        {words.read}
      </Button>
      {refused && <RefusalLine text={refused} className="mt-2 text-body-sm" />}
    </div>
  );
}
