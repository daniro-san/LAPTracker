// Which sheet values an import writes (issue 297, D80), pure: one value per member and field, only where
// the field holds no value yet and no earlier row of the sheet filled it; every other value is kept as it
// is. The server writes from it, and the import screen counts from it before anything is written.

export interface PlannedValue {
  uid: number;
  field: string;
  value: unknown;
}

export function fillPlan<R extends { facts: Readonly<Record<string, unknown>> }>(
  rows: readonly R[],
  /** The member a row is for; null for "not a member" or a row still open. */
  uidOf: (row: R) => number | null,
  /** Whether the member's field holds a value already. */
  has: (uid: number, field: string) => boolean,
): { fill: PlannedValue[]; kept: number } {
  const fill = new Map<string, PlannedValue>();
  let kept = 0;
  for (const row of rows) {
    const uid = uidOf(row);
    if (uid === null) continue;
    for (const [field, value] of Object.entries(row.facts)) {
      const key = `${uid} ${field}`;
      if (has(uid, field) || fill.has(key)) kept++;
      else fill.set(key, { uid, field, value });
    }
  }
  return { fill: [...fill.values()], kept };
}
