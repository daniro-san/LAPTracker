// Alliance roles (DESIGN.md `role-mark`): a drawn crown for the R5 leader, a smaller four-point stitch
// star for a titled R4 officer. Single colour, 16 px cuts (generator: docs/brand/drawing/examples/
// ornaments.py icon_crown, icon_officer). Colour is the role's tone; the role's word is always in the
// text beside the mark or, in the member list, read out by `sr-only`.
import type { Role } from "@/lib/queries/leadership";

/** Leader: plum. Officer: sage, the neutral tone. The row tint uses the same colours. */
export const ROLE_TONE = {
  leader: { text: "text-plum", tint: "bg-plum/10" },
  officer: { text: "text-sage", tint: "bg-sage/10" },
} as const;

export function Crown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M2.1 12.2c-.3-.2-.4-3.2-.4-3.6c0-.4-.5-3.6-.4-3.7c.1-.1 2.1 1.9 2.3 2.1c.2.2 1.9 1.8 2.1 1.6c.2-.2 2.1-5.3 2.3-5.3c.2 0 2.1 5.1 2.3 5.3c.2.2 1.9-1.4 2.1-1.6c.2-.2 2.2-2.2 2.3-2.1c.1.1-.4 3.3-.4 3.7c0 .4-.1 3.4-.4 3.6c-.3.2-5.3.7-5.9.7c-.6 0-5.6-.5-5.9-.7zm.3 1.8c1 0 3.7.1 5.6.1c1.9 0 4.6-.1 5.6-.1l0 .8c-.9.1-3.7.8-5.6.8c-1.9 0-4.7-.7-5.6-.8zm.1-9.9c0 .3-.2.6-.4.8c-.3.1-.7.1-1 0c-.2-.2-.4-.5-.4-.8c0-.3.2-.6.4-.8c.3-.1.7-.1 1 0c.2.2.4.5.4.8zm6.6-1.9c0 .3-.3.7-.6.9c-.2.1-.8.1-1 0c-.3-.2-.5-.6-.5-.9c0-.3.2-.7.5-.9c.2-.1.8-.1 1 0c.3.2.6.6.6.9zm6.2 1.9c0 .3-.2.6-.4.8c-.3.1-.7.1-1 0c-.2-.2-.4-.5-.4-.8c0-.3.2-.6.4-.8c.3-.1.7-.1 1 0c.2.2.4.5.4.8z"
      />
    </svg>
  );
}

export function OfficerStar({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 1.6c.1 0 .8 4.3 1.1 4.6c.3.3 5.1 1.6 5.1 1.8c0 .2-4.8 1.5-5.1 1.8c-.3.3-1 4.6-1.1 4.6c-.1 0-.8-4.3-1.1-4.6c-.3-.3-5.1-1.6-5.1-1.8c0-.2 4.8-1.5 5.1-1.8c.3-.3 1-4.6 1.1-4.6z" />
    </svg>
  );
}

/** The role's drawn mark in its tone; the parent's text names the role. */
export function RoleMark({ role, className = "size-4" }: { role: Role; className?: string }) {
  const Icon = role.kind === "leader" ? Crown : OfficerStar;
  return (
    <span className={`inline-flex shrink-0 align-middle ${ROLE_TONE[role.kind].text}`}>
      <Icon className={className} />
    </span>
  );
}
