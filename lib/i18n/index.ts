// Every language's translation of the public pages (D48), keyed by the languages in `LANGUAGES`
// (lib/copy.ts). Read by the server (app/_ui/locale.ts), scripts/i18n-check.ts and the tests; never
// imported by client code, which gets only the request's dictionary through LocaleProvider.
import type { Language, Translation } from "../copy";
import { de } from "./de";
import { es } from "./es";
import { fr } from "./fr";
import { idID } from "./id";
import { itIT } from "./it";
import { ja } from "./ja";
import { ko } from "./ko";
import { nl } from "./nl";
import { pl } from "./pl";
import { ptBR } from "./pt-BR";
import { ru } from "./ru";
import { sv } from "./sv";
import { th } from "./th";
import { tr } from "./tr";
import { uk } from "./uk";
import { vi } from "./vi";
import { zhCN } from "./zh-CN";

export const TRANSLATIONS: Record<Exclude<Language, "en">, Translation> = {
  es,
  "pt-BR": ptBR,
  fr,
  de,
  it: itIT,
  nl,
  sv,
  pl,
  ru,
  uk,
  tr,
  "zh-CN": zhCN,
  ja,
  ko,
  id: idID,
  vi,
  th,
};
