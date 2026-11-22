// A member's own page on the board (issue 487, D142) in English, Brazilian Portuguese and French, with the
// officers' side of the link (Home's "To review" and the member card). Spread by dictionary.board.ts.
// People first (D75): the member's own numbers only, never a rank, a comparison with others or a score.
// French puts a no-break space before : ; ! and ?.
export const meEn = {
  "me.open": "Your own page: your progress, your week, your squads and where you’re needed",
  "me.title": "Your page",
  "me.lead": "Only your own numbers, squads and plans. Nobody else’s are here.",
  "me.back": "Back to the members’ board",
  "me.preview": "This is your own page as an officer: a member sees theirs the same way.",
  "me.link.head": "Which player are you?",
  "me.link.lead":
    "Pick your player in the alliance. An officer confirms it is you before your page opens.",
  "me.link.noRoster":
    "The alliance’s roster has not been read yet. Come back after the next daily update.",
  "me.pending":
    "Waiting for an officer to confirm that you are {name}. Your page opens once they do.",
  "me.pending.cancel": "Pick another player",
  "me.taken": "Already linked — ask an officer.",
  "me.notInAlliance": "That player is not in the alliance’s newest roster.",
  "me.failed": "Could not save. Try again.",
  "me.linked": "In the game, you are {name}.",
  "me.left":
    "{name} is not in the alliance’s newest roster, so your page is closed for now. If you come back, it opens again.",
  "me.progress.head": "Your progress",
  "me.progress.lead": "Your might and kills on each daily update of the last 30 days.",
  "me.might": "Might",
  "me.kills": "Kills",
  "me.change": "{label} {v} · {delta} since {date}",
  "me.same": "{label} {v} · unchanged since {date}",
  "me.progress.early": "Your chart starts after two daily updates.",
  "me.kvk.back": "Back to {pct}% of your might before KvK ({date}).",
  "me.kvk.full": "Fully back: {pct}% of your might before KvK ({date}).",
  "me.week.head": "This week",
  "me.week.lead": "Monday to Sunday, server days, with your own last week under each row.",
  "me.week.thanks": "Thanks for every day you play with the alliance.",
  "me.week.coins": "Alliance Help coins (game cap 1,000)",
  "me.week.this": "This week: {line}",
  "me.week.thisNone": "This week: no average yet",
  "me.week.last": "Last week: {line}",
  "me.week.lastNone": "Last week: no average",
  "me.week.legend": "No daily update that day: it never counts.",
  "me.week.legendNone": "“none”: that day’s daily update listed you with nothing sent.",
  "me.week.later": "no daily update yet",
  "me.week.noRead": "No daily update",
  "me.week.early": "Your week shows after the first daily update.",
  // Owner, 2026-11-22 (#663): the card's average rule, said where the member reads their own.
  "me.week.legendZero": "A “none” day counts as 0 in the average.",
  "me.squads.none": "The tracker has not seen your squads yet.",
  "me.needed.head": "Where you’re needed",
  "me.needed.lead": "What your officers planned with you this week. Times are in server time (ST).",
  "me.needed.none": "Nothing planned with you this week yet.",
  "me.elixir": "Elixir Scramble this week: Team {team}",
  "me.caravan.coach": "Alliance Caravan, {day}: you are the Coachman.",
  "me.caravan.vip": "Alliance Caravan, {day}: you ride as VIP.",
  "me.caravan.guardian": "Alliance Caravan, {day}: you are the Guardian.",
  "me.mark": "{title}, {day} · your mark: “{mark}”",
  "me.step.shield.reset": "Next step: turn on your shield before the reset (00:00 ST).",
  "me.step.shield.kvk": "Next step: turn on your shield before KvK starts at {time} ST.",
  "me.step.wall.reset": "Next step: take your squads off the wall before the reset (00:00 ST).",
  "me.step.wall.kvk": "Next step: take your squads off the wall before KvK starts at {time} ST.",
  "me.review.line": "{discord} says they are {player}",
  "me.review.lead":
    "Approve only when you know it is them: anyone can change their Discord nickname.",
  "me.review.match": "Hint: the Discord name matches this game name.",
  "me.review.noMatch": "Hint: the Discord name is not this game name.",
  "me.review.taken": "Someone else already has this player. Remove one of the two links first.",
  "me.review.changed": "This claim changed since you opened the page. Look again.",
  "me.review.approve": "Approve",
  "me.review.asked": "Asked on {day} to see their own page.",
  "me.review.notThem": "Not them",
  "me.card.linked": "Linked to Discord: {name}",
  "me.card.pending": "{name} on Discord says this is them. Waiting for an officer.",
  "me.card.remove": "Remove link",
  "me.card.removeAsk":
    "Remove this link? {name} no longer sees their own page until they pick their player again.",
  "me.card.keep": "Keep it",
  "me.card.removed": "Link removed.",
} as const;

