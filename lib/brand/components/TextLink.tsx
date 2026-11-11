// Text link (DESIGN.md `text-link`, issue 232): the one look for every link that is words. Plum with a
// thin underline at rest, a full 2 px underline on hover, ink and 1 px down on press (`.text-link` in
// app/globals.css). `stretch` makes the link cover its whole card (the card must be `relative`). A link
// styled as a button takes `buttonClass` or `.tint-button` instead. An in-page `#anchor` or a plain
// `<a>` takes the `text-link` class directly.
import Link from "next/link";
import type { ComponentProps } from "react";

export function TextLink({
  stretch = false,
  className = "",
  ...rest
}: { stretch?: boolean } & ComponentProps<typeof Link>) {
  return (
    <Link {...rest} className={`text-link ${stretch ? "text-link-stretch" : ""} ${className}`} />
  );
}
