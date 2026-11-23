// The tap patterns on the desk (D158 rule 7, issue 736) in English, Brazilian Portuguese and French: a who
// list's title (the chart's own sentence and its count), "Open these n in Members ›", Members' chip naming
// the set it shows (`?set=`) and the line for its members who have left, and the arrival lines of the pages
// a count opens, and a chart's next level: a week's days, with its path and the line saying they add up,
// and a day's (D158 rule 7 (b)). French puts a no-break space before : ; ? !.
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
  "drill.byDay": "{week}, day by day ›",
  "drill.back": "All weeks",
  "drill.flow.days": "Joined and left, day by day",
  "drill.pulse.sum":
    "{week}: {n} of {of} member-days (each daily update counts each member once). Its days add up to this.",
  "drill.pulse.median":
    "{week}: middle donation {value}, from the {n} of {of} member-days with a donation. Each day shows its own middle value, and middle values do not add up to the week’s.",
  "drill.flow.sum": "{week}: {joined} joined, {left} left. Its days add up to this.",
  "drill.flow.noRead": "No daily update on {days}: a join or leave then shows on the next one.",
  "drill.flow.before":
    "The daily update of {date} is the starting point: there is nothing before it to compare with.",
  "drill.pulse.pick": "Who did it on a day:",
  "drill.pulseDay.donated": "Donated",
  "drill.pulseDay.sum":
    "{day}: the members behind each count, in name order. Only those who did it are named.",
  "drill.pulseDay.questsUnknown":
    "Daily quest points: not known for {n}, who are not in the day before’s daily update.",
  "drill.flowDay.sum": "{day}: {joined} joined, {left} left. The places below add up to this.",
  "drill.flowDay.nobodyJoined": "Nobody joined that day.",
  "drill.flowDay.nobodyLeft": "Nobody left that day.",
  "drill.kvk.pick": "A day’s numbers:",
  "drill.kvk.back": "All KvKs",
  "drill.kvkDay.on": "On {date}",
  "drill.kvkDay.sum": "{day}: {back} of the might they lost is back. Its column shows the same.",
  "drill.kvkDay.noLoss": "{day}: these members lost no might in this KvK.",
  "drill.kvkDay.all": "Counted: the {n} members this KvK counts.",
  "drill.kvkDay.some":
    "Counted: {n} of the {of} members this KvK counts. Not in this day’s daily update: {missing}.",
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
  "drill.byDay": "{week}, dia a dia ›",
  "drill.back": "Todas as semanas",
  "drill.flow.days": "Entraram e saíram, dia a dia",
  "drill.pulse.sum":
    "{week}: {n} de {of} membro-dias (cada atualização diária conta cada membro uma vez). Os dias somam isso.",
  "drill.pulse.median":
    "{week}: doação do meio {value}, dos {n} de {of} membro-dias com doação. Cada dia mostra o seu próprio valor do meio, e valores do meio não somam o da semana.",
  "drill.flow.sum": "{week}: {joined} entraram, {left} saíram. Os dias somam isso.",
  "drill.flow.noRead": "Sem atualização diária em {days}: uma entrada ou saída aparece na próxima.",
  "drill.flow.before":
    "A atualização diária de {date} é o ponto de partida: não há nada antes dela para comparar.",
  "drill.pulse.pick": "Quem fez, por dia:",
  "drill.pulseDay.donated": "Doaram",
  "drill.pulseDay.sum":
    "{day}: os membros por trás de cada contagem, em ordem de nome. Só aparece quem fez.",
  "drill.pulseDay.questsUnknown":
    "Pontos de missões diárias: sem dados para {n}, que não estão na atualização diária do dia anterior.",
  "drill.flowDay.sum": "{day}: {joined} entraram, {left} saíram. Os lugares abaixo somam isso.",
  "drill.flowDay.nobodyJoined": "Ninguém entrou nesse dia.",
  "drill.flowDay.nobodyLeft": "Ninguém saiu nesse dia.",
  "drill.kvk.pick": "Os números de um dia:",
  "drill.kvk.back": "Todas as KvKs",
  "drill.kvkDay.on": "Em {date}",
  "drill.kvkDay.sum": "{day}: {back} do poder que perderam voltou. A coluna do dia mostra o mesmo.",
  "drill.kvkDay.noLoss": "{day}: estes membros não perderam poder nesta KvK.",
  "drill.kvkDay.all": "Contados: os {n} membros que esta KvK conta.",
  "drill.kvkDay.some":
    "Contados: {n} dos {of} membros que esta KvK conta. Fora da atualização diária deste dia: {missing}.",
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
  "drill.byDay": "{week}, jour par jour ›",
  "drill.back": "Toutes les semaines",
  "drill.flow.days": "Arrivés et partis, jour par jour",
  "drill.pulse.sum":
    "{week} : {n} sur {of} jours-membres (chaque mise à jour quotidienne compte chaque membre une fois). Ses jours font ce total.",
  "drill.pulse.median":
    "{week} : don du milieu {value}, sur les {n} jours-membres avec un don parmi {of}. Chaque jour montre sa propre valeur du milieu, et des valeurs du milieu ne s’additionnent pas en celle de la semaine.",
  "drill.flow.sum": "{week} : {joined} arrivés, {left} partis. Ses jours font ce total.",
  "drill.flow.noRead":
    "Pas de mise à jour quotidienne le {days} : une arrivée ou un départ apparaît alors à la suivante.",
  "drill.flow.before":
    "La mise à jour quotidienne du {date} est le point de départ : il n’y a rien avant elle à comparer.",
  "drill.pulse.pick": "Qui l’a fait, par jour :",
  "drill.pulseDay.donated": "Ont donné",
  "drill.pulseDay.sum":
    "{day} : les membres derrière chaque nombre, par ordre de nom. Seuls ceux qui l’ont fait sont nommés.",
  "drill.pulseDay.questsUnknown":
    "Points de quêtes quotidiennes : inconnus pour {n}, absents de la mise à jour quotidienne de la veille.",
  "drill.flowDay.sum":
    "{day} : {joined} arrivés, {left} partis. Les lieux ci-dessous font ce total.",
  "drill.flowDay.nobodyJoined": "Personne n’est arrivé ce jour-là.",
  "drill.flowDay.nobodyLeft": "Personne n’est parti ce jour-là.",
  "drill.kvk.pick": "Les chiffres d’un jour :",
  "drill.kvk.back": "Toutes les KvK",
  "drill.kvkDay.on": "Le {date}",
  "drill.kvkDay.sum":
    "{day} : {back} de la puissance perdue est revenue. Sa colonne montre la même chose.",
  "drill.kvkDay.noLoss": "{day} : ces membres n’ont pas perdu de puissance dans cette KvK.",
  "drill.kvkDay.all": "Comptés : les {n} membres que cette KvK compte.",
  "drill.kvkDay.some":
    "Comptés : {n} des {of} membres que cette KvK compte. Absents de la mise à jour quotidienne de ce jour : {missing}.",
};
