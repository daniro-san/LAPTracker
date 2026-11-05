// Fact list (DESIGN.md `fact-list`): label and value pairs, one per line, ruled. The label is small and
// muted on the left, the value reads at body size. For a settings or state summary, not for numbers
// that need columns (that is `stat-table`).
export function FactList({ items }: { items: readonly { label: string; value: string }[] }) {
  return (
    <dl>
      {items.map((i) => (
        <div key={i.label} className="flex gap-4 border-b border-rule py-2">
          <dt className="w-36 shrink-0 text-sm text-ink/70 sm:w-48">{i.label}</dt>
          <dd className="break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
