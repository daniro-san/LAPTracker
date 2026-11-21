// The officers' Insights page's KvK cost and recovery, squads seen (issue 489, part 2) and Raid Shield
// history (part 3) sections in English, Brazilian Portuguese and French; dictionary.insights.ts spreads
// them. Help, never blame (D75); thanks first; squads and shields are counts only and 3 squads is normal
// (D136). French puts a no-break space before : ; ? !.
export const insightsMoreEn = {
  "insights.more": "Show the details",
  "insights.kvk.head": "KvK cost and recovery",
  "insights.kvk.none":
    "No KvK in these weeks has both a Start and an End read yet. This fills in after the next one.",
  "insights.kvk.headline":
    "Last KvK, {date}: the alliance lost {lost} of its might, and {back} of that is back.",
  "insights.kvk.headlineNoLoss": "Last KvK, {date}: the alliance lost no might.",
  "insights.kvk.event": "KvK {date}",
  "insights.kvk.eventLine": "KvK {date} · lost {lost} · {back} back",
  "insights.kvk.eventLineNoLoss": "KvK {date} · no might lost",
  "insights.kvk.counted.one":
    "Counted over the {n} member in its Start and End reads who is still with us.",
  "insights.kvk.counted.other":
    "Counted over the {n} members in its Start and End reads who are still with us.",
  "insights.kvk.notCounted": "Not counted: {list}.",
  "insights.kvk.others.one":
    "{n} other current member (joined since, missing from a KvK read, or no might now)",
  "insights.kvk.others.other":
    "{n} other current members (joined since, missing from a KvK read, or no might now)",
  "insights.kvk.left.one": "{n} who left since",
  "insights.kvk.left.other": "{n} who left since",
  "insights.kvk.before": "Before (Start read)",
  "insights.kvk.after": "After (End read)",
  "insights.kvk.now": "Now ({date})",
  "insights.kvk.by": "On {date}, before the next KvK",
  "insights.kvk.lostNote": "lost {lost}",
  "insights.kvk.backNote": "{back} back",
  "insights.kvk.days": "Share of the loss back, day by day",
  "insights.kvk.people": "Each member, in name order ({n})",
  "insights.kvk.person": "lost {lost} · now {back} of before",
  "insights.kvk.personNoLoss": "no loss · now {back} of before",
  "insights.kvk.help.head": "Took a heavy hit — maybe offer help",
  "insights.kvk.help.lead":
    "Lost more than a quarter of their might in the last KvK and are still under 80% of what they had before. Rebuilding takes time; a word or a hand may help.",
  "insights.kvk.help.none": "Nobody from the last KvK is still far below where they were.",
  "insights.squads.head": "Squads seen",
  "insights.squads.based.one":
    "From the tracker’s squad reads, for the {n} member in the newest daily read. It counts the squads the tracker has seen, not every squad a member has.",
  "insights.squads.based.other":
    "From the tracker’s squad reads, for the {n} members in the newest daily read. It counts the squads the tracker has seen, not every squad a member has.",
  "insights.squads.headline":
    "{seen} of {members} members have squads seen; {fresh} of them in the last 24 hours.",
  "insights.squads.headlineNoneFresh":
    "{seen} of {members} members have squads seen; none in the last 24 hours.",
  "insights.squads.counts": "Squads seen per member",
  "insights.squads.count.0": "1 squad",
  "insights.squads.count.1": "2 squads",
  "insights.squads.count.2": "3 or more",
  "insights.squads.none": "None seen yet",
  "insights.squads.fresh": "When each member’s squads were last seen",
  "insights.squads.fresh.0": "In the last 24 hours",
  "insights.squads.fresh.1": "1 to 3 days ago",
  "insights.squads.fresh.2": "More than 3 days ago",
  "insights.squads.noTime": "The tracker sent no time",
  "insights.squads.power": "Strongest squad’s might, in four equal groups (middle value)",
  "insights.squads.band": "{low} – {high}",
  "insights.shield.head": "Raid Shield check",
  "insights.shield.headline":
    "Last raid, {date}: {morning} seen with a shield at the morning check (night check: {night}).",
  "insights.shield.headlineMorning":
    "Last raid, {date}: {morning} seen with a shield at the morning check; no reading at the night check.",
  "insights.shield.headlineNight":
    "Last raid, {date}: {night} seen with a shield at the night check; no reading at the morning check.",
  "insights.shield.headlineRunning":
    "Last raid, {date}: the morning check is under way (night check: {night}).",
  "insights.shield.headlineRunningNoNight": "Last raid, {date}: the morning check is under way.",
  "insights.shield.none":
    "No Raid Shield check has a reading in the last {n} weeks. This fills in after the next night check, on Friday from 23:30 ST.",
  "insights.shield.thanks": "Thank you to everyone who turned on a shield.",
  "insights.shield.lead":
    "The night check reads every member on Friday from 23:30 ST (readings from 23:00 to 00:00 ST count), the morning check on Saturday before KvK at 12:00 ST. The tracker sees a shield at its map scan, every 1 to 7 hours, so a shield turned on late may not show; members with no reading are left out.",
  "insights.shield.weeks": "Week by week, the newest first",
  "insights.shield.night": "Night check",
  "insights.shield.morning": "Morning check",
  "insights.shield.of": "{seen} seen of {read} read",
  "insights.shield.notRead": "{n} not read",
  "insights.shield.noReading": "no reading",
  "insights.shield.partial": "partial reading",
  "insights.shield.underWay": "under way",
};

