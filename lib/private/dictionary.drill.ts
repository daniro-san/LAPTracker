// The tap patterns on the desk (D158 rule 7, issue 736) in English, Brazilian Portuguese and French: a who
// list's title (the chart's own sentence and its count), "Open these n in Members ›", Members' chip naming
// the set it shows (`?set=`) and the line for its members who have left, and the arrival lines of the pages
// a count opens, and a chart's next level: a week's days, with its path and the line saying they add up
// (D158 rule 7 (b)). French puts a no-break space before : ; ? !.
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
  "drill.path": "Where you are in this chart",
  "drill.byDay": "Day by day ›",
  "drill.back": "All weeks",
  "drill.pulse.sum":
    "{week}: {n} of {of}, each member counted once per daily update. Its days add up to this.",
  "drill.pulse.median":
    "{week}: {value} is the middle of all its donations. A middle value is not a sum, so the days’ values do not add up to it. Donated: {n} of {of}; its days add up to this.",
  "drill.flow.sum": "{week}: {joined} joined, {left} left. Its days add up to this.",
  "drill.flow.noRead": "No daily update on {days}: a join or leave then shows on the next one.",
  "drill.flow.before":
    "Before {date} nothing can be compared: the first daily update is the starting point.",
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
  "drill.path": "Onde você está neste gráfico",
  "drill.byDay": "Dia a dia ›",
  "drill.back": "Todas as semanas",
  "drill.pulse.sum":
    "{week}: {n} de {of}, cada membro contado uma vez por atualização diária. Os dias somam isso.",
  "drill.pulse.median":
    "{week}: {value} é o valor do meio de todas as doações. Um valor do meio não é uma soma, então os valores dos dias não somam isso. Doaram: {n} de {of}; os dias somam isso.",
  "drill.flow.sum": "{week}: {joined} entraram, {left} saíram. Os dias somam isso.",
  "drill.flow.noRead": "Sem atualização diária em {days}: uma entrada ou saída aparece na próxima.",
  "drill.flow.before":
    "Antes de {date} não há com o que comparar: a primeira atualização diária é o ponto de partida.",
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
  "drill.path": "Où vous êtes dans ce graphique",
  "drill.byDay": "Jour par jour ›",
  "drill.back": "Toutes les semaines",
  "drill.pulse.sum":
    "{week} : {n} sur {of}, chaque membre compté une fois par mise à jour quotidienne. Ses jours font ce total.",
  "drill.pulse.median":
    "{week} : {value} est la valeur du milieu de tous ses dons. Une valeur du milieu n’est pas une somme : les valeurs des jours ne font pas ce total. Ont donné : {n} sur {of} ; ses jours font ce total.",
  "drill.flow.sum": "{week} : {joined} arrivés, {left} partis. Ses jours font ce total.",
  "drill.flow.noRead":
    "Pas de mise à jour quotidienne le {days} : une arrivée ou un départ apparaît alors à la suivante.",
  "drill.flow.before":
    "Avant le {date}, rien à comparer : la première mise à jour quotidienne est le point de départ.",
};
