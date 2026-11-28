// Join requests (issue 868) in English, Brazilian Portuguese and French: the `/join` replies in Discord, the
// leaders' channel note, Members → Requests on the desk, and Alliance settings → Discord → Member role. French
// puts a no-break space before : and ?.
export const joinEn = {
  // Discord: only the person who sent /join sees these.
  "join.discord.sent": "Sent to your officers.",
  "join.discord.empty": "Type your name or ID in the game after /join.",
  "join.discord.limited": "You sent several requests just now. Try again in an hour.",
  // The leaders' channel: only the typed name, never anything else about the person.
  "join.note.title": "Join request",
  "join.note.text":
    "Someone asked to join as “{typed}”. Answer it on the Officers’ Desk, Members → Requests: {link}",
  // Members → Requests.
  "join.view": "Requests",
  "join.lead":
    "People who typed /join in your Discord server. Approve gives them the member role, links their Discord to their player so their own page works at once, and posts the welcome if that post is on. Decline posts nothing. A request closes after 7 days.",
  "join.how":
    "To send one, a player types /join and their name or ID in the game in your Discord server.",
  "join.none": "No requests right now.",
  "join.asked": "{who} asks to join as “{typed}”",
  "join.when": "Sent {day}",
  "join.notInRoster": "Not in the roster yet. Approve once a daily update lists them, or decline.",
  "join.approveAs": "Approve as {player}",
  "join.decline": "Decline",
  "join.approved": "Approved. Their own page is open.",
  "join.declined": "Declined. Nothing was posted.",
  "join.given": "Member role given.",
  "join.giveFailed":
    "Discord did not give the member role. Check that the bot’s role is above it, then give it by hand.",
  "join.noRole": "No member role is chosen in Alliance settings → Discord, so none was given.",
  "join.welcomed": "Welcome posted.",
  "join.welcomeFailed": "The welcome was not posted.",
  "join.gone": "This request changed since you opened the page. Look again.",
  "join.taken": "Another Discord account is already linked to this player.",
  "join.failed": "Could not save. Try again.",
  // Alliance settings → Discord → Member role.
  "join.role.head": "Member role",
  "join.role.lead":
    "When an officer approves a /join request, the bot gives this role. Discord lets the bot give only roles below its own, and only with the Manage Roles permission.",
  "join.role.reinstall":
    "Added the bot before this setting existed? Tap Add LAPTracker to Discord again so it can manage roles.",
  "join.role.set": "Set · @{name}",
  "join.role.unset": "Not set yet. Approved members get no role.",
  "join.role.choose": "Choose a role",
  "join.role.loading": "Asking Discord…",
  "join.role.pick": "Role",
  "join.role.save": "Check and save",
  "join.role.remove": "Remove",
  "join.role.cancel": "Cancel",
  "join.role.saved": "Member role saved.",
  "join.role.removed": "Member role removed.",
  "join.role.empty":
    "No role is below the bot’s role. In Discord: Server Settings → Roles, drag LAPTracker above the member role.",
  "join.role.notBelow": "This role is not below the bot’s role any more. Choose again.",
};

export const joinPt: typeof joinEn = {
  "join.discord.sent": "Enviado aos seus oficiais.",
  "join.discord.empty": "Digite seu nome ou ID no jogo depois de /join.",
  "join.discord.limited": "Você enviou vários pedidos agora há pouco. Tente de novo em uma hora.",
  "join.note.title": "Pedido para entrar",
  "join.note.text":
    "Alguém pediu para entrar como “{typed}”. Responda na Mesa dos oficiais, Membros → Pedidos: {link}",
  "join.view": "Pedidos",
  "join.lead":
    "Pessoas que digitaram /join no servidor do Discord da aliança. Aprovar dá a elas o cargo de membro, liga o Discord delas ao jogador para que a própria página funcione na hora e posta as boas-vindas se esse post estiver ligado. Recusar não posta nada. Um pedido fecha depois de 7 dias.",
  "join.how":
    "Para enviar um, o jogador digita /join e o nome ou ID dele no jogo no servidor do Discord da aliança.",
  "join.none": "Nenhum pedido agora.",
  "join.asked": "{who} pede para entrar como “{typed}”",
  "join.when": "Enviado {day}",
  "join.notInRoster":
    "Ainda não está na lista. Aprove quando uma atualização diária mostrar o jogador, ou recuse.",
  "join.approveAs": "Aprovar como {player}",
  "join.decline": "Recusar",
  "join.approved": "Aprovado. A própria página dele está aberta.",
  "join.declined": "Recusado. Nada foi postado.",
  "join.given": "Cargo de membro dado.",
  "join.giveFailed":
    "O Discord não deu o cargo de membro. Confira se o cargo do bot está acima dele e dê o cargo à mão.",
  "join.noRole":
    "Nenhum cargo de membro foi escolhido em Configurações da aliança → Discord, então nenhum foi dado.",
  "join.welcomed": "Boas-vindas postadas.",
  "join.welcomeFailed": "As boas-vindas não foram postadas.",
  "join.gone": "Este pedido mudou desde que você abriu a página. Veja de novo.",
  "join.taken": "Outra conta do Discord já está ligada a este jogador.",
  "join.failed": "Não foi possível salvar. Tente de novo.",
  "join.role.head": "Cargo de membro",
  "join.role.lead":
    "Quando um oficial aprova um pedido /join, o bot dá este cargo. O Discord só deixa o bot dar cargos abaixo do dele, e só com a permissão Gerenciar cargos.",
  "join.role.reinstall":
    "Adicionou o bot antes desta opção existir? Toque em Adicionar o LAPTracker ao Discord de novo para que ele possa gerenciar cargos.",
  "join.role.set": "Definido · @{name}",
  "join.role.unset": "Ainda não definido. Membros aprovados não ganham cargo.",
  "join.role.choose": "Escolher um cargo",
  "join.role.loading": "Perguntando ao Discord…",
  "join.role.pick": "Cargo",
  "join.role.save": "Verificar e salvar",
  "join.role.remove": "Remover",
  "join.role.cancel": "Cancelar",
  "join.role.saved": "Cargo de membro salvo.",
  "join.role.removed": "Cargo de membro removido.",
  "join.role.empty":
    "Nenhum cargo está abaixo do cargo do bot. No Discord: Configurações do servidor → Cargos, arraste o LAPTracker para cima do cargo de membro.",
  "join.role.notBelow": "Este cargo não está mais abaixo do cargo do bot. Escolha de novo.",
};

