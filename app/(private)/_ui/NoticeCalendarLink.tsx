"use client";

// The calendar link on a notice's page (issue 345, D102): the entries this notice goes with, each with its
// next date and "Remove link", and "Link a calendar entry", a sheet with the entries of this week and the
// next four. The link is the entry's `notice` field, sent through the Calendar's write with the version the
// page was made from, so the Calendar shows the same link.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { fill } from "@/lib/words";

import { sendCalendar } from "./calendar-send";
import type { LinkEntry, NoticeCalendar } from "./notice-calendar";
import { smallButton } from "./NoticeBits";
import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

interface Props {
  slug: string;
  id: number;
  t: WorkspaceDictionary;
  calendar: NoticeCalendar;
}

/** Sets the entry's notice (this one, or none) and reads the page again; false when it was refused. */
function useLink(slug: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  /** The refusal's line: SIGNED_OUT, or the failure words' key. */
  const [failed, setFailed] = useState<string | null>(null);
  const link = async (e: LinkEntry, notice: number | null) => {
    setBusy(true);
    setFailed(null);
    const sent = await sendCalendar(slug, {
      action: "edit",
      entry: e.entry,
      week: null,
      changes: [{ field: "notice", value: notice, version: e.version }],
    });
    setBusy(false);
    setFailed(sent.ok ? null : sent.code === SIGNED_OUT ? SIGNED_OUT : "failed");
    router.refresh();
    return sent.ok;
  };
  return { busy, failed, link };
}

function Failed({ failed, t }: { failed: string | null; t: WorkspaceDictionary }) {
  if (failed === null) return null;
  return (
    <RefusalLine
      text={failed === SIGNED_OUT ? SIGNED_OUT : t["notices.calendar.failed"]}
      className="mt-3 border-l-4 border-seal pl-3 text-body-sm font-semibold"
    />
  );
}

function Pick(props: Props & { onClose: () => void; link: ReturnType<typeof useLink> }) {
  const { t, calendar, link } = props;
  return (
    <Sheet
      labelledBy="notice-cal-pick"
      onCancel={props.onClose}
      title={t["notices.calendar.link"]}
      words={sheetWords(t)}
    >
      <p className="text-body-sm text-ink/70">{t["notices.calendar.help"]}</p>
      {calendar.choices.length === 0 ? (
        <p className="mt-3">{t["notices.calendar.empty"]}</p>
      ) : (
        <ul className="mt-2">
          {calendar.choices.map((e) => (
            <li key={e.entry} className="border-t border-rule py-1">
              <button
                type="button"
                disabled={link.busy}
                onClick={async () => {
                  if (await link.link(e, props.id)) props.onClose();
                }}
                className="tint-button flex min-h-11 w-full flex-col items-start px-2 py-1 text-left"
              >
                <span className="font-semibold text-plum">{e.title}</span>
                <span className="text-body-sm text-ink/80">{e.when}</span>
                {e.other && (
                  <span className="text-body-sm text-yarn">{t["notices.calendar.other"]}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Failed failed={link.failed} t={t} />
    </Sheet>
  );
}

export function NoticeCalendarLink(props: Props) {
  const { t, calendar } = props;
  const [open, setOpen] = useState(false);
  const link = useLink(props.slug);
  return (
    <section aria-labelledby="notice-cal" className="mt-6 border-t border-rule pt-3">
      <h2 id="notice-cal" className="font-subhead text-display-sm">
        {t["notices.calendar"]}
      </h2>
      {calendar.linked.length === 0 ? (
        <p className="mt-1 text-body-sm text-ink/80">{t["notices.calendar.none"]}</p>
      ) : (
        <ul className="mt-1">
          {calendar.linked.map((e) => (
            <li key={e.entry} className="flex items-center gap-3 py-1">
              <a href={e.href} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
                <span className="font-semibold text-plum underline underline-offset-4">
                  {e.title}
                </span>
                <span className="text-body-sm text-ink/80">{e.when}</span>
              </a>
              <button
                type="button"
                disabled={link.busy}
                aria-label={fill(t["notices.calendar.unlinkOf"], { title: e.title })}
                onClick={() => void link.link(e, null)}
                className={smallButton("shrink-0")}
              >
                {t["notices.calendar.unlink"]}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!open && <Failed failed={link.failed} t={t} />}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("secondary", "mt-3")}
      >
        {t["notices.calendar.link"]}
      </button>
      {open && <Pick {...props} link={link} onClose={() => setOpen(false)} />}
    </section>
  );
}
