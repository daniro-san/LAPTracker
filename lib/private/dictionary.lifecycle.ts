// The words for new members added by hand and former members (D106, D107) in English, Brazilian
// Portuguese and French: one module the three workspace dictionaries spread, as the sheet import's does.
// Neutral words (D75): a member who left is not a fault. French puts a no-break space before : ; ! and ?.
export const lifecycleEn = {
  "members.view.aria": "Which members",
  "members.view.current": "Members",
  "members.view.former": "Former members",
  "pending.head": "New members",
  "pending.add": "Add a new member",
  "pending.addHelp":
    "For someone who joined today. Their info moves to them when tonight’s daily update lists them.",
  "pending.name": "Name in the game",
  "pending.nameMissing": "Type their name as the game shows it.",
  "pending.tag": "New · waiting for tonight’s roster",
  "pending.unmatched":
    "The daily update of {date} had no single match. Link them to a member, or wait for the next one.",
  "pending.link": "Link to a member",
  "pending.linkTitle": "Link {name} to a member",
  "pending.linkHelp":
    "Their info moves to the member you pick, after anything that member already has.",
  "pending.search": "Search the roster",
  "pending.closest": "Closest names",
  "pending.others": "Everyone else",
  "pending.noMatch": "No member matches.",
  "pending.pick": "Pick",
  "pending.delete": "Delete",
  "pending.deleteAsk": "Delete {name} from the list? The info added here is kept under Dismissed.",
  "pending.keep": "Keep",
  "pending.failed": "Could not save. Try again.",
  "pending.taken": "{name} is already in the alliance. Open them instead?",
  "pending.open": "Open",
  "pending.addAnyway": "Add anyway",
  "pending.toMatch.one": "{n} new member to match",
  "pending.toMatch.other": "{n} new members to match",
  "pending.toMatchHelp":
    "No daily update since they were added had a single match. Link each one to a member.",
  "pending.toMatchTag": "To match",
  "pending.dismissed": "Dismissed ({n})",
  "pending.dismissedOn": "Dismissed {date}",
  "pending.dismissedHelp":
    "Deleted from the list. Their info is kept here, and comes back if you add the same name again.",
  "former.lead":
    "Members seen in an earlier roster who are not in the newest one. Their info is kept, and comes back if they return.",
  "former.none": "No former members yet.",
  "former.search": "Search former members",
  "former.empty": "No former member matches.",
  "former.lastSeen": "Last seen {date}",
  "former.more": "Show 25 more",
  "former.duel": "Alliance Duel, week of {date}",
  "shots.newMember": "New member: {name}",
  "shots.newName": "New member’s name in the game",
  "shots.newHelp":
    "Saves to a new member who waits for tonight’s roster. Fix the name if the screenshot misread it.",
  "shots.pickInstead": "Pick a member instead",
  "shots.pendingGroup": "New, waiting for the roster",
  "shots.taken": "{name} is already in the alliance. Pick them instead?",
  "shots.pickThem": "Pick them",
  "shots.addAnyway": "Add anyway",
  "shots.why.taken":
    "Row {row}: that name is already in the alliance. Pick them, or tap Add anyway.",
} as const;

type LifecycleKey = keyof typeof lifecycleEn;

export const lifecyclePt: Record<LifecycleKey, string> = {
  "members.view.aria": "Quais membros",
  "members.view.current": "Membros",
  "members.view.former": "Ex-membros",
  "pending.head": "Membros novos",
  "pending.add": "Adicionar membro novo",
  "pending.addHelp":
    "Para quem entrou hoje. As informações passam para a pessoa quando a atualização diária de hoje à noite a listar.",
  "pending.name": "Nome no jogo",
  "pending.nameMissing": "Digite o nome como aparece no jogo.",
  "pending.tag": "Novo · esperando a lista de hoje à noite",
  "pending.unmatched":
    "A atualização diária de {date} não achou um nome único. Ligue a um membro ou espere a próxima.",
  "pending.link": "Ligar a um membro",
  "pending.linkTitle": "Ligar {name} a um membro",
  "pending.linkHelp":
    "As informações passam para o membro escolhido, depois do que esse membro já tem.",
  "pending.search": "Buscar na lista",
  "pending.closest": "Nomes mais parecidos",
  "pending.others": "Todos os outros",
  "pending.noMatch": "Nenhum membro encontrado.",
  "pending.pick": "Escolher",
  "pending.delete": "Apagar",
  "pending.deleteAsk":
    "Apagar {name} da lista? As informações adicionadas aqui ficam guardadas em Apagados.",
  "pending.keep": "Manter",
  "pending.failed": "Não foi possível salvar. Tente de novo.",
  "pending.taken": "{name} já está na aliança. Abrir essa pessoa em vez disso?",
  "pending.open": "Abrir",
  "pending.addAnyway": "Adicionar mesmo assim",
  "pending.toMatch.one": "{n} membro novo para ligar",
  "pending.toMatch.other": "{n} membros novos para ligar",
  "pending.toMatchHelp":
    "Nenhuma atualização diária desde que foram adicionados achou um nome único. Ligue cada um a um membro.",
  "pending.toMatchTag": "Para ligar",
  "pending.dismissed": "Apagados ({n})",
  "pending.dismissedOn": "Apagado em {date}",
  "pending.dismissedHelp":
    "Tirados da lista. As informações ficam guardadas aqui e voltam se você adicionar o mesmo nome de novo.",
  "former.lead":
    "Membros que estavam numa lista anterior e não estão na mais recente. As informações ficam guardadas e voltam se a pessoa voltar.",
  "former.none": "Nenhum ex-membro ainda.",
  "former.search": "Buscar ex-membros",
  "former.empty": "Nenhum ex-membro encontrado.",
  "former.lastSeen": "Visto por último em {date}",
  "former.more": "Mostrar mais 25",
  "former.duel": "Alliance Duel, semana de {date}",
  "shots.newMember": "Membro novo: {name}",
  "shots.newName": "Nome do membro novo no jogo",
  "shots.newHelp":
    "Salva num membro novo que espera a lista de hoje à noite. Corrija o nome se o print foi lido errado.",
  "shots.pickInstead": "Escolher um membro",
  "shots.pendingGroup": "Novos, esperando a lista",
  "shots.taken": "{name} já está na aliança. Escolher essa pessoa em vez disso?",
  "shots.pickThem": "Escolher",
  "shots.addAnyway": "Adicionar mesmo assim",
  "shots.why.taken":
    "Linha {row}: esse nome já está na aliança. Escolha a pessoa ou toque em Adicionar mesmo assim.",
};

