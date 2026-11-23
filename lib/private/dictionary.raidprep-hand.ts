// Raid prep's "To check by hand" (issue 726): the members with no shield on a map within 3 h of the reset,
// with no map that near, or with no reading; each map's day and its age against the reset, the raid's
// start (00:00 ST); and the grid's line while only the tracker has marked. English, Brazilian Portuguese and
// French, spread into the Raid prep words. French puts a no-break space before :.
export const handEn = {
  "roll.prep.hand": "To check by hand: {n}",
  "roll.prep.hand.none": "Nobody to check by hand",
  "roll.prep.hand.shown": "The {n} to check by hand",
  "roll.prep.hand.shown.one": "The 1 to check by hand",
  "roll.prep.hand.not_seen": "Check by hand · no shield seen",
  "roll.prep.hand.old_map": "Check by hand · no map within 3 h of the reset",
  "roll.prep.hand.no_reading": "Check by hand · no reading",
  "roll.prep.hand.help":
    "To check by hand lists the members with no shield on a map within 3 h of the reset (00:00 ST), with no map that near, or with no reading. The tracker does not mark Raid prep: your own ✓ or ✗ takes a member off the list.",
  "roll.prep.map": "map {day} {time} ST",
  "roll.prep.age.before": "{age} before reset",
  "roll.prep.age.after": "{age} after reset",
  "roll.prep.age.at": "at the reset",
  "roll.prep.none.tracker": "No officer has marked yet: every Shield mark so far is the tracker’s.",
} as const;

type HandWords = Record<keyof typeof handEn, string>;

export const handPt: HandWords = {
  "roll.prep.hand": "Para conferir à mão: {n}",
  "roll.prep.hand.none": "Ninguém para conferir à mão",
  "roll.prep.hand.shown": "Os {n} para conferir à mão",
  "roll.prep.hand.shown.one": "O 1 para conferir à mão",
  "roll.prep.hand.not_seen": "Conferir à mão · sem escudo visto",
  "roll.prep.hand.old_map": "Conferir à mão · nenhum mapa a até 3 h do reset",
  "roll.prep.hand.no_reading": "Conferir à mão · sem leitura",
  "roll.prep.hand.help":
    "Para conferir à mão lista os membros sem escudo num mapa a até 3 h do reset (00:00 ST), sem mapa tão perto, ou sem leitura. O tracker não marca a Preparação do raid: a sua própria ✓ ou ✗ tira o membro da lista.",
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
  "roll.prep.hand.old_map": "À vérifier à la main · aucune carte à moins de 3 h du reset",
  "roll.prep.hand.no_reading": "À vérifier à la main · pas de lecture",
  "roll.prep.hand.help":
    "À vérifier à la main liste les membres sans bouclier sur une carte à moins de 3 h du reset (00:00 ST), sans carte aussi proche, ou sans lecture. Le tracker ne marque pas la Préparation du raid : votre propre ✓ ou ✗ retire un membre de la liste.",
  "roll.prep.map": "carte {day} {time} ST",
  "roll.prep.age.before": "{age} avant le reset",
  "roll.prep.age.after": "{age} après le reset",
  "roll.prep.age.at": "au reset",
  "roll.prep.none.tracker":
    "Aucun officier n’a encore marqué : toutes les marques du Bouclier sont pour l’instant celles du tracker.",
};
