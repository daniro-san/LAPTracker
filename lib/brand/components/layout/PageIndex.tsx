// A page index (DESIGN.md "Layout components", issue 585): the sections of a long page as 44 px jump links, each
// with its state in words beside it; a state that needs a look is yarn with a dot, and its word is read out.
// Put it in a `MarginNote`: above the content below 1024, in the sticky margin column from 1024. Words come
// in as props, so the desk and /admin each pass their own.
export interface PageIndexItem {
  /** The section's heading id. */
  id: string;
  /** Where the row goes when it is not `#id`: a section of another page (/admin's "Needs you"). */
  href?: string;
  label: string;
  state?: string | null;
  attention?: boolean;
}

export function PageIndex({
  items,
  attentionWord,
}: {
  items: readonly PageIndexItem[];
  /** Read out before a state that needs a look ("Needs a look"). */
  attentionWord: string;
}) {
  return (
    <ol className="[&>li+li]:border-t [&>li+li]:border-rule">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={item.href ?? `#${item.id}`}
            className="tint-button flex min-h-11 flex-wrap items-center justify-between gap-x-3 py-1"
          >
            <span className="font-medium text-plum underline decoration-plum/40 underline-offset-[3px]">
              {item.label}
            </span>
            {item.state && (
              <span
                className={`text-body-sm ${item.attention ? "font-semibold text-yarn" : "text-ink/80"}`}
              >
                {item.attention && (
                  <>
                    <span aria-hidden="true">● </span>
                    <span className="sr-only">{`${attentionWord}: `}</span>
                  </>
                )}
                {item.state}
              </span>
            )}
          </a>
        </li>
      ))}
    </ol>
  );
}
