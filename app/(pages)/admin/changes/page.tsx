// /admin/changes: the owner's patch notes (lib/patch-notes.ts). Static: no database read and no fetch. The
// owner's open steps first, then each release, the newest open and the rest closed <details> (nothing
// hover-only). PR and issue numbers link to the public repository.
import { Fragment } from "react";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { AdminSection } from "@/app/_ui/admin/parts";
import { dayDate, type Clock } from "@/app/_ui/format";
import { requestServerClock } from "@/app/_ui/locale";
import { isAdmin } from "@/lib/admin-session";
import { Chip } from "@/lib/brand/components/Chip";
import { StitchedCheck } from "@/lib/brand/components/StatusIcons";
import { copy, fill } from "@/lib/copy";
import { ownerTodo, patchNotes, REPO_URL, type PatchNote } from "@/lib/patch-notes";

const t = copy.admin.changes;
const LINK = "text-link";

/** A text with every issue or PR number (a hash and digits) as a link to that issue or PR (GitHub sends an issue URL on to its PR). */
function Linked({ text }: { text: string }) {
  return text.split(/(#\d+)/).map((part, i) =>
    /^#\d+$/.test(part) ? (
      <a key={i} href={`${REPO_URL}/issues/${part.slice(1)}`} className={LINK}>
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function IssueLink({ n }: { n: number }) {
  return (
    <a
      href={`${REPO_URL}/issues/${n}`}
      className={`${LINK} ml-1 inline-flex min-h-11 items-center px-1 text-sm`}
    >
      #{n}
    </a>
  );
}

function Todo() {
  const open = ownerTodo.filter((x) => !x.done);
  const done = ownerTodo.filter((x) => x.done);
  return (
    <AdminSection
      id="todo"
      title={t.todo.title}
      help={t.todo.help}
      aside={
        <Chip tone={open.length ? "plum" : "muted"}>{fill(t.todo.open, { n: open.length })}</Chip>
      }
    >
      {open.length === 0 && <p>{t.todo.none}</p>}
      <ol className="flex list-decimal flex-col gap-2 pl-6">
        {open.map((x) => (
          <li key={x.text} className="break-words">
            {x.text}
            {x.issue !== undefined && <IssueLink n={x.issue} />}
          </li>
        ))}
      </ol>
      {done.length > 0 && (
        <>
          <h3 className="mt-4 font-subhead text-display-sm">{t.todo.done}</h3>
          <ul className="mt-2 flex flex-col gap-2 text-body-sm text-ink/70">
            {done.map((x) => (
              <li key={x.text} className="flex gap-2 break-words">
                <span className="mt-1 shrink-0">
                  <StitchedCheck />
                </span>
                <span>
                  {x.text}
                  {x.issue !== undefined && <IssueLink n={x.issue} />}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminSection>
  );
}

function Release({ note, open, clock }: { note: PatchNote; open: boolean; clock: Clock }) {
  return (
    <details open={open} className="group/note border border-rule">
      <summary className="tint-button flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="font-subhead text-display-sm">{note.version}</span>
        <span className="text-body-sm text-ink/70">{clock.weekday(dayDate(note.date))}</span>
        {note.needsYou && <Chip tone="seal">{t.releases.needsYou}</Chip>}
        <span
          aria-hidden="true"
          className="ml-auto transition-transform duration-150 group-open/note:rotate-180 motion-reduce:transition-none"
        >
          ▾
        </span>
        <span className="basis-full break-words font-medium">{note.title}</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-rule px-4 py-3">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {note.changes.map((c) => (
            <li key={c} className="break-words">
              <Linked text={c} />
            </li>
          ))}
        </ul>
        {note.needsYou && (
          <div className="border-l-2 border-seal pl-3">
            <h3 className="font-semibold">{t.releases.needsYou}</h3>
            <ul className="mt-1 flex list-disc flex-col gap-2 pl-5">
              {note.needsYou.map((n) => (
                <li key={n} className="break-words">
                  <Linked text={n} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {note.prs && (
          <p className="flex flex-wrap items-center text-body-sm">
            <span className="mr-1 text-ink/70">{t.releases.prs}:</span>
            {note.prs.map((n) => (
              <a
                key={n}
                href={`${REPO_URL}/pull/${n}`}
                className={`${LINK} inline-flex min-h-11 items-center px-1`}
              >
                #{n}
              </a>
            ))}
          </p>
        )}
      </div>
    </details>
  );
}

export default async function ChangesPage() {
  // Session first (issue 218): locked, the PIN card.
  if (!(await isAdmin())) return <AdminShell title={t.title} />;
  const clock = await requestServerClock();
  return (
    <AdminShell title={t.title}>
      <Todo />
      <AdminSection id="releases" title={t.releases.title} help={t.releases.help}>
        <ul className="flex flex-col gap-3">
          {patchNotes.map((note, i) => (
            <li key={note.version}>
              <Release note={note} open={i === 0} clock={clock} />
            </li>
          ))}
        </ul>
      </AdminSection>
    </AdminShell>
  );
}
