// Raid prep's "Check by hand" (issue 726): the members whose map nearest the reset saw no shield, is more
// than 3 h from the reset, or who have no reading; each map's day and its age against the reset, the raid's
// start (00:00 ST); and the grid's line while only the tracker has marked. English, Brazilian Portuguese and
// French, spread into the Raid prep words. French puts a no-break space before :.
export const handEn = {
  "roll.prep.hand": "Check by hand: {n}",
  "roll.prep.hand.none": "Nobody to check by hand",
  "roll.prep.hand.shown": "The {n} to check by hand",
  "roll.prep.hand.shown.one": "The 1 to check by hand",
  "roll.prep.hand.not_seen": "Check by hand · no shield seen",
  "roll.prep.hand.old_map": "Check by hand · map over 3 h from the reset",
  "roll.prep.hand.no_reading": "Check by hand · no reading",
  "roll.prep.hand.help":
    "Check by hand lists the members whose map nearest the reset (00:00 ST) saw no shield or is more than 3 h from it, and those with no reading. Your own ✓ or ✗ takes a member off the list.",
  "roll.prep.map": "map {day} {time} ST",
  "roll.prep.age.before": "{age} before reset",
  "roll.prep.age.after": "{age} after reset",
  "roll.prep.age.at": "at the reset",
  "roll.prep.none.tracker": "No officer has marked yet: every Shield mark so far is the tracker’s.",
} as const;

type HandWords = Record<keyof typeof handEn, string>;

export const handPt: HandWords = {
  "roll.prep.hand": "Conferir à mão: {n}",
  "roll.prep.hand.none": "Ninguém para conferir à mão",
  "roll.prep.hand.shown": "Os {n} para conferir à mão",
  "roll.prep.hand.shown.one": "O 1 para conferir à mão",
  "roll.prep.hand.not_seen": "Conferir à mão · sem escudo visto",
  "roll.prep.hand.old_map": "Conferir à mão · mapa a mais de 3 h do reset",
  "roll.prep.hand.no_reading": "Conferir à mão · sem leitura",
  "roll.prep.hand.help":
    "Conferir à mão lista os membros cujo mapa mais perto do reset (00:00 ST) não viu escudo ou está a mais de 3 h dele, e os sem leitura. A sua própria ✓ ou ✗ tira o membro da lista.",
  "roll.prep.map": "mapa {day} {time} ST",
  "roll.prep.age.before": "{age} antes do reset",
  "roll.prep.age.after": "{age} depois do reset",
  "roll.prep.age.at": "no reset",
  "roll.prep.none.tracker":
    "Nenhum oficial marcou ainda: todas as marcas do Escudo até agora são do tracker.",
};

export const handFr: HandWords = {
  "roll.prep.hand": "À vérifier à la main : {n}",
  "roll.prep.hand.none": "Personne à vérifier à la main",
  "roll.prep.hand.shown": "Les {n} à vérifier à la main",
  "roll.prep.hand.shown.one": "Le 1 à vérifier à la main",
  "roll.prep.hand.not_seen": "À vérifier à la main · pas de bouclier vu",
  "roll.prep.hand.old_map": "À vérifier à la main · carte à plus de 3 h du reset",
  "roll.prep.hand.no_reading": "À vérifier à la main · pas de lecture",
  "roll.prep.hand.help":
    "À vérifier à la main liste les membres dont la carte la plus proche du reset (00:00 ST) n’a vu aucun bouclier ou en est à plus de 3 h, et ceux sans lecture. Votre propre ✓ ou ✗ retire un membre de la liste.",
  "roll.prep.map": "carte {day} {time} ST",
  "roll.prep.age.before": "{age} avant le reset",
  "roll.prep.age.after": "{age} après le reset",
  "roll.prep.age.at": "au reset",
  "roll.prep.none.tracker":
    "Aucun officier n’a encore marqué : toutes les marques du Bouclier sont pour l’instant celles du tracker.",
};
