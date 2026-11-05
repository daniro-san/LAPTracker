// The viewer's theme choice, kept in a cookie so the server can put data-theme on <html> before
// the first paint (no inline script under the CSP, no flash). No cookie = follow the system.
import { cookies } from "next/headers";

export type Theme = "light" | "dark";
export const THEME_COOKIE = "theme";

export async function readTheme(): Promise<Theme | null> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return value === "light" || value === "dark" ? value : null;
}
