// The officers' Insights page's Usual hours card and the member card's usual-hours line (issue 873, D163) in
// English, Brazilian Portuguese and French; dictionary.insights.ts spreads them. Desk only, counts of members
// and a band of server hours per member; never "online now"; a member with too few readings is "not enough
// readings yet", never a gap against them (D75). Times end in ST. French puts a no-break space before : ; ? !.
export const insightsUsualEn = {
  "insights.usual.head": "Usual hours in game",
  "insights.usual.top":
    "Most members are usually in game around {hours} ST: {count} of the {enough} members with enough readings.",
  "insights.usual.coverage":
    "Enough readings for {enough} of the {members} members in the newest daily update ({min} or more in the last 30 days).",
  "insights.usual.none": "Not enough readings yet to say when anyone is usually in game.",
  "insights.usual.bias":
    "A daily reading leans toward late hours, so read these hours as a guide, not a schedule.",
  "insights.usual.legend":
    "Members whose usual hours include each hour (ST). Bar: share of the {enough} members with enough readings.",
  "insights.usual.st": "{time} ST",
  "insights.usual.card": "Usually in game around {hours} ST (from {n} readings)",
  "insights.usual.cardNone": "Usual hours in game: not enough readings yet ({n} so far)",
};

type UsualWords = Record<keyof typeof insightsUsualEn, string>;

export const insightsUsualPt: UsualWords = {
  "insights.usual.head": "Horários habituais no jogo",
  "insights.usual.top":
    "A maioria dos membros costuma estar no jogo por volta de {hours} ST: {count} dos {enough} membros com leituras suficientes.",
  "insights.usual.coverage":
    "Leituras suficientes para {enough} dos {members} membros da atualização diária mais recente ({min} ou mais nos últimos 30 dias).",
  "insights.usual.none":
    "Ainda não há leituras suficientes para dizer quando alguém costuma estar no jogo.",
  "insights.usual.bias":
    "Uma leitura por dia tende a cair nas horas mais tardias; leia estes horários como um guia, não como uma agenda.",
  "insights.usual.legend":
    "Membros cujos horários habituais incluem cada hora (ST). Barra: parte dos {enough} membros com leituras suficientes.",
  "insights.usual.st": "{time} ST",
  "insights.usual.card": "Costuma estar no jogo por volta de {hours} ST (de {n} leituras)",
  "insights.usual.cardNone":
    "Horários habituais no jogo: ainda sem leituras suficientes ({n} até agora)",
};

export const insightsUsualFr: UsualWords = {
  "insights.usual.head": "Heures habituelles en jeu",
  "insights.usual.top":
    "La plupart des membres sont habituellement en jeu vers {hours} ST : {count} des {enough} membres avec assez de relevés.",
  "insights.usual.coverage":
    "Assez de relevés pour {enough} des {members} membres de la mise à jour quotidienne la plus récente ({min} ou plus sur les 30 derniers jours).",
  "insights.usual.none":
    "Pas encore assez de relevés pour dire quand quelqu’un est habituellement en jeu.",
  "insights.usual.bias":
    "Un relevé par jour penche vers les heures tardives ; lisez ces heures comme un repère, pas comme un planning.",
  "insights.usual.legend":
    "Membres dont les heures habituelles incluent chaque heure (ST). Barre : part des {enough} membres avec assez de relevés.",
  "insights.usual.st": "{time} ST",
  "insights.usual.card": "Habituellement en jeu vers {hours} ST (sur {n} relevés)",
  "insights.usual.cardNone":
    "Heures habituelles en jeu : pas encore assez de relevés ({n} pour l’instant)",
};
