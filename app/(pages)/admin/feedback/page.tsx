// /admin/feedback (D157, issue 713): what officers and members sent from the desk and the board, newest
// first, filtered by kind and status (links, so the filter is in the address), each with the owner's status.
// English only (D48). Session first (issue 218): locked, the PIN card and no database read. A send's picture
// shows under its text, from the PIN-gated /admin/feedback/picture/[id] (a plain img: next/image's optimiser
// would fetch it without the owner's session).
import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { FeedbackStatus } from "@/app/_ui/admin/FeedbackStatus";
import { requestServerClock } from "@/app/_ui/locale";
import { isAdmin } from "@/lib/admin-session";
import { Chip } from "@/lib/brand/components/Chip";
import { TextLink } from "@/lib/brand/components/TextLink";
import { copy } from "@/lib/copy";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES } from "@/lib/feedback-words";
import { withPageDb } from "@/lib/page";
import {
  FEEDBACK_SHOWN,
  feedbackFilter,
  listFeedback,
  type FeedbackFilter,
} from "@/lib/queries/admin-feedback";
import { fill } from "@/lib/words";

const t = copy.admin.feedback;

/** The address of the list with `change` applied to the current filter; undefined clears that filter. */
function hrefOf(
  filter: FeedbackFilter,
  change: { [K in keyof FeedbackFilter]: FeedbackFilter[K] | undefined },
): string {
  const next = { ...filter, ...change };
  const q = new URLSearchParams();
  if (next.kind) q.set("kind", next.kind);
  if (next.status) q.set("status", next.status);
  const s = q.toString();
  return s ? `/admin/feedback?${s}` : "/admin/feedback";
}

/** One filter row: All, then each value; the current one is marked. */
function Filter<V extends string>(props: {
  label: string;
  values: readonly V[];
  words: Record<V, string>;
  current: V | undefined;
  href: (v: V | undefined) => string;
}) {
  const items: [V | undefined, string][] = [
    [undefined, t.all],
    ...props.values.map((v): [V, string] => [v, props.words[v]]),
  ];
  return (
    <p className="flex flex-wrap items-center gap-x-1">
      <span className="mr-1 font-semibold">{props.label}</span>
      {items.map(([v, label]) => (
        <TextLink
          key={label}
          href={props.href(v)}
          prefetch={false}
          aria-current={v === props.current ? "true" : undefined}
          className="inline-flex min-h-11 items-center px-2 aria-[current=true]:font-bold aria-[current=true]:no-underline"
        >
          {label}
        </TextLink>
      ))}
    </p>
  );
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdmin())) return <AdminShell section="/admin/feedback" title={t.title} />;
  const filter = feedbackFilter(await searchParams);
  const [items, clock] = await Promise.all([
    withPageDb((db) => listFeedback(db, filter)),
    requestServerClock(),
  ]);
  return (
    <AdminShell section="/admin/feedback" title={t.title}>
      <p className="mb-3">{t.lead}</p>
      <div className="mb-3">
        <Filter
          label={t.kind}
          values={FEEDBACK_KINDS}
          words={t.kinds}
          current={filter.kind}
          href={(kind) => hrefOf(filter, { kind })}
        />
        <Filter
          label={t.status}
          values={FEEDBACK_STATUSES}
          words={t.statuses}
          current={filter.status}
          href={(status) => hrefOf(filter, { status })}
        />
      </div>
      {items.length === 0 && <p>{t.none}</p>}
      {items.length === FEEDBACK_SHOWN && (
        <p className="mb-2 text-body-sm">{fill(t.shown, { n: FEEDBACK_SHOWN })}</p>
      )}
      <ul className="flex flex-col gap-3 sm:gap-0 sm:border sm:border-rule sm:px-6">
        {items.map((f) => (
          <li
            key={f.id}
            className="flex flex-col gap-1 border border-rule p-3 sm:border-0 sm:border-b sm:px-0 sm:last:border-0"
          >
            <p className="flex flex-wrap items-center gap-2">
              <Chip tone={f.kind === "problem" ? "seal" : "plum"}>{t.kinds[f.kind]}</Chip>
              <span className="text-body-sm text-ink/70">
                {[
                  clock.stamp(f.createdAt),
                  f.workspace && `/w/${f.workspace}`,
                  t.areas[f.area],
                  t.tiers[f.tier],
                  f.language,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </p>
            <p className="break-words whitespace-pre-line">{f.text}</p>
            {f.picture && (
              <a href={f.picture.src} className="inline-block max-w-full">
                <img
                  src={f.picture.src}
                  alt={t.picture}
                  width={f.picture.width}
                  height={f.picture.height}
                  loading="lazy"
                  className="block h-auto max-h-96 w-auto max-w-full border border-rule object-contain"
                />
              </a>
            )}
            <p className="break-words text-body-sm text-ink/70">{f.path}</p>
            <FeedbackStatus id={f.id} status={f.status} />
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
