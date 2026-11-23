// The tap patterns on the desk (D158 rule 7, issue 736) in English, Brazilian Portuguese and French: a who
// list's title (the chart's own sentence and its count), "Open these n in Members ›", Members' chip naming
// the set it shows (`?set=`) and the line for its members who have left, and the arrival lines of the pages
// a count opens. French puts a no-break space before : ; ? !.
export const drillEn = {
  "drill.title.one": "{what}: 1 member",
  "drill.title.other": "{what}: {n} members",
  "drill.joined": "Joined",
  "drill.left": "Left",
  "drill.leftOut": "Left out of the comparison",
  "drill.open.one": "Open them in Members ›",
  "drill.open.other": "Open these {n} in Members ›",
  "drill.set.from": "From Insights",
  "drill.set.clear": "Show every member",
  "drill.set.former.one": "1 of them is no longer in the alliance:",
  "drill.set.former.other": "{n} of them are no longer in the alliance:",
  "drill.earlier": "Earlier",
  "drill.later": "Later",
  "drill.day.of": "{v} of {max}",
  "drill.day.none": "none: in the daily update, nothing sent that day",
} as const;

type DrillWords = Record<keyof typeof drillEn, string>;

export const drillPt: DrillWords = {
  "drill.title.one": "{what}: 1 membro",
  "drill.title.other": "{what}: {n} membros",
  "drill.joined": "Entraram",
  "drill.left": "Saíram",
  "drill.leftOut": "Fora da comparação",
  "drill.open.one": "Abrir em Membros ›",
  "drill.open.other": "Abrir estes {n} em Membros ›",
  "drill.set.from": "Vindo de Análises",
  "drill.set.clear": "Mostrar todos os membros",
  "drill.set.former.one": "1 deles não está mais na aliança:",
  "drill.set.former.other": "{n} deles não estão mais na aliança:",
  "drill.earlier": "Antes",
  "drill.later": "Depois",
  "drill.day.of": "{v} de {max}",
  "drill.day.none": "nada: na atualização diária, nada enviado nesse dia",
};

export const drillFr: DrillWords = {
  "drill.title.one": "{what} : 1 membre",
  "drill.title.other": "{what} : {n} membres",
  "drill.joined": "Arrivés",
  "drill.left": "Partis",
  "drill.leftOut": "Hors de la comparaison",
  "drill.open.one": "L’ouvrir dans Membres ›",
  "drill.open.other": "Ouvrir ces {n} dans Membres ›",
  "drill.set.from": "Depuis Analyses",
  "drill.set.clear": "Afficher tous les membres",
  "drill.set.former.one": "1 d’entre eux n’est plus dans l’alliance :",
  "drill.set.former.other": "{n} d’entre eux ne sont plus dans l’alliance :",
  "drill.earlier": "Avant",
  "drill.later": "Après",
  "drill.day.of": "{v} sur {max}",
  "drill.day.none": "rien : dans la mise à jour quotidienne, rien envoyé ce jour-là",
};