export type MeWords = Record<keyof typeof meEn, string>;

/** The words the desk's link controls take (Home's To review and the member card), and no more. */
const LINK_KEYS = [
  "me.review.line",
  "me.review.lead",
  "me.review.match",
  "me.review.noMatch",
  "me.review.approve",
  "me.review.asked",
  "me.review.notThem",
  "me.review.taken",
  "me.review.changed",
  "me.card.linked",
  "me.card.pending",
  "me.card.remove",
  "me.card.removeAsk",
  "me.card.keep",
  "me.card.removed",
  "me.failed",
] as const;
export type LinkWords = Record<(typeof LINK_KEYS)[number], string>;

export const linkWords = (t: MeWords): LinkWords =>
  Object.fromEntries(LINK_KEYS.map((k) => [k, t[k]])) as LinkWords;

export const mePt: MeWords = {
  "me.open": "Sua página: seu progresso, sua semana, seus esquadrões e onde precisam de você",
  "me.title": "Sua página",
  "me.lead": "Só os seus números, esquadrões e planos. Os de mais ninguém aparecem aqui.",
  "me.back": "Voltar ao mural dos membros",
  "me.preview": "Esta é a sua página como oficial: um membro vê a dele do mesmo jeito.",
  "me.link.head": "Qual jogador é você?",
  "me.link.lead":
    "Escolha seu jogador na aliança. Um oficial confirma que é você antes de a página abrir.",
  "me.link.noRoster":
    "A lista da aliança ainda não foi lida. Volte depois da próxima atualização diária.",
  "me.pending":
    "Esperando um oficial confirmar que você é {name}. Sua página abre assim que confirmarem.",
  "me.pending.cancel": "Escolher outro jogador",
  "me.taken": "Já vinculado — fale com um oficial.",
  "me.notInAlliance": "Esse jogador não está na lista mais recente da aliança.",
  "me.failed": "Não deu para salvar. Tente de novo.",
  "me.linked": "No jogo, você é {name}.",
  "me.left":
    "{name} não está na lista mais recente da aliança, então sua página está fechada por enquanto. Se você voltar, ela abre de novo.",
  "me.progress.head": "Seu progresso",
  "me.progress.lead": "Seu might e suas kills em cada atualização diária dos últimos 30 dias.",
  "me.might": "Might",
  "me.kills": "Kills",
  "me.change": "{label} {v} · {delta} desde {date}",
  "me.same": "{label} {v} · igual desde {date}",
  "me.progress.early": "Seu gráfico começa depois de duas atualizações diárias.",
  "me.kvk.back": "De volta a {pct}% do seu might de antes do KvK ({date}).",
  "me.kvk.full": "Totalmente recuperado: {pct}% do seu might de antes do KvK ({date}).",
  "me.week.head": "Esta semana",
  "me.week.lead":
    "De segunda a domingo, em dias do servidor, com a sua semana passada embaixo de cada linha.",
  "me.week.thanks": "Obrigado por cada dia que você joga com a aliança.",
  "me.week.coins": "Moedas de Ajuda da aliança (limite do jogo 1.000)",
  "me.week.this": "Esta semana: {line}",
  "me.week.thisNone": "Esta semana: ainda sem média",
  "me.week.last": "Semana passada: {line}",
  "me.week.lastNone": "Semana passada: sem média",
  "me.week.legend": "Sem atualização diária nesse dia: nunca conta.",
  "me.week.legendNone": "“nada”: a atualização diária listou você naquele dia, sem nada enviado.",
  "me.week.later": "ainda sem atualização diária",
  "me.week.noRead": "Sem atualização diária",
  "me.week.early": "Sua semana aparece depois da primeira atualização diária.",
  "me.week.legendZero": "Um dia “nada” conta como 0 na média.",
  "me.squads.none": "O tracker ainda não viu seus esquadrões.",
  "me.needed.head": "Onde precisam de você",
  "me.needed.lead":
    "O que seus oficiais planejaram com você esta semana. Os horários estão no horário do servidor (ST).",
  "me.needed.none": "Nada planejado com você esta semana ainda.",
  "me.elixir": "Elixir Scramble esta semana: Team {team}",
  "me.caravan.coach": "Alliance Caravan, {day}: você é o Coachman.",
  "me.caravan.vip": "Alliance Caravan, {day}: você vai como VIP.",
  "me.caravan.guardian": "Alliance Caravan, {day}: você é o Guardian.",
  "me.mark": "{title}, {day} · sua marca: “{mark}”",
  "me.step.shield.reset": "Próximo passo: ligue o seu escudo antes do reset (00:00 ST).",
  "me.step.shield.kvk": "Próximo passo: ligue o seu escudo antes do KvK começar às {time} ST.",
  "me.step.wall.reset":
    "Próximo passo: tire os seus esquadrões da muralha antes do reset (00:00 ST).",
  "me.step.wall.kvk":
    "Próximo passo: tire os seus esquadrões da muralha antes do KvK começar às {time} ST.",
  "me.review.line": "{discord} diz que é {player}",
  "me.review.lead":
    "Aprove só quando souber que é a pessoa: qualquer um pode mudar o apelido no Discord.",
  "me.review.match": "Dica: o nome no Discord é igual a este nome no jogo.",
  "me.review.noMatch": "Dica: o nome no Discord não é este nome no jogo.",
  "me.review.taken": "Outra pessoa já tem esse jogador. Remova um dos dois vínculos antes.",
  "me.review.changed": "Este pedido mudou desde que você abriu a página. Confira de novo.",
  "me.review.approve": "Aprovar",
  "me.review.asked": "Pediu em {day} para ver a própria página.",
  "me.review.notThem": "Não é essa pessoa",
  "me.card.linked": "Vinculado ao Discord: {name}",
  "me.card.pending": "{name} no Discord diz que é esta pessoa. Esperando um oficial.",
  "me.card.remove": "Remover vínculo",
  "me.card.removeAsk":
    "Remover este vínculo? {name} deixa de ver a própria página até escolher o jogador de novo.",
  "me.card.keep": "Manter",
  "me.card.removed": "Vínculo removido.",
};

