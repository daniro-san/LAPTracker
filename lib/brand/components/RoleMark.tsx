// Alliance roles (DESIGN.md `role-mark`): a drawn crown for the R5 leader; for a titled R4 officer, the
// drawing of the title's slot (dove, horn, swords, eye), or the four-point stitch star for a title we do
// not know. Single colour, 16 px cuts (generator: docs/brand/drawing/examples/ornaments.py icon_crown,
// icon_officer, icon_diplomat, icon_recruiter, icon_militarist, icon_overseer). Colour is the role's tone;
// the role's word is always in the text beside the mark or, in the member list, read out by `sr-only`.
import type { ComponentType } from "react";

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

/** Diplomat. */
export function Dove({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M1.2 7.4c0-.2 1-1.2 1.4-1.4c.4-.2 1.2-.5 1.7-.3c.5.2 1.6 1.3 2.3 1.5c.7.2 2.2.4 3 .4c.7 0 2.3-.4 3-.6c.7-.2 2.2-.9 2.4-.8c.2.1-.6 1.4-.6 1.8c0 .4.8 1.4.6 1.6c-.2.2-1.9 0-2.6.2c-.7.2-2.4 1.2-3.2 1.4c-.9.1-2.9 0-3.6-.2c-.7-.2-1.6-1.4-2-1.8c-.4-.4-.5-1.1-.8-1.3c-.3-.2-1.6-.3-1.6-.5zm4.4 0c-.2-.3.5-2.3.8-2.8c.3-.5 1.4-1.8 1.8-2.2c.4-.4 2.2-1.4 2.4-1.4c.2 0-.8 1.7-.6 1.8c.2.1 2.4-1 2.6-.8c.2.2-.7 2-1 2.4c-.3.4-1.3 1.7-1.6 2c-.3.3-1.4 1.1-1.8 1.2c-.4.1-2.4.1-2.6-.2zm-1.8-.9c-.1 0-.3 0-.4 0c-.1.1-.2.3-.2.4c0 .1.1.3.2.4c.1 0 .3 0 .4 0c.1-.1.2-.3.2-.4c0-.1-.1-.3-.2-.4zm-2.1 1.4c0 .3.1 1 .2 1.6c.1.6.3 1.7.4 2.1l-.2 0c-.1-.3-1.1-1.3-1.2-1.9c-.1-.6.5-1.5.6-1.8z" />
    </svg>
  );
}

/** Recruiter. */
export function Horn({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M2.1 1.9c.1.7.5 2.6 1 3.8c.5 1.3 1.3 2.1 2.3 3c1 .8 1.9.6 3.1.7c1.2.1 1.9-1.5 2.5-1.7l1.6 4.6c-.6.2-3.1.8-4.3.7c-1.2-.1-3.5-1.6-4.5-2.5c-1-.8-1.6-3-2.1-4.2c-.5-1.3-.1-3.6-.2-4.2zm12.6 5.5c.3.5.9 1.7 1 2.3c.1.6-.2 1.4-.6 1.6c-.3.2-1.2.1-1.8-.2c-.6-.3-1.5-1.1-1.9-1.7c-.4-.6-.7-1.8-.7-2.3c0-.5.4-1.2.9-1.3c.4-.1 1.4.2 1.9.5c.5.2.9.6 1.2 1.1zm-1.3-.4c-.3-.1-.8-.4-1-.4c-.2 0-.4.3-.3.6c0 .3.3 1 .6 1.3c.2.4.8 1 1.1 1.2c.3.2.8.4.9.3c.2-.1.3-.5.2-.8c-.1-.3-.5-1.1-.8-1.4c-.2-.3-.4-.6-.7-.8zm-8.3 4.6c0 .2.7.6.8.4c.1-.2.7-2.3.7-2.6c0-.2-.6-.6-.7-.4c-.1.2-.8 2.3-.8 2.6zm-2.6-10c0 .2-.1.5-.3.6c-.2.1-.6.1-.8 0c-.2-.1-.3-.4-.3-.6c0-.2.1-.5.3-.6c.2-.1.6-.1.8 0c.2.1.3.4.3.6z" />
    </svg>
  );
}

