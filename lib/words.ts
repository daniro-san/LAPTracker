// The one placeholder and plural rule for every sentence the app writes: pages, push and Discord (D23
// amendment 2026-11-22, issue 592). Imports nothing from the project, so client components load it too.

/**
 * `fill("Last updated at {time}", { time: "14:01" })`. A placeholder with no value throws outside production
 * (tests, `next dev`); in production it stays as written, so a missing value is a visible `{x}`, never an
 * empty word in a page, a push or a Discord message.
 */
export function fill(template: string, vars: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => {
    const value = Object.hasOwn(vars, key) ? vars[key] : undefined;
    if (value !== undefined) return String(value);
    if (process.env.NODE_ENV !== "production") throw new Error(`fill: no value for ${all}`);
    return all;
  });
}

/** The singular or plural form for `n`, by the language's own rule ("0 champ" in French, "0 fields" in English). */
export function plural<T>(n: number, forms: { one: T; other: T }, locale: string): T {
  return new Intl.PluralRules(locale).select(n) === "one" ? forms.one : forms.other;
}
