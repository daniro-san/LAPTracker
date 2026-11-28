// Insights → KvK → Debrief (issue 872) in English, Brazilian Portuguese and French; dictionary.insights.ts
// spreads them. Thanks first, nobody ranked: names in name order, and no word for who gained nothing (D75).
// The kills words are the KvK recap's (D159 post 5).
export const insightsDebriefEn = {
  "debrief.link": "KvK debrief",
  "debrief.head": "KvK debrief",
  "debrief.lead":
    "The KvK of {date} on one screen, for the meeting after it. Nobody is ranked: names are in name order.",
  "debrief.none":
    "No KvK debrief yet. It shows after a KvK’s End reading of the last 4 weeks. Origin of Chaos weeks have none.",
  "debrief.back": "Back to Insights",
  "debrief.thanks.head": "Thanks",
  "debrief.thanks.lead": "Members with kills gained: {n} of {m}. Kills gained together: {kills}.",
  "debrief.thanks.none": "No kills gained are known for this KvK.",
  "debrief.thanks.support":
    "Defenders and support players gain no kills, and they count just as much. Well done, all of you!",
  "debrief.roll.head": "Roll call",
  "debrief.roll.lead": "The ✓ marks of this KvK’s {kind}, in name order.",
  "debrief.roll.empty": "No ✓ mark.",
  "debrief.roll.none": "No {kind} roll call for this KvK.",
  "debrief.map.head": "Map",
  "debrief.map.lead":
    "Kills gained by distance from the castle point, at the End reading. Counts only.",
  "debrief.map.row": "{band} · {n} members",
  "debrief.recovery.head": "Recovery",
  "debrief.recovery.none": "The recovery shows from the first daily update after the KvK.",
  "debrief.opponent.head": "Opponent",
  "debrief.opponent.lead":
    "Server {server}, Start to End: {us} of our alliances, {them} of theirs.",
  "debrief.raid.lead": "Raid opponent {tag} (S{server}), Start to End of the raid:",
  "debrief.opponent.kills": "Kills gained",
  "debrief.opponent.might": "Might change",
  "debrief.opponent.sides": "{us} us · {them} them",
  "debrief.opponent.none": "No opponent for this KvK, or its End is not read yet.",
  "debrief.card.head": "Card for the leaders’ channel",
  "debrief.card.lead":
    "One picture of this debrief. It names only members who gained kills; the roll call and the map are counts.",
  "debrief.card.download": "Download the card",
};

type DebriefWords = Record<keyof typeof insightsDebriefEn, string>;

export const insightsDebriefPt: DebriefWords = {
  "debrief.link": "Resumo da KvK",
  "debrief.head": "Resumo da KvK",
  "debrief.lead":
    "A KvK de {date} numa tela só, para a reunião depois dela. Ninguém é classificado: os nomes estão em ordem alfabética.",
  "debrief.none":
    "Ainda não há resumo da KvK. Ele aparece depois da leitura do Fim de uma KvK das últimas 4 semanas. Semanas de Origin of Chaos não têm resumo.",
  "debrief.back": "Voltar para Análises",
  "debrief.thanks.head": "Obrigado",
  "debrief.thanks.lead": "Membros com kills ganhos: {n} de {m}. Kills ganhos juntos: {kills}.",
  "debrief.thanks.none": "Nenhum kill ganho é conhecido nesta KvK.",
  "debrief.thanks.support":
    "Defensores e jogadores de apoio não ganham kills, e contam do mesmo jeito. Muito bem, todos vocês!",
  "debrief.roll.head": "Chamada",
  "debrief.roll.lead": "As marcas ✓ da {kind} desta KvK, em ordem alfabética.",
  "debrief.roll.empty": "Nenhuma marca ✓.",
  "debrief.roll.none": "Nenhuma chamada de {kind} nesta KvK.",
  "debrief.map.head": "Mapa",
  "debrief.map.lead":
    "Kills ganhos pela distância do ponto do castelo, na leitura do Fim. Só contagens.",
  "debrief.map.row": "{band} · {n} membros",
  "debrief.recovery.head": "Recuperação",
  "debrief.recovery.none":
    "A recuperação aparece a partir da primeira atualização diária depois da KvK.",
  "debrief.opponent.head": "Adversário",
  "debrief.opponent.lead":
    "Servidor {server}, do Início ao Fim: {us} das nossas alianças, {them} das deles.",
  "debrief.raid.lead": "Adversário do ataque {tag} (S{server}), do Início ao Fim do ataque:",
  "debrief.opponent.kills": "Kills ganhos",
  "debrief.opponent.might": "Mudança de poder",
  "debrief.opponent.sides": "{us} nós · {them} eles",
  "debrief.opponent.none": "Nenhum adversário nesta KvK, ou o Fim dela ainda não foi lido.",
  "debrief.card.head": "Cartão para o canal dos líderes",
  "debrief.card.lead":
    "Uma imagem deste resumo. Ela só nomeia membros que ganharam kills; a chamada e o mapa são contagens.",
  "debrief.card.download": "Baixar o cartão",
};

export const insightsDebriefFr: DebriefWords = {
  "debrief.link": "Bilan de la KvK",
  "debrief.head": "Bilan de la KvK",
  "debrief.lead":
    "La KvK du {date} sur un seul écran, pour la réunion qui la suit. Personne n’est classé : les noms sont dans l’ordre alphabétique.",
  "debrief.none":
    "Pas encore de bilan de la KvK. Il s’affiche après le relevé de fin d’une KvK des 4 dernières semaines. Les semaines d’Origin of Chaos n’en ont pas.",
  "debrief.back": "Retour aux Analyses",
  "debrief.thanks.head": "Merci",
  "debrief.thanks.lead":
    "Membres ayant gagné des Kills : {n} sur {m}. Kills gagnés ensemble : {kills}.",
  "debrief.thanks.none": "Aucun Kill gagné n’est connu pour cette KvK.",
  "debrief.thanks.support":
    "Les défenseurs et les joueurs de soutien ne gagnent pas de Kills, et ils comptent tout autant. Bravo à tous !",
  "debrief.roll.head": "Appel",
  "debrief.roll.lead": "Les marques ✓ de la {kind} de cette KvK, dans l’ordre alphabétique.",
  "debrief.roll.empty": "Aucune marque ✓.",
  "debrief.roll.none": "Pas d’appel de {kind} pour cette KvK.",
  "debrief.map.head": "Carte",
  "debrief.map.lead":
    "Kills gagnés selon la distance au point du château, au relevé de fin. Des nombres seulement.",
  "debrief.map.row": "{band} · {n} membres",
  "debrief.recovery.head": "Reprise",
  "debrief.recovery.none":
    "La reprise s’affiche dès la première mise à jour quotidienne après la KvK.",
  "debrief.opponent.head": "Adversaire",
  "debrief.opponent.lead":
    "Serveur {server}, du début à la fin : {us} de nos alliances, {them} des leurs.",
  "debrief.raid.lead": "Adversaire du raid {tag} (S{server}), du début à la fin du raid :",
  "debrief.opponent.kills": "Kills gagnés",
  "debrief.opponent.might": "Variation de puissance",
  "debrief.opponent.sides": "{us} nous · {them} eux",
  "debrief.opponent.none": "Pas d’adversaire pour cette KvK, ou sa fin n’est pas encore lue.",
  "debrief.card.head": "Carte pour le salon des chefs",
  "debrief.card.lead":
    "Une image de ce bilan. Elle ne nomme que les membres qui ont gagné des Kills ; l’appel et la carte sont des nombres.",
  "debrief.card.download": "Télécharger la carte",
};
