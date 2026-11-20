// A new alliance's pages (D130, issue 453) in English and Brazilian Portuguese; French is in
// dictionary.invite-fr.ts. The invite (/w/invite): four plain steps an R5 can follow alone, each with a tip.
// "Request a Desk" (/w/request): the form and its answer. Role names keep the alliance's own tag.
export const inviteEn = {
  "invite.title": "Set up your Officers’ Desk",
  "invite.lead":
    "For {alliance}. Four short steps, about 5 minutes. You need to own your alliance’s Discord server, or have Manage Server there.",
  "invite.expires": "This link works once, until {date}.",
  "invite.none.title": "Invite link",
  "invite.none.text":
    "Open the invite link you were sent. It starts with this site’s address and works once.",
  "invite.e.link":
    "This link does not work. It may be cut short, or a newer link replaced it. Ask the person who sent it for a new one.",
  "invite.e.denied": "Discord did not confirm the sign-in. Try again.",
  "invite.e.discord": "Discord did not answer. Try again in a minute.",
  "invite.e.claimed":
    "Someone else already set up this Desk with this link. Ask the person who sent it for a new one.",
  "invite.e.not_configured": "Sign-in is not set up on this site yet. Ask the site’s owner.",
  "invite.used.mine": "Your Officers’ Desk is ready.",
  "invite.used.open": "Open the Officers’ Desk",
  "invite.used.other":
    "This invite link was already used. If your alliance’s Desk is set up, ask your leadership for its address.",
  "invite.expired": "This invite link has expired. Ask the site’s owner for a new one.",
  "invite.cancelled": "This invite link was cancelled. Ask the site’s owner for a new one.",
  "invite.done": "Done",
  "invite.signin.head": "1. Sign in with Discord",
  "invite.signin.tip":
    "Use the Discord account that owns your alliance’s server. Discord shows us your name and your list of servers. Nothing is posted.",
  "invite.signin.button": "Sign in with Discord",
  "invite.signin.as": "Signed in as {name}.",
  "invite.signin.other": "Use another account",
  "invite.server.head": "2. Pick your alliance’s server",
  "invite.server.tip": "Only servers you own or can manage are listed.",
  "invite.server.none":
    "None of your servers can be picked: you don’t own any, or don’t have Manage Server in any. Sign in with the account that owns your alliance’s server.",
  "invite.server.taken": "Already has a Desk",
  "invite.server.picked": "Server: {name}",
  "invite.server.change": "Change",
  "invite.server.save": "Use this server",
  "invite.bot.head": "3. Add LAPTracker to the server",
  "invite.bot.tip":
    "LAPTracker can see channels, send messages and open threads. It needs no admin rights. Pick Authorize on Discord’s page, then come back here.",
  "invite.bot.add": "Add LAPTracker to Discord",
  "invite.bot.continue": "I added it: continue",
  "invite.bot.checking": "Checking with Discord…",
  "invite.bot.in": "LAPTracker is in your server.",
  "invite.roles.head": "4. Choose who gets in",
  "invite.roles.leaders": "Leadership: who opens the Officers’ Desk",
  "invite.roles.leadersHelp":
    "Pick one or more. Usually your R5 and R4 roles, not the members’ role.",
  "invite.roles.members": "Members: who sees the members’ board (optional)",
  "invite.roles.membersHelp":
    "Without a member role, the members’ board stays closed. You can add it later.",
  "invite.roles.none": "Your server has no roles yet. Create them below.",
  "invite.roles.reload": "Reload the roles",
  "invite.roles.assign":
    "To give a role in Discord: Server Settings → Members → the person → the + under their name.",
  "invite.create.head": "No roles for this yet? Create them here",
  "invite.create.lead":
    "LAPTracker creates two roles with no permissions of their own. First allow it to create roles: this asks Discord once more, for this server only.",
  "invite.create.allow": "Allow LAPTracker to create roles",
  "invite.create.leader": "Leadership role name",
  "invite.create.member": "Member role name",
  "invite.create.giveMe": "Give me the leadership role",
  "invite.create.button": "Create the roles",
  "invite.create.creating": "Creating…",
  "invite.create.made": "Created: {list}. They are picked above.",
  "invite.create.gaveRefused":
    "LAPTracker could not give you the role: its own role is lower than that role in Discord’s list. You still get in through this invite. Give yourself the role in Discord later.",
  "invite.create.noPermission":
    "Discord said no: LAPTracker may not create roles yet. Tap Allow LAPTracker to create roles first. Or create the roles in Discord, then tap Reload the roles.",
  "invite.finish.button": "Open our Officers’ Desk",
  "invite.finish.creating": "Setting up…",
  "invite.finish.note":
    "You get in through this invite, even without the role. Everything else (the bot’s commands, the channels for notices) is in Alliance settings.",
  "invite.finish.pick": "Pick at least one leadership role first.",
  "invite.err.bot_missing":
    "LAPTracker is not in your server yet. Tap Add LAPTracker to Discord, pick Authorize, then tap I added it: continue.",
  "invite.err.taken": "This server already has a Desk. Pick your alliance’s own server.",
  "invite.err.has_desk":
    "Your alliance already has an Officers’ Desk. Ask your leadership for its address.",
  "invite.err.closed": "This invite link no longer works. Reload the page.",
  "invite.err.signed_out": "Your sign-in ended. Tap Sign in with Discord again.",
  "invite.err.rate_limited": "Too many tries just now. Wait 15 minutes, then try again.",
  "invite.err.bot_off": "The bot is not set up on this site yet. Ask the site’s owner.",
  "invite.err.bad_role": "The roles changed in Discord. Tap Reload the roles, then pick again.",
  "invite.err.failed": "Something went wrong. Try again in a minute.",
  "request.title": "Request an Officers’ Desk",
  "request.lead":
    "A private place for your alliance’s leadership: members, roll calls, notices and the calendar. It is free. The site’s owner reads each request.",
  "request.alliance": "Your alliance",
  "request.name": "Your name in the game",
  "request.nameHelp": "As the game shows it, so the owner can find you in your alliance.",
  "request.leader": "I’m the alliance leader (R5) or an R4",
  "request.rank": "Your rank",
  "request.r5": "R5 (leader)",
  "request.r4": "R4",
  "request.onlyLeaders":
    "A Desk is requested by the alliance’s leadership. Ask your R5 or an R4 to send this.",
  "request.send": "Send the request",
  "request.sending": "Sending…",
  "request.keep": "We keep only your alliance, your name in the game and your rank.",
  "request.err.has_desk":
    "Your alliance already has an Officers’ Desk. Ask your leadership for its address.",
  "request.err.rate_limited": "Too many requests from here today. Try again tomorrow.",
  "request.err.failed": "Could not send. Try again in a minute.",
  "request.e.link":
    "This link does not work. It may be cut short. Open the link you saved when you sent the request.",
  "request.waiting.title": "Request sent",
  "request.waiting.text":
    "Thank you. The site’s owner will look at the request for {alliance} from {name}. Come back to this page to see the answer.",
  "request.waiting.keep":
    "Save this link. It is the only way to see the answer later, on any phone or computer:",
  "request.copy": "Copy the link",
  "request.copied": "Copied.",
  "request.approved.title": "Approved",
  "request.approved.text":
    "Your request for {alliance} was approved. Set up your alliance’s Officers’ Desk now: four short steps.",
  "request.approved.button": "Continue",
  "request.declined.title": "Not approved",
  "request.declined.text": "Your request for {alliance} was not approved.",
  "request.declined.reason": "The site’s owner wrote: {reason}",
};