export const joinFr: typeof joinEn = {
  "join.discord.sent": "Envoyé à vos officiers.",
  "join.discord.empty": "Tapez votre nom ou ID en jeu après /join.",
  "join.discord.limited":
    "Vous avez envoyé plusieurs demandes à l’instant. Réessayez dans une heure.",
  "join.note.title": "Demande pour rejoindre",
  "join.note.text":
    "Quelqu’un demande à rejoindre sous le nom « {typed} ». Répondez sur le Bureau des officiers, Membres → Demandes : {link}",
  "join.view": "Demandes",
  "join.lead":
    "Les personnes qui ont tapé /join sur le serveur Discord de l’alliance. Accepter leur donne le rôle de membre, relie leur Discord à leur joueur pour que leur propre page marche tout de suite, et publie la bienvenue si cette publication est activée. Refuser ne publie rien. Une demande se ferme après 7 jours.",
  "join.how":
    "Pour en envoyer une, le joueur tape /join et son nom ou ID en jeu sur le serveur Discord de l’alliance.",
  "join.none": "Aucune demande pour l’instant.",
  "join.asked": "{who} demande à rejoindre sous le nom « {typed} »",
  "join.when": "Envoyée {day}",
  "join.notInRoster":
    "Pas encore dans la liste. Acceptez quand une mise à jour quotidienne l’affiche, ou refusez.",
  "join.approveAs": "Accepter comme {player}",
  "join.decline": "Refuser",
  "join.approved": "Acceptée. Sa propre page est ouverte.",
  "join.declined": "Refusée. Rien n’a été publié.",
  "join.given": "Rôle de membre donné.",
  "join.giveFailed":
    "Discord n’a pas donné le rôle de membre. Vérifiez que le rôle du bot est au-dessus, puis donnez-le à la main.",
  "join.noRole":
    "Aucun rôle de membre n’est choisi dans Réglages de l’alliance → Discord, donc aucun n’a été donné.",
  "join.welcomed": "Bienvenue publiée.",
  "join.welcomeFailed": "La bienvenue n’a pas été publiée.",
  "join.gone": "Cette demande a changé depuis l’ouverture de la page. Regardez à nouveau.",
  "join.taken": "Un autre compte Discord est déjà relié à ce joueur.",
  "join.failed": "Impossible d’enregistrer. Réessayez.",
  "join.role.head": "Rôle de membre",
  "join.role.lead":
    "Quand un officier accepte une demande /join, le bot donne ce rôle. Discord ne laisse le bot donner que des rôles sous le sien, et seulement avec la permission Gérer les rôles.",
  "join.role.reinstall":
    "Vous avez ajouté le bot avant ce réglage ? Touchez à nouveau Ajouter LAPTracker à Discord pour qu’il puisse gérer les rôles.",
  "join.role.set": "Choisi · @{name}",
  "join.role.unset": "Pas encore choisi. Les membres acceptés ne reçoivent aucun rôle.",
  "join.role.choose": "Choisir un rôle",
  "join.role.loading": "Question à Discord…",
  "join.role.pick": "Rôle",
  "join.role.save": "Vérifier et enregistrer",
  "join.role.remove": "Retirer",
  "join.role.cancel": "Annuler",
  "join.role.saved": "Rôle de membre enregistré.",
  "join.role.removed": "Rôle de membre retiré.",
  "join.role.empty":
    "Aucun rôle n’est sous le rôle du bot. Sur Discord : Paramètres du serveur → Rôles, glissez LAPTracker au-dessus du rôle de membre.",
  "join.role.notBelow": "Ce rôle n’est plus sous le rôle du bot. Choisissez à nouveau.",
};
