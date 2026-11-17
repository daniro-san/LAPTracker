"use client";

// The one answer to a workspace API's 401 `signed_out` (D99), wherever it comes back: "You were signed
// out. Your text is still here." and a sign-in link that opens in a new tab and returns to this same page.
// Nothing on this page is cleared, so after signing in there the officer taps Save here again and it works.
// The words come from the signed-in frame, so no form passes them on.
import { createContext, use, useSyncExternalStore, type ReactNode } from "react";

/** What every workspace API answers a request without a usable session with (HTTP 401). */
export const SIGNED_OUT = "signed_out";

interface Words {
  slug: string;
  text: string;
  link: string;
}

const SignedOutWords = createContext<Words | null>(null);

export function SignedOutProvider({ children, ...words }: Words & { children: ReactNode }) {
  return <SignedOutWords value={words}>{children}</SignedOutWords>;
}

const noSubscribe = () => () => {};
const here = () => `${window.location.pathname}${window.location.search}`;

/** A form's refusal line: the signed-out note when `text` is SIGNED_OUT, else the text itself. */
export function RefusalLine({ text, className }: { text: string; className: string }) {
  if (text === SIGNED_OUT) return <SignedOutNote className={className} />;
  return (
    <p role="alert" className={className}>
      {text}
    </p>
  );
}

export function SignedOutNote({ className = "" }: { className?: string }) {
  const words = use(SignedOutWords);
  const path = useSyncExternalStore(noSubscribe, here, () => "");
  if (!words) return null;
  const next = path ? `&next=${encodeURIComponent(path)}` : "";
  return (
    <p role="alert" className={`text-body-sm font-semibold ${className}`}>
      {words.text}{" "}
      <a
        href={`/api/w/${words.slug}/login?silent=1${next}`}
        target="_blank"
        rel="noopener"
        className="inline-flex min-h-11 items-center text-plum underline underline-offset-4"
      >
        {words.link}
      </a>
    </p>
  );
}