/** Militarist (God of War in game). */
export function Swords({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 11.8c.8-.8 3.2-3 4.8-4.8c1.7-1.7 4.8-4.2 5.6-5.2l.4.4c-.9.9-3.2 4.2-4.8 6c-1.7 1.7-4 4-4.8 4.8zm-1.5-1.8c.4.2 1.7.3 2.3.8c.5.5 1.1 2 1.3 2.4l-.6.4c-.3-.4-.9-1.5-1.5-2c-.5-.5-1.4-.7-1.7-.8zm1.9 3.4c-.2.1-.8.7-.9.9l-.8-.8c.2-.1.8-.7.9-.9zm-1 1c0 .2-.2.6-.4.7c-.2.1-.6.1-.8 0c-.2-.1-.5-.5-.5-.7c0-.2.3-.6.5-.7c.2-.1.6-.1.8 0c.2.1.4.5.4.7zm9.4-1.4c-.8-.8-3.1-3.1-4.8-4.8c-1.6-1.8-3.9-5.1-4.8-6l.4-.4c.8 1 3.9 3.5 5.6 5.2c1.6 1.8 4 4 4.8 4.8zm2.9-2.2c-.3.1-1.2.3-1.7.8c-.6.5-1.2 1.6-1.5 2l-.6-.4c.2-.4.8-1.9 1.3-2.4c.6-.5 1.9-.6 2.3-.8zm-1.3 1.8c.1.2.7.8.9.9l-.8.8c-.1-.2-.7-.8-.9-.9zm1.8 1.8c0 .2-.2.6-.4.7c-.2.1-.6.1-.8 0c-.2-.1-.4-.5-.4-.7c0-.2.2-.6.4-.7c.2-.1.6-.1.8 0c.2.1.4.5.4.7z" />
    </svg>
  );
}

/** Overseer (Goddess in game). */
export function Eye({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M.9 8.6c0-.9 2.3-2.8 3.3-3.4c1-.6 2.7-1 3.8-1c1.1 0 2.8.4 3.8 1c1 .6 3.3 2.5 3.3 3.4c0 .9-2.3 2.4-3.3 3c-1 .6-2.7 1-3.8 1c-1.1 0-2.8-.4-3.8-1c-1-.6-3.3-2.1-3.3-3zm4.3 1.8c.7.3 2 .5 2.8.5c.8 0 2.1-.2 2.8-.5c.7-.3 2.3-1.3 2.3-1.8c0-.5-1.6-1.6-2.3-2c-.7-.4-2-.6-2.8-.6c-.8 0-2.1.2-2.8.6c-.7.4-2.3 1.5-2.3 2c0 .5 1.6 1.5 2.3 1.8zm4.8-1.9c0 .5-.2 1.1-.5 1.5c-.4.3-1 .4-1.5.4c-.5 0-1.2-.1-1.5-.4c-.3-.3-.5-1-.5-1.5c0-.5.3-1 .6-1.4c.4-.3.9-.7 1.4-.7c.5 0 1.1.3 1.4.7c.3.3.6.9.6 1.4zm-5.5-3.5c-.1-.2-.6-.8-.8-1.3c-.1-.4-.1-1.1-.2-1.3l.2 0c.1.2.6.6.8 1.1c.1.4.1 1.2.2 1.5zm3.4 0c0-.2-.3-.8-.3-1.4c0-.6.3-1.8.3-2.2l.2 0c0 .4.3 1.6.3 2.2c0 .6-.3 1.2-.3 1.4zm3.4 0c.1-.3.1-1.1.2-1.5c.2-.5.7-.9.8-1.1l.2 0c-.1.2-.1.9-.2 1.3c-.2.5-.7 1.1-.8 1.3z" />
    </svg>
  );
}

type Mark = ComponentType<{ className?: string }>;

/** The four R4 title slots by the name `rank_label` gives, plus the in-game names for two of them. */
const BY_TITLE = new Map<string, Mark>([
  ["diplomat", Dove],
  ["recruiter", Horn],
  ["militarist", Swords],
  ["god of war", Swords],
  ["overseer", Eye],
  ["goddess", Eye],
]);

/** The drawing for an officer's title, case and spacing ignored; the stitch star for any other title. */
export function officerMark(title: string): Mark {
  return BY_TITLE.get(title.trim().toLowerCase().replace(/\s+/g, " ")) ?? OfficerStar;
}

/** The role's drawn mark in its tone; the parent's text names the role. */
export function RoleMark({ role, className = "size-4" }: { role: Role; className?: string }) {
  const Icon = role.kind === "leader" ? Crown : officerMark(role.title);
  return (
    <span className={`inline-flex shrink-0 align-middle ${ROLE_TONE[role.kind].text}`}>
      <Icon className={className} />
    </span>
  );
}