export const meFr: MeWords = {
  "me.open":
    "Votre page : votre progression, votre semaine, vos escouades et là où on a besoin de vous",
  "me.title": "Votre page",
  "me.lead":
    "Seulement vos propres chiffres, vos escouades et vos plans. Ceux des autres n’y sont pas.",
  "me.back": "Retour au tableau des membres",
  "me.preview": "Voici votre propre page d’officier : un membre voit la sienne de la même façon.",
  "me.link.head": "Quel joueur êtes-vous ?",
  "me.link.lead":
    "Choisissez votre joueur dans l’alliance. Un officier confirme que c’est bien vous avant que votre page s’ouvre.",
  "me.link.noRoster":
    "La liste de l’alliance n’a pas encore été lue. Revenez après la prochaine mise à jour quotidienne.",
  "me.pending":
    "En attente qu’un officier confirme que vous êtes {name}. Votre page s’ouvre dès que c’est fait.",
  "me.pending.cancel": "Choisir un autre joueur",
  "me.taken": "Déjà lié — demandez à un officier.",
  "me.notInAlliance": "Ce joueur n’est pas dans la liste la plus récente de l’alliance.",
  "me.failed": "Impossible d’enregistrer. Réessayez.",
  "me.linked": "En jeu, vous êtes {name}.",
  "me.left":
    "{name} n’est pas dans la liste la plus récente de l’alliance : votre page est fermée pour l’instant. Si vous revenez, elle s’ouvre à nouveau.",
  "me.progress.head": "Votre progression",
  "me.progress.lead":
    "Votre might et vos kills à chaque mise à jour quotidienne des 30 derniers jours.",
  "me.might": "Might",
  "me.kills": "Kills",
  "me.change": "{label} {v} · {delta} depuis le {date}",
  "me.same": "{label} {v} · inchangé depuis le {date}",
  "me.progress.early": "Votre graphique commence après deux mises à jour quotidiennes.",
  "me.kvk.back": "Votre might est revenu à {pct} % de celui d’avant le KvK ({date}).",
  "me.kvk.full": "Votre might a tout récupéré : {pct} % de celui d’avant le KvK ({date}).",
  "me.week.head": "Cette semaine",
  "me.week.lead":
    "Du lundi au dimanche, en jours du serveur, avec votre propre semaine dernière sous chaque ligne.",
  "me.week.thanks": "Merci pour chaque jour où vous jouez avec l’alliance.",
  "me.week.coins": "Pièces d’Aide d’alliance (plafond du jeu 1 000)",
  "me.week.this": "Cette semaine : {line}",
  "me.week.thisNone": "Cette semaine : pas encore de moyenne",
  "me.week.last": "Semaine dernière : {line}",
  "me.week.lastNone": "Semaine dernière : pas de moyenne",
  "me.week.legend": "Pas de mise à jour quotidienne ce jour-là : il ne compte jamais.",
  "me.week.legendNone":
    "« rien » : ce jour-là, la mise à jour quotidienne vous liste sans aucun envoi.",
  "me.week.later": "pas encore de mise à jour quotidienne",
  "me.week.noRead": "Pas de mise à jour quotidienne",
  "me.week.early": "Votre semaine s’affiche après la première mise à jour quotidienne.",
  "me.week.legendZero": "Un jour « rien » compte pour 0 dans la moyenne.",
  "me.squads.none": "Le tracker n’a pas encore vu vos escouades.",
  "me.needed.head": "Là où on a besoin de vous",
  "me.needed.lead":
    "Ce que vos officiers ont prévu avec vous cette semaine. Les heures sont à l’heure du serveur (ST).",
  "me.needed.none": "Rien de prévu avec vous cette semaine pour l’instant.",
  "me.elixir": "Elixir Scramble cette semaine : Team {team}",
  "me.caravan.coach": "Alliance Caravan, {day} : vous êtes le Coachman.",
  "me.caravan.vip": "Alliance Caravan, {day} : vous voyagez en VIP.",
  "me.caravan.guardian": "Alliance Caravan, {day} : vous êtes le Guardian.",
  "me.mark": "{title}, {day} · votre marque : « {mark} »",
  "me.step.shield.reset": "Prochaine étape : activez votre bouclier avant le reset (00:00 ST).",
  "me.step.shield.kvk":
    "Prochaine étape : activez votre bouclier avant le début du KvK à {time} ST.",
  "me.step.wall.reset": "Prochaine étape : retirez vos escouades du mur avant le reset (00:00 ST).",
  "me.step.wall.kvk":
    "Prochaine étape : retirez vos escouades du mur avant le début du KvK à {time} ST.",
  "me.review.line": "{discord} dit être {player}",
  "me.review.lead":
    "N’approuvez que si vous savez que c’est bien la personne : chacun peut changer son surnom Discord.",
  "me.review.match": "Indice : le nom Discord correspond à ce nom en jeu.",
  "me.review.noMatch": "Indice : le nom Discord n’est pas ce nom en jeu.",
  "me.review.taken": "Quelqu’un d’autre a déjà ce joueur. Retirez d’abord l’un des deux liens.",
  "me.review.changed": "Cette demande a changé depuis l’ouverture de la page. Regardez à nouveau.",
  "me.review.approve": "Approuver",
  "me.review.asked": "Demande le {day} à voir sa propre page.",
  "me.review.notThem": "Pas cette personne",
  "me.card.linked": "Lié à Discord : {name}",
  "me.card.pending": "{name} sur Discord dit que c’est cette personne. En attente d’un officier.",
  "me.card.remove": "Retirer le lien",
  "me.card.removeAsk":
    "Retirer ce lien ? {name} ne voit plus sa propre page tant que son joueur n’est pas choisi à nouveau.",
  "me.card.keep": "Le garder",
  "me.card.removed": "Lien retiré.",
};
