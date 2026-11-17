// The workspace's three languages as the screens show them (D71): the switch's short code and each
// language's name in itself. One table for the EN · PT · FR switch and the notices.
import type { WorkspaceLanguage } from "@/lib/private/dictionary";

export const LANGUAGE_CHOICES: readonly { id: WorkspaceLanguage; short: string; name: string }[] = [
  { id: "en", short: "EN", name: "English" },
  { id: "pt-BR", short: "PT", name: "Português" },
  { id: "fr", short: "FR", name: "Français" },
];

const by = <K extends "short" | "name">(key: K) =>
  Object.fromEntries(LANGUAGE_CHOICES.map((c) => [c.id, c[key]])) as Record<
    WorkspaceLanguage,
    string
  >;

export const LANGUAGE_CODE = by("short");
export const LANGUAGE_NAME = by("name");
