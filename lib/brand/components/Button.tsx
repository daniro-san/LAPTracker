// Buttons (DESIGN.md `button-primary`, `button-secondary`): one look per job, all in the brand's hand.
// primary: solid plum face over pen hatching (.ink-button). secondary: paper face in the drawn frame
// (.drawn-frame .frame-button). Confirm/destructive actions use SealButton. Links that act as buttons
// take `buttonClass` so they look the same.
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary";

const LOOK: Record<ButtonVariant, string> = {
  primary: "ink-button",
  secondary: "drawn-frame frame-button",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `${LOOK[variant]} inline-flex min-h-11 cursor-pointer items-center justify-center px-4 font-medium disabled:cursor-default disabled:opacity-50 ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} {...rest} className={buttonClass(variant, className)} />;
}