export const lifecycleFr: Record<LifecycleKey, string> = {
  "members.view.aria": "Quels membres",
  "members.view.current": "Membres",
  "members.view.former": "Anciens membres",
  "pending.head": "Nouveaux membres",
  "pending.add": "Ajouter un nouveau membre",
  "pending.addHelp":
    "Pour quelqu’un arrivé aujourd’hui. Ses infos passent à son nom quand la mise à jour quotidienne de ce soir le liste.",
  "pending.name": "Nom dans le jeu",
  "pending.nameMissing": "Tapez son nom tel que le jeu l’affiche.",
  "pending.tag": "Nouveau · attend la liste de ce soir",
  "pending.unmatched":
    "La mise à jour quotidienne du {date} n’a pas trouvé de nom unique. Reliez-le à un membre, ou attendez la suivante.",
  "pending.link": "Relier à un membre",
  "pending.linkTitle": "Relier {name} à un membre",
  "pending.linkHelp": "Ses infos passent au membre choisi, après celles que ce membre a déjà.",
  "pending.search": "Chercher dans la liste",
  "pending.closest": "Noms les plus proches",
  "pending.others": "Tous les autres",
  "pending.noMatch": "Aucun membre trouvé.",
  "pending.pick": "Choisir",
  "pending.delete": "Supprimer",
  "pending.deleteAsk":
    "Retirer {name} de la liste ? Les infos ajoutées ici sont gardées sous Supprimés.",
  "pending.keep": "Garder",
  "pending.failed": "Enregistrement impossible. Réessayez.",
  "pending.taken": "{name} est déjà dans l’alliance. L’ouvrir plutôt ?",
  "pending.open": "Ouvrir",
  "pending.addAnyway": "Ajouter quand même",
  "pending.toMatch.one": "{n} nouveau membre à relier",
  "pending.toMatch.other": "{n} nouveaux membres à relier",
  "pending.toMatchHelp":
    "Aucune mise à jour quotidienne depuis leur ajout n’a trouvé de nom unique. Reliez chacun à un membre.",
  "pending.toMatchTag": "À relier",
  "pending.dismissed": "Supprimés ({n})",
  "pending.dismissedOn": "Supprimé le {date}",
  "pending.dismissedHelp":
    "Retirés de la liste. Leurs infos sont gardées ici et reviennent si vous ajoutez le même nom.",
  "former.lead":
    "Membres vus dans une liste précédente qui ne sont pas dans la plus récente. Leurs infos sont gardées et reviennent s’ils reviennent.",
  "former.none": "Aucun ancien membre pour l’instant.",
  "former.search": "Chercher un ancien membre",
  "former.empty": "Aucun ancien membre trouvé.",
  "former.lastSeen": "Vu pour la dernière fois le {date}",
  "former.more": "Afficher 25 de plus",
  "former.duel": "Alliance Duel, semaine du {date}",
  "shots.newMember": "Nouveau membre : {name}",
  "shots.newHelp":
    "Enregistre pour un nouveau membre qui attend la liste de ce soir. Corrigez le nom si la capture l’a mal lu.",
  "shots.newName": "Nom du nouveau membre dans le jeu",
  "shots.pickInstead": "Choisir plutôt un membre",
  "shots.pendingGroup": "Nouveaux, en attente de la liste",
  "shots.taken": "{name} est déjà dans l’alliance. Le choisir plutôt ?",
  "shots.pickThem": "Choisir",
  "shots.addAnyway": "Ajouter quand même",
  "shots.why.taken":
    "Ligne {row} : ce nom est déjà dans l’alliance. Choisissez ce membre, ou touchez Ajouter quand même.",
};