type MoreWords = Record<keyof typeof insightsMoreEn, string>;

export const insightsMorePt: MoreWords = {
  "insights.more": "Mostrar os detalhes",
  "insights.kvk.head": "Custo e recuperação da KvK",
  "insights.kvk.none":
    "Nenhuma KvK destas semanas tem ainda leitura de Início e de Fim. Isto se preenche depois da próxima.",
  "insights.kvk.headline":
    "Última KvK, {date}: a aliança perdeu {lost} do poder, e {back} disso já voltou.",
  "insights.kvk.headlineNoLoss": "Última KvK, {date}: a aliança não perdeu poder.",
  "insights.kvk.event": "KvK {date}",
  "insights.kvk.eventLine": "KvK {date} · perdeu {lost} · {back} voltou",
  "insights.kvk.eventLineNoLoss": "KvK {date} · sem perda de poder",
  "insights.kvk.counted.one":
    "Conta o {n} membro das leituras de Início e de Fim que ainda está com a gente.",
  "insights.kvk.counted.other":
    "Conta os {n} membros das leituras de Início e de Fim que ainda estão com a gente.",
  "insights.kvk.notCounted": "Fora da conta: {list}.",
  "insights.kvk.others.one":
    "{n} outro membro atual (entrou depois, faltou numa leitura da KvK ou está sem poder agora)",
  "insights.kvk.others.other":
    "{n} outros membros atuais (entraram depois, faltaram numa leitura da KvK ou estão sem poder agora)",
  "insights.kvk.left.one": "{n} que saiu depois",
  "insights.kvk.left.other": "{n} que saíram depois",
  "insights.kvk.before": "Antes (leitura de Início)",
  "insights.kvk.after": "Depois (leitura de Fim)",
  "insights.kvk.now": "Agora ({date})",
  "insights.kvk.by": "Em {date}, antes da KvK seguinte",
  "insights.kvk.lostNote": "perdeu {lost}",
  "insights.kvk.backNote": "{back} voltou",
  "insights.kvk.days": "Quanto da perda voltou, dia a dia",
  "insights.kvk.people": "Cada membro, em ordem de nome ({n})",
  "insights.kvk.person": "perdeu {lost} · agora {back} do que tinha",
  "insights.kvk.personNoLoss": "sem perda · agora {back} do que tinha",
  "insights.kvk.help.head": "Levaram um golpe forte — que tal oferecer ajuda?",
  "insights.kvk.help.lead":
    "Perderam mais de um quarto do poder na última KvK e ainda estão abaixo de 80% do que tinham antes. Reconstruir leva tempo; uma palavra ou uma mão pode ajudar.",
  "insights.kvk.help.none": "Ninguém da última KvK continua muito abaixo de onde estava.",
  "insights.squads.head": "Esquadrões vistos",
  "insights.squads.based.one":
    "Das leituras de esquadrões do tracker, para o {n} membro da leitura diária mais recente. Conta os esquadrões que o tracker viu, não todos os que o membro tem.",
  "insights.squads.based.other":
    "Das leituras de esquadrões do tracker, para os {n} membros da leitura diária mais recente. Conta os esquadrões que o tracker viu, não todos os que o membro tem.",
  "insights.squads.headline":
    "{seen} de {members} membros têm esquadrões vistos; {fresh} deles nas últimas 24 horas.",
  "insights.squads.headlineNoneFresh":
    "{seen} de {members} membros têm esquadrões vistos; nenhum nas últimas 24 horas.",
  "insights.squads.counts": "Esquadrões vistos por membro",
  "insights.squads.count.0": "1 esquadrão",
  "insights.squads.count.1": "2 esquadrões",
  "insights.squads.count.2": "3 ou mais",
  "insights.squads.none": "Nenhum visto ainda",
  "insights.squads.fresh": "Quando os esquadrões de cada membro foram vistos pela última vez",
  "insights.squads.fresh.0": "Nas últimas 24 horas",
  "insights.squads.fresh.1": "Há 1 a 3 dias",
  "insights.squads.fresh.2": "Há mais de 3 dias",
  "insights.squads.noTime": "O tracker não mandou a hora",
  "insights.squads.power": "Poder do esquadrão mais forte, em quatro grupos iguais (valor do meio)",
  "insights.squads.band": "{low} – {high}",
  "insights.shield.head": "Conferência do Escudo de raid",
  "insights.shield.headline":
    "Último raid, {date}: {morning} vistos com escudo na conferência da manhã (conferência da noite: {night}).",
  "insights.shield.headlineMorning":
    "Último raid, {date}: {morning} vistos com escudo na conferência da manhã; sem leitura na conferência da noite.",
  "insights.shield.headlineNight":
    "Último raid, {date}: {night} vistos com escudo na conferência da noite; sem leitura na conferência da manhã.",
  "insights.shield.headlineRunning":
    "Último raid, {date}: a conferência da manhã está em andamento (conferência da noite: {night}).",
  "insights.shield.headlineRunningNoNight":
    "Último raid, {date}: a conferência da manhã está em andamento.",
  "insights.shield.none":
    "Nenhuma Conferência do Escudo de raid tem leitura nas últimas {n} semanas. Aparece depois da próxima conferência da noite, na sexta a partir das 23:30 ST.",
  "insights.shield.thanks": "Obrigado a todos que ligaram o escudo.",
  "insights.shield.lead":
    "A conferência da noite lê todos os membros na sexta a partir das 23:30 ST (contam as leituras das 23:00 às 00:00 ST), e a da manhã no sábado, antes do KvK às 12:00 ST. O tracker vê o escudo na varredura do mapa, a cada 1 a 7 horas, então um escudo ligado tarde pode não aparecer; membros sem leitura ficam de fora.",
  "insights.shield.weeks": "Semana a semana, a mais recente primeiro",
  "insights.shield.night": "Conferência da noite",
  "insights.shield.morning": "Conferência da manhã",
  "insights.shield.of": "{seen} vistos de {read} lidos",
  "insights.shield.notRead": "{n} sem leitura",
  "insights.shield.noReading": "sem leitura",
  "insights.shield.partial": "leitura parcial",
  "insights.shield.underWay": "em andamento",
};

