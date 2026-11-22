// The officers' Insights page's Time zones card (owner, 2026-11-22) in English, Brazilian Portuguese and
// French; dictionary.insights.ts spreads them. Counts only, "largest group" never "most" (persona panel),
// "not recorded yet" never counts against anyone (D75), times end in ST. French puts a no-break space
// before : ; ? !.
export const insightsZonesEn = {
  "insights.zones.head": "Time zones",
  "insights.zones.largest": "Largest group: {group}, {n} of the {known} members with a time zone.",
  "insights.zones.tie.one": "Largest groups, {n} member each: {groups}.",
  "insights.zones.tie.other": "Largest groups, {n} members each: {groups}.",
  "insights.zones.all": "All {known} members with a time zone are in one group: {group}.",
  "insights.zones.one": "The one member with a time zone is in {group}.",
  "insights.zones.reset": "The 00:00 ST reset is {times} for them.",
  "insights.zones.based.one":
    "Time zone recorded for {known} of the {n} member in the newest daily update.",
  "insights.zones.based.other":
    "Time zone recorded for {known} of the {n} members in the newest daily update.",
  "insights.zones.none.one":
    "No time zone recorded yet for the {n} member in the newest daily update.",
  "insights.zones.none.other":
    "No time zone recorded yet for the {n} members in the newest daily update.",
  "insights.zones.row": "{cities} · {offset}",
  "insights.zones.named": "{cities} ({offset})",
  "insights.zones.more": "{cities} and {n} more",
  "insights.zones.times": "Now {now} · Reset {reset} · KvK {kvk}",
  "insights.zones.changeReset": "Clocks change before the reset",
  "insights.zones.changeKvk": "Clocks change before KvK",
  "insights.zones.legend":
    "Times on their own clock: now ({now} ST), at the next 00:00 ST reset (the raid starts at the one before KvK) and at KvK ({kvk} ST). Bar: share of the {known} members with a time zone.",
  "insights.zones.notRecorded": "Not recorded yet",
  "insights.zones.notCounted":
    "Not counted in any group. Members lists today’s roster, so its count there can differ.",
  "insights.zones.add": "Add their time zone ›",
  "insights.zones.usual":
    "Within their usual hours for the most: {hours} ST, {n} of the {known} members with a time zone ({missing} not recorded). A guess from their time zone, for times you set, like rallies.",
  "insights.zones.seeWho": "See who ›",
};

type ZonesWords = Record<keyof typeof insightsZonesEn, string>;

export const insightsZonesPt: ZonesWords = {
  "insights.zones.head": "Fusos horários",
  "insights.zones.largest": "Maior grupo: {group}, {n} dos {known} membros com fuso horário.",
  "insights.zones.tie.one": "Maiores grupos, {n} membro cada: {groups}.",
  "insights.zones.tie.other": "Maiores grupos, {n} membros cada: {groups}.",
  "insights.zones.all": "Todos os {known} membros com fuso horário estão num só grupo: {group}.",
  "insights.zones.one": "O único membro com fuso horário está em {group}.",
  "insights.zones.reset": "Para eles, o reset das 00:00 ST é {times}.",
  "insights.zones.based.one":
    "Fuso horário registrado para {known} de {n} membro da atualização diária mais recente.",
  "insights.zones.based.other":
    "Fuso horário registrado para {known} de {n} membros da atualização diária mais recente.",
  "insights.zones.none.one":
    "Nenhum fuso horário registrado ainda para o {n} membro da atualização diária mais recente.",
  "insights.zones.none.other":
    "Nenhum fuso horário registrado ainda para os {n} membros da atualização diária mais recente.",
  "insights.zones.row": "{cities} · {offset}",
  "insights.zones.named": "{cities} ({offset})",
  "insights.zones.more": "{cities} e mais {n}",
  "insights.zones.times": "Agora {now} · Reset {reset} · KvK {kvk}",
  "insights.zones.changeReset": "O relógio muda antes do reset",
  "insights.zones.changeKvk": "O relógio muda antes do KvK",
  "insights.zones.legend":
    "Horários no relógio deles: agora ({now} ST), no próximo reset das 00:00 ST (o raid começa no reset antes do KvK) e no KvK ({kvk} ST). Barra: parcela dos {known} membros com fuso horário.",
  "insights.zones.notRecorded": "Ainda não registrado",
  "insights.zones.notCounted":
    "Fora de todos os grupos. Membros mostra a lista de hoje, então a contagem lá pode ser outra.",
  "insights.zones.add": "Adicionar o fuso deles ›",
  "insights.zones.usual":
    "Mais membros no horário comum deles: {hours} ST, {n} dos {known} membros com fuso horário ({missing} sem registro). Uma estimativa pelo fuso, para horários que você marca, como rallies.",
  "insights.zones.seeWho": "Ver quem ›",
};

export const insightsZonesFr: ZonesWords = {
  "insights.zones.head": "Fuseaux horaires",
  "insights.zones.largest":
    "Groupe le plus nombreux : {group}, {n} des {known} membres avec un fuseau horaire.",
  "insights.zones.tie.one": "Groupes les plus nombreux, {n} membre chacun : {groups}.",
  "insights.zones.tie.other": "Groupes les plus nombreux, {n} membres chacun : {groups}.",
  "insights.zones.all":
    "Les {known} membres avec un fuseau horaire sont dans un seul groupe : {group}.",
  "insights.zones.one": "Le seul membre avec un fuseau horaire est dans {group}.",
  "insights.zones.reset": "Pour eux, le reset de 00:00 ST est à {times}.",
  "insights.zones.based.one":
    "Fuseau horaire noté pour {known} sur {n} membre de la dernière mise à jour quotidienne.",
  "insights.zones.based.other":
    "Fuseau horaire noté pour {known} sur {n} membres de la dernière mise à jour quotidienne.",
  "insights.zones.none.one":
    "Aucun fuseau horaire noté pour l’instant pour le {n} membre de la dernière mise à jour quotidienne.",
  "insights.zones.none.other":
    "Aucun fuseau horaire noté pour l’instant pour les {n} membres de la dernière mise à jour quotidienne.",
  "insights.zones.row": "{cities} · {offset}",
  "insights.zones.named": "{cities} ({offset})",
  "insights.zones.more": "{cities} et {n} de plus",
  "insights.zones.times": "Maintenant {now} · Reset {reset} · KvK {kvk}",
  "insights.zones.changeReset": "L’heure change avant le reset",
  "insights.zones.changeKvk": "L’heure change avant le KvK",
  "insights.zones.legend":
    "Heures sur leur propre horloge : maintenant ({now} ST), au prochain reset de 00:00 ST (le raid commence à celui d’avant le KvK) et au KvK ({kvk} ST). Barre : part des {known} membres avec un fuseau horaire.",
  "insights.zones.notRecorded": "Pas encore noté",
  "insights.zones.notCounted":
    "Compté dans aucun groupe. Membres montre la liste d’aujourd’hui, donc son nombre peut y différer.",
  "insights.zones.add": "Ajouter leur fuseau horaire ›",
  "insights.zones.usual":
    "Dans leurs heures habituelles pour le plus grand nombre : {hours} ST, {n} des {known} membres avec un fuseau horaire ({missing} non notés). Une estimation d’après leur fuseau, pour les heures que vous fixez, comme les rallyes.",
  "insights.zones.seeWho": "Voir qui ›",
};