export const invitePt: typeof inviteEn = {
  "invite.title": "Monte a sua Mesa dos oficiais",
  "invite.lead":
    "Para {alliance}. Quatro passos curtos, uns 5 minutos. Você precisa ser dono do servidor do Discord da aliança, ou ter Gerenciar servidor nele.",
  "invite.expires": "Este link funciona uma vez, até {date}.",
  "invite.none.title": "Link de convite",
  "invite.none.text":
    "Abra o link de convite que você recebeu. Ele começa com o endereço deste site e funciona uma vez.",
  "invite.e.link":
    "Este link não funciona. Pode estar cortado, ou um link mais novo o substituiu. Peça um novo a quem o enviou.",
  "invite.e.denied": "O Discord não confirmou a entrada. Tente de novo.",
  "invite.e.discord": "O Discord não respondeu. Tente de novo em um minuto.",
  "invite.e.claimed":
    "Outra pessoa já montou esta Mesa com este link. Peça um novo a quem o enviou.",
  "invite.e.not_configured":
    "A entrada ainda não está configurada neste site. Fale com o dono do site.",
  "invite.used.mine": "A sua Mesa dos oficiais está pronta.",
  "invite.used.open": "Abrir a Mesa dos oficiais",
  "invite.used.other":
    "Este link de convite já foi usado. Se a Mesa da sua aliança já existe, peça o endereço à liderança.",
  "invite.expired": "Este link de convite expirou. Peça um novo ao dono do site.",
  "invite.cancelled": "Este link de convite foi cancelado. Peça um novo ao dono do site.",
  "invite.done": "Feito",
  "invite.signin.head": "1. Entre com o Discord",
  "invite.signin.tip":
    "Use a conta do Discord que é dona do servidor da aliança. O Discord nos mostra o seu nome e a sua lista de servidores. Nada é postado.",
  "invite.signin.button": "Entrar com o Discord",
  "invite.signin.as": "Entrou como {name}.",
  "invite.signin.other": "Usar outra conta",
  "invite.server.head": "2. Escolha o servidor da aliança",
  "invite.server.tip": "Só aparecem os servidores de que você é dono ou que pode gerenciar.",
  "invite.server.none":
    "Nenhum dos seus servidores pode ser escolhido: você não é dono de nenhum, nem tem Gerenciar servidor em nenhum. Entre com a conta que é dona do servidor da aliança.",
  "invite.server.taken": "Já tem uma Mesa",
  "invite.server.picked": "Servidor: {name}",
  "invite.server.change": "Trocar",
  "invite.server.save": "Usar este servidor",
  "invite.bot.head": "3. Adicione o LAPTracker ao servidor",
  "invite.bot.tip":
    "O LAPTracker pode ver canais, enviar mensagens e abrir tópicos. Não precisa de direitos de administrador. Toque em Autorizar na página do Discord e depois volte aqui.",
  "invite.bot.add": "Adicionar o LAPTracker ao Discord",
  "invite.bot.continue": "Já adicionei: continuar",
  "invite.bot.checking": "Verificando com o Discord…",
  "invite.bot.in": "O LAPTracker está no seu servidor.",
  "invite.roles.head": "4. Escolha quem entra",
  "invite.roles.leaders": "Liderança: quem abre a Mesa dos oficiais",
  "invite.roles.leadersHelp":
    "Escolha um ou mais. Normalmente o cargo de R5 e o de R4, não o dos membros.",
  "invite.roles.members": "Membros: quem vê o mural dos membros (opcional)",
  "invite.roles.membersHelp":
    "Sem um cargo de membro, o mural dos membros fica fechado. Dá para adicionar depois.",
  "invite.roles.none": "O seu servidor ainda não tem cargos. Crie-os abaixo.",
  "invite.roles.reload": "Recarregar os cargos",
  "invite.roles.assign":
    "Para dar um cargo no Discord: Configurações do servidor → Membros → a pessoa → o + abaixo do nome.",
  "invite.create.head": "Ainda não tem cargos para isso? Crie aqui",
  "invite.create.lead":
    "O LAPTracker cria dois cargos sem nenhuma permissão própria. Primeiro permita que ele crie cargos: o Discord pergunta mais uma vez, só para este servidor.",
  "invite.create.allow": "Permitir que o LAPTracker crie cargos",
  "invite.create.leader": "Nome do cargo da liderança",
  "invite.create.member": "Nome do cargo dos membros",
  "invite.create.giveMe": "Me dar o cargo da liderança",
  "invite.create.button": "Criar os cargos",
  "invite.create.creating": "Criando…",
  "invite.create.made": "Criados: {list}. Já estão marcados acima.",
  "invite.create.gaveRefused":
    "O LAPTracker não conseguiu dar o cargo a você: o cargo dele está abaixo desse cargo na lista do Discord. Você entra mesmo assim por este convite. Depois, dê o cargo para a sua conta no Discord.",
  "invite.create.noPermission":
    "O Discord recusou: o LAPTracker ainda não pode criar cargos. Toque primeiro em Permitir que o LAPTracker crie cargos. Ou crie os cargos no Discord e toque em Recarregar os cargos.",
  "invite.finish.button": "Abrir a nossa Mesa dos oficiais",
  "invite.finish.creating": "Montando…",
  "invite.finish.note":
    "Você entra por este convite, mesmo sem o cargo. O resto (os comandos do bot, os canais dos avisos) fica nas Configurações da aliança.",
  "invite.finish.pick": "Escolha antes pelo menos um cargo da liderança.",
  "invite.err.bot_missing":
    "O LAPTracker ainda não está no seu servidor. Toque em Adicionar o LAPTracker ao Discord, escolha Autorizar e depois toque em Já adicionei: continuar.",
  "invite.err.taken": "Este servidor já tem uma Mesa. Escolha o servidor da sua aliança.",
  "invite.err.has_desk": "A sua aliança já tem uma Mesa dos oficiais. Peça o endereço à liderança.",
  "invite.err.closed": "Este link de convite não funciona mais. Recarregue a página.",
  "invite.err.signed_out": "A sua entrada terminou. Toque de novo em Entrar com o Discord.",
  "invite.err.rate_limited": "Tentativas demais agora. Espere 15 minutos e tente de novo.",
  "invite.err.bot_off": "O bot ainda não está configurado neste site. Fale com o dono do site.",
  "invite.err.bad_role":
    "Os cargos mudaram no Discord. Toque em Recarregar os cargos e escolha de novo.",
  "invite.err.failed": "Algo deu errado. Tente de novo em um minuto.",
  "request.title": "Pedir uma Mesa dos oficiais",
  "request.lead":
    "Um lugar privado para a liderança da sua aliança: membros, chamadas, avisos e o calendário. É grátis. O dono do site lê cada pedido.",
  "request.alliance": "A sua aliança",
  "request.name": "O seu nome no jogo",
  "request.nameHelp": "Como aparece no jogo, para o dono achar você na sua aliança.",
  "request.leader": "Sou o líder da aliança (R5) ou um R4",
  "request.rank": "O seu posto",
  "request.r5": "R5 (líder)",
  "request.r4": "R4",
  "request.onlyLeaders":
    "Quem pede uma Mesa é a liderança da aliança. Peça ao seu R5 ou a um R4 para enviar.",
  "request.send": "Enviar o pedido",
  "request.sending": "Enviando…",
  "request.keep": "Guardamos só a sua aliança, o seu nome no jogo e o seu posto.",
  "request.err.has_desk":
    "A sua aliança já tem uma Mesa dos oficiais. Peça o endereço à liderança.",
  "request.err.rate_limited": "Pedidos demais daqui hoje. Tente de novo amanhã.",
  "request.err.failed": "Não deu para enviar. Tente de novo em um minuto.",
  "request.e.link":
    "Este link não funciona. Pode estar cortado. Abra o link que você guardou ao enviar o pedido.",
  "request.waiting.title": "Pedido enviado",
  "request.waiting.text":
    "Obrigado. O dono do site vai olhar o pedido de {name} para {alliance}. Volte a esta página para ver a resposta.",
  "request.waiting.keep":
    "Guarde este link. É o único jeito de ver a resposta depois, em qualquer celular ou computador:",
  "request.copy": "Copiar o link",
  "request.copied": "Copiado.",
  "request.approved.title": "Aprovado",
  "request.approved.text":
    "O seu pedido para {alliance} foi aprovado. Monte agora a Mesa dos oficiais da aliança: quatro passos curtos.",
  "request.approved.button": "Continuar",
  "request.declined.title": "Não aprovado",
  "request.declined.text": "O seu pedido para {alliance} não foi aprovado.",
  "request.declined.reason": "O dono do site escreveu: {reason}",
};