export const insightsMoreFr: MoreWords = {
  "insights.more": "Voir le détail",
  "insights.kvk.head": "Le coût de la KvK et la reprise",
  "insights.kvk.none":
    "Aucune KvK de ces semaines n’a encore un relevé de Début et de Fin. Ça se remplit après la prochaine.",
  "insights.kvk.headline":
    "Dernière KvK, {date} : l’alliance a perdu {lost} de sa puissance, et {back} de cette perte est revenue.",
  "insights.kvk.headlineNoLoss": "Dernière KvK, {date} : l’alliance n’a pas perdu de puissance.",
  "insights.kvk.event": "KvK {date}",
  "insights.kvk.eventLine": "KvK {date} · perdu {lost} · {back} récupéré",
  "insights.kvk.eventLineNoLoss": "KvK {date} · pas de puissance perdue",
  "insights.kvk.counted.one":
    "Compté sur le {n} membre de ses relevés de Début et de Fin qui est toujours avec nous.",
  "insights.kvk.counted.other":
    "Compté sur les {n} membres de ses relevés de Début et de Fin qui sont toujours avec nous.",
  "insights.kvk.notCounted": "Pas comptés : {list}.",
  "insights.kvk.others.one":
    "{n} autre membre actuel (arrivé depuis, absent d’un relevé de la KvK ou sans puissance maintenant)",
  "insights.kvk.others.other":
    "{n} autres membres actuels (arrivés depuis, absents d’un relevé de la KvK ou sans puissance maintenant)",
  "insights.kvk.left.one": "{n} parti depuis",
  "insights.kvk.left.other": "{n} partis depuis",
  "insights.kvk.before": "Avant (relevé de Début)",
  "insights.kvk.after": "Après (relevé de Fin)",
  "insights.kvk.now": "Maintenant ({date})",
  "insights.kvk.by": "Le {date}, avant la KvK suivante",
  "insights.kvk.lostNote": "perdu {lost}",
  "insights.kvk.backNote": "{back} récupéré",
  "insights.kvk.days": "La part de la perte récupérée, jour par jour",
  "insights.kvk.people": "Chaque membre, par ordre de nom ({n})",
  "insights.kvk.person": "perdu {lost} · maintenant {back} d’avant",
  "insights.kvk.personNoLoss": "pas de perte · maintenant {back} d’avant",
  "insights.kvk.help.head": "Ont pris un gros coup — proposez peut-être de l’aide",
  "insights.kvk.help.lead":
    "Ont perdu plus d’un quart de leur puissance à la dernière KvK et sont encore sous 80 % de ce qu’ils avaient avant. Reconstruire prend du temps ; un mot ou un coup de main peut aider.",
  "insights.kvk.help.none": "Personne de la dernière KvK n’est encore loin de là où il était.",
  "insights.squads.head": "Escouades vues",
  "insights.squads.based.one":
    "D’après les relevés d’escouades du tracker, pour le {n} membre du relevé quotidien le plus récent. On compte les escouades que le tracker a vues, pas toutes celles qu’un membre a.",
  "insights.squads.based.other":
    "D’après les relevés d’escouades du tracker, pour les {n} membres du relevé quotidien le plus récent. On compte les escouades que le tracker a vues, pas toutes celles qu’un membre a.",
  "insights.squads.headline":
    "{seen} membres sur {members} ont des escouades vues, dont {fresh} ces dernières 24 heures.",
  "insights.squads.headlineNoneFresh":
    "{seen} membres sur {members} ont des escouades vues, aucun ces dernières 24 heures.",
  "insights.squads.counts": "Escouades vues par membre",
  "insights.squads.count.0": "1 escouade",
  "insights.squads.count.1": "2 escouades",
  "insights.squads.count.2": "3 ou plus",
  "insights.squads.none": "Aucune vue pour l’instant",
  "insights.squads.fresh":
    "Quand les escouades de chaque membre ont été vues pour la dernière fois",
  "insights.squads.fresh.0": "Ces dernières 24 heures",
  "insights.squads.fresh.1": "Il y a 1 à 3 jours",
  "insights.squads.fresh.2": "Il y a plus de 3 jours",
  "insights.squads.noTime": "Le tracker n’a pas envoyé l’heure",
  "insights.squads.power":
    "Puissance de l’escouade la plus forte, en quatre groupes égaux (valeur du milieu)",
  "insights.squads.band": "{low} – {high}",
  "insights.shield.head": "Vérification du Bouclier de raid",
  "insights.shield.headline":
    "Dernier raid, {date} : {morning} vus avec un bouclier à la vérification du matin (vérification du soir : {night}).",
  "insights.shield.headlineMorning":
    "Dernier raid, {date} : {morning} vus avec un bouclier à la vérification du matin ; pas de lecture à la vérification du soir.",
  "insights.shield.headlineNight":
    "Dernier raid, {date} : {night} vus avec un bouclier à la vérification du soir ; pas de lecture à la vérification du matin.",
  "insights.shield.headlineRunning":
    "Dernier raid, {date} : la vérification du matin est en cours (vérification du soir : {night}).",
  "insights.shield.headlineRunningNoNight":
    "Dernier raid, {date} : la vérification du matin est en cours.",
  "insights.shield.none":
    "Aucune vérification du Bouclier de raid n’a de lecture ces {n} dernières semaines. Elle se remplira après la prochaine vérification du soir, le vendredi à partir de 23:30 ST.",
  "insights.shield.thanks": "Merci à tous ceux qui ont activé un bouclier.",
  "insights.shield.lead":
    "La vérification du soir lit chaque membre le vendredi à partir de 23:30 ST (les lectures de 23:00 à 00:00 ST comptent), celle du matin le samedi avant le KvK à 12:00 ST. Le tracker voit un bouclier lors de son scan de la carte, toutes les 1 à 7 heures : un bouclier activé tard peut ne pas apparaître ; les membres sans lecture sont laissés de côté.",
  "insights.shield.weeks": "Semaine par semaine, la plus récente d’abord",
  "insights.shield.night": "Vérification du soir",
  "insights.shield.morning": "Vérification du matin",
  "insights.shield.of": "{seen} vus sur {read} lus",
  "insights.shield.notRead": "{n} non lus",
  "insights.shield.noReading": "pas de lecture",
  "insights.shield.partial": "lecture partielle",
  "insights.shield.underWay": "en cours",
};
