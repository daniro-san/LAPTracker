// Raid prep at first glance (issue 585, D137 amendment of 2026-11-21): the day line names the raid the roll
// call serves, the answer leads ("Shields for this raid: …"), the Shield marks' counts add up, then the
// count of members to remind and the chips' caption; then "Show the n", which puts the members a count names
// in the grid (drilldown, 2026-11-22). English, Brazilian Portuguese and French, spread into the Raid prep
// words.
export const glanceEn = {
  "roll.prep.raid": "KvK {date} · raid at the reset",
  "roll.prep.raid.past": "Past raid · KvK {date}",
  "roll.prep.status.night":
    "Shields for this raid: {on} of {read} seen at the night check ({time} ST)",
  "roll.prep.status.morning":
    "Shields for this raid: {on} of {read} seen at the morning check ({time} ST)",
  "roll.prep.status.none": "Shields for this raid: not read yet",
  "roll.prep.status.noRead": "Shields for this raid: no reading",
  "roll.prep.next.morning": "Morning check: Saturday from {time} ST.",
  "roll.prep.marks": "Shield marks: {marked} of {total} · ✓ {yes} · ✗ {no} · {todo} to mark",
  "roll.prep.marks.done": "Shield marks: all {total} · ✓ {yes} · ✗ {no}",
  "roll.prep.scan": "map from {time} ST",
  "roll.prep.remind": "To remind: {n}",
  "roll.prep.remind.none": "Nobody to remind",
  "roll.prep.filterBy": "Filter by Shield mark",
  // The sticky bar counts in the card's words, "to mark", not "not set" (read as "no shield", issue 585).
  "roll.prep.left": "{n} to mark",
  "roll.prep.leftAway": "{n} to mark · {away} away, left out",
  "roll.prep.leftAway.one": "{n} to mark · {away} away, left out",
  // Drilldown (2026-11-22): a visible chip puts exactly the members a count names in the grid, with its line.
  "roll.prep.show": "Show the {n}",
  "roll.prep.show.one": "Show the 1",
  "roll.prep.remind.shown": "The {n} to remind",
  "roll.prep.remind.shown.one": "The 1 to remind",
  "roll.prep.accept.shown": "The {n} seen with a shield, not marked yet",
  "roll.prep.accept.shown.one": "The 1 seen with a shield, not marked yet",
} as const;

type GlanceWords = Record<keyof typeof glanceEn, string>;

export const glancePt: GlanceWords = {
  "roll.prep.raid": "KvK {date} · raid no reset",
  "roll.prep.raid.past": "Raid passado · KvK {date}",
  "roll.prep.status.night":
    "Escudos para este raid: {on} de {read} vistos na conferência da noite ({time} ST)",
  "roll.prep.status.morning":
    "Escudos para este raid: {on} de {read} vistos na conferência da manhã ({time} ST)",
  "roll.prep.status.none": "Escudos para este raid: ainda sem leitura",
  "roll.prep.status.noRead": "Escudos para este raid: nenhuma leitura",
  "roll.prep.next.morning": "Conferência da manhã: sábado a partir das {time} ST.",
  "roll.prep.marks":
    "Marcas do Escudo: {marked} de {total} · ✓ {yes} · ✗ {no} · {todo} para marcar",
  "roll.prep.marks.done": "Marcas do Escudo: todos os {total} · ✓ {yes} · ✗ {no}",
  "roll.prep.scan": "mapa das {time} ST",
  "roll.prep.remind": "Para lembrar: {n}",
  "roll.prep.remind.none": "Ninguém para lembrar",
  "roll.prep.filterBy": "Filtrar pela marca do Escudo",
  "roll.prep.left": "{n} para marcar",
  "roll.prep.leftAway": "{n} para marcar · {away} ausentes, fora da chamada",
  "roll.prep.leftAway.one": "{n} para marcar · {away} ausente, fora da chamada",
  "roll.prep.show": "Mostrar os {n}",
  "roll.prep.show.one": "Mostrar o 1",
  "roll.prep.remind.shown": "Os {n} para lembrar",
  "roll.prep.remind.shown.one": "O 1 para lembrar",
  "roll.prep.accept.shown": "Os {n} vistos com escudo, ainda sem marca",
  "roll.prep.accept.shown.one": "O 1 visto com escudo, ainda sem marca",
};

export const glanceFr: GlanceWords = {
  "roll.prep.raid": "KvK {date} · raid au reset",
  "roll.prep.raid.past": "Raid passé · KvK {date}",
  "roll.prep.status.night":
    "Boucliers pour ce raid : {on} sur {read} vus à la vérification du soir ({time} ST)",
  "roll.prep.status.morning":
    "Boucliers pour ce raid : {on} sur {read} vus à la vérification du matin ({time} ST)",
  "roll.prep.status.none": "Boucliers pour ce raid : pas encore lus",
  "roll.prep.status.noRead": "Boucliers pour ce raid : aucune lecture",
  "roll.prep.next.morning": "Vérification du matin : samedi à partir de {time} ST.",
  "roll.prep.marks":
    "Marques du Bouclier : {marked} sur {total} · ✓ {yes} · ✗ {no} · {todo} à marquer",
  "roll.prep.marks.done": "Marques du Bouclier : les {total} · ✓ {yes} · ✗ {no}",
  "roll.prep.scan": "carte de {time} ST",
  "roll.prep.remind": "À relancer : {n}",
  "roll.prep.remind.none": "Personne à relancer",
  "roll.prep.filterBy": "Filtrer par marque du Bouclier",
  "roll.prep.left": "{n} à marquer",
  "roll.prep.leftAway": "{n} à marquer · {away} absents, hors de l’appel",
  "roll.prep.leftAway.one": "{n} à marquer · {away} absent, hors de l’appel",
  "roll.prep.show": "Afficher les {n}",
  "roll.prep.show.one": "Afficher le 1",
  "roll.prep.remind.shown": "Les {n} à relancer",
  "roll.prep.remind.shown.one": "Le 1 à relancer",
  "roll.prep.accept.shown": "Les {n} vus avec un bouclier, pas encore marqués",
  "roll.prep.accept.shown.one": "Le 1 vu avec un bouclier, pas encore marqué",
};
