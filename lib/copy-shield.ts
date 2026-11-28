// The Raid Shield check's message to the leaders' channel (issue 474, D137), in the language the officers
// picked in Alliance settings. Sent by the tick, outside lib/private, so its words live here. People first
// (D75): "not seen yet" is a hint about the tracker's map scan, never a ✗; members without a reading are a
// count, never named.
export const SHIELD_LANGUAGES = ["en", "pt-BR", "fr"] as const;
export type ShieldLanguage = (typeof SHIELD_LANGUAGES)[number];

export interface ShieldPostWords {
  title: string;
  /** "{time}: {n} of {total} with a shield seen" for one read. */
  read: string;
  /** The night check's line: counts only, the maps refresh after the reset (issue 826). */
  night: string;
  /** "· {n} not read" after a read, when some members have no reading. */
  unread: string;
  notSeenMorning: string;
  /** How many away members were left out of the names: a count, never a name (D137, 2026-11-22). */
  away: string;
  awayOne: string;
  /** The reminder that a recent shield may not show yet. */
  hint: string;
  more: string;
  link: string;
  /** The read lines' names: the night check and the morning check, as the desk says (issue 585). */
  fri: string;
  sat: string;
}

export const SHIELD_POST: Record<ShieldLanguage, ShieldPostWords> = {
  en: {
    title: "**Raid Shield check**",
    read: "{day} {time} ST: {n} of {total} with a shield seen",
    night:
      "{day} {time} ST: shield seen on {n} of {total} maps so far; maps refresh after the reset",
    unread: "{n} not read",
    notSeenMorning: "Not seen this morning: {names}",
    away: "{n} away, left out",
    awayOne: "{n} away, left out",
    hint: "The tracker sees shields at its map scan: a shield turned on since may not show yet.",
    more: "and {n} more",
    link: "[Raid prep ↗](<{url}>)",
    fri: "Night check",
    sat: "Morning check",
  },
  "pt-BR": {
    title: "**Conferência do Escudo de raid**",
    read: "{day} {time} ST: {n} de {total} com escudo visto",
    night:
      "{day} {time} ST: escudo visto em {n} de {total} mapas até agora; os mapas atualizam depois do reset",
    unread: "{n} sem leitura",
    notSeenMorning: "Sem escudo visto hoje de manhã: {names}",
    away: "{n} ausentes, fora da lista",
    awayOne: "{n} ausente, fora da lista",
    hint: "O tracker vê o escudo na varredura do mapa: um escudo ligado depois pode não aparecer ainda.",
    more: "e mais {n}",
    link: "[Preparação do raid ↗](<{url}>)",
    fri: "Conferência da noite",
    sat: "Conferência da manhã",
  },
  fr: {
    title: "**Vérification du Bouclier de raid**",
    read: "{day} {time} ST : {n} sur {total} avec un bouclier vu",
    night:
      "{day} {time} ST : bouclier vu sur {n} cartes sur {total} pour l’instant ; les cartes se mettent à jour après le reset",
    unread: "{n} sans lecture",
    notSeenMorning: "Pas vu ce matin : {names}",
    away: "{n} absents, hors de la liste",
    awayOne: "{n} absent, hors de la liste",
    hint: "Le tracker voit les boucliers lors de son scan de la carte : un bouclier activé depuis peut ne pas encore apparaître.",
    more: "et {n} de plus",
    link: "[Préparation du raid ↗](<{url}>)",
    fri: "Vérification du soir",
    sat: "Vérification du matin",
  },
};
