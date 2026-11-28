// Alliance settings → Discord (D129, issue 451) in English and Brazilian Portuguese; French is in
// dictionary.discord-fr.ts. Plain steps an R5 can follow alone. A webhook URL is never shown: only the
// channel name officers gave.
export const discordEn = {
  "discord.head": "Discord",
  "discord.lead":
    "Connect your alliance’s Discord server: the bot, the message commands and the channels for notices. Do the steps in order.",
  "discord.bot.head": "1. Add LAPTracker to your server",
  "discord.bot.lead":
    "The bot can see channels, send messages, open public threads and post in them, and give the member role you choose below. It needs no admin rights.",
  "discord.bot.tip":
    "You need the Manage Server permission in Discord. The link opens on your alliance’s server only.",
  "discord.bot.add": "Add LAPTracker to Discord",
  "discord.check.head": "2. Check the bot and turn on the commands",
  "discord.check.lead":
    "After adding the bot, come back here and tap Check. The commands then show on any message: press and hold it (on a computer, right-click it) → Apps.",
  "discord.check.leadNone": "After adding the bot, come back here and tap Check.",
  "discord.check.button": "Check",
  "discord.check.checking": "Checking with Discord…",
  "discord.check.never": "Not checked yet.",
  "discord.check.seen": "LAPTracker is in your server.",
  "discord.check.commands": "Commands on: {list}.",
  "discord.check.missing":
    "The bot is not in your server yet: tap Add LAPTracker to Discord in step 1 first.",
  "discord.check.unreachable": "Discord did not answer. Try again in a minute.",
  "discord.check.failed":
    "The bot is in your server, but Discord did not take the commands. Try again in a minute.",
  "discord.check.rateLimited": "Too many checks just now. Wait 15 minutes, then try again.",
  "discord.check.off": "The bot is not set up on this site yet. Ask the site’s owner.",
  "discord.private":
    "Only if a channel is private: for the commands to post there, open the channel’s settings → Permissions → add LAPTracker, then allow View Channel, Send Messages, Create Public Threads and Send Messages in Threads.",
  "discord.hooks.head": "3. Channels for notices",
  // Issue 585 (F28): one block when the site's bot is off, and the in-place help's summaries.
  "discord.hooks.headAlone": "Channels for notices",
  "discord.hooks.howSummary": "How to get a webhook URL",
  "discord.privateSummary": "Posting in a private channel?",
  "discord.bot.siteOffHead": "Bot and commands",
  "discord.bot.siteOff":
    "LAPTracker’s Discord bot is off on this site for now, so there is nothing to add or check here. The channels below do not need it: notices and the Raid Shield summary post through their own webhooks.",
  "discord.channel.leadersOnly": "Leaders only",
  "discord.hooks.lead":
    "When you tap Publish to Discord on a notice, leadership notices go to the leaders’ channel and members’ notices to the members’ channel. Each channel needs its own webhook. The Raid Shield check’s summary is posted only to its own channel.",
  "discord.hooks.how":
    "In Discord: open the channel’s settings → Integrations → Webhooks → New Webhook → Copy Webhook URL. Paste it here.",
  "discord.channel.leaders": "Leaders’ channel",
  "discord.channel.members": "Members’ channel",
  "discord.channel.shield": "Raid Shield channel",
  "discord.channel.shieldHelp":
    "For the Raid Shield check’s summary. It names the members without a shield seen, so use a channel that only leaders and officers can see. Without this channel, no summary is posted.",
  "discord.channel.look":
    "Posts show this webhook’s name and picture. Change them in Discord: Server Settings → Integrations → Webhooks.",
  "discord.hook.set": "Set · #{name}",
  "discord.hook.site":
    "Using a channel the site set up (#{name}). Add your alliance’s own webhook to post to your channel instead.",
  "discord.hook.none": "Not set yet.",
  "discord.hook.noneShield": "Not set yet. No Raid Shield summary is posted until you set one.",
  "discord.hook.reenter":
    "This webhook needs to be pasted again. The site’s security setting changed, so the saved one can no longer be read.",
  "discord.hook.url": "Webhook URL",
  "discord.hook.urlHelp":
    "It starts with https://discord.com/api/webhooks/. It is stored encrypted and never shown again.",
  "discord.hook.name": "Channel name",
  "discord.hook.nameHelp":
    "As Discord shows it, without the #. Example: notices. Officers see it before posting.",
  "discord.hook.nameHelpShield": "As Discord shows it, without the #. Example: raid-shield.",
  "discord.hook.forum": "This is a forum channel",
  "discord.hook.forumHelp": "Then each notice opens its own post in the forum.",
  "discord.hook.forumHelpShield": "Then each week’s summary opens its own post in the forum.",
  "discord.hook.save": "Check and save",
  "discord.hook.saving": "Checking with Discord…",
  "discord.hook.add": "Add a webhook",
  "discord.hook.replace": "Replace",
  "discord.hook.remove": "Remove",
  "discord.hook.cancel": "Cancel",
  "discord.hook.test": "Send a test message",
  "discord.hook.testing": "Sending…",
  "discord.hook.tested": "Test message sent. Look in the channel.",
  "discord.hook.saved": "Webhook saved.",
  "discord.hook.removed": "Webhook removed.",
  "discord.hook.removeAsk": "Remove this channel’s webhook?",
  "discord.hook.removeMore": "Publish to Discord stops posting to this channel.",
  "discord.hook.removeMoreShield": "The Raid Shield summary is no longer posted.",
  "discord.hook.keep": "Keep it",
  "discord.hook.bad":
    "This is not a Discord webhook URL. Copy it again from the channel’s Integrations → Webhooks.",
  "discord.hook.refused":
    "Discord does not know this webhook. It may have been deleted. Copy it again.",
  "discord.hook.wrongServer":
    "This webhook belongs to another Discord server. Use a channel of your alliance’s server.",
  "discord.hook.unreachable": "Discord did not answer. Try again in a minute.",
  "discord.hook.rateLimited": "Too many tries just now. Wait 15 minutes, then try again.",
  "discord.hook.off": "Saving webhooks is not set up on this site yet. Ask the site’s owner.",
  "discord.hook.failed": "Could not save. Try again.",
  "discord.hook.testFailed":
    "Discord did not take the test message. Check that the webhook still exists.",
  "discord.hook.notSetUp": "No webhook is set for this channel.",
  "discord.test.title": "LAPTracker test",
  "discord.test.leaders":
    "LAPTracker can post here. Leadership notices from the Officers’ Desk will come to this channel.",
  "discord.test.members":
    "LAPTracker can post here. Members’ notices from the Officers’ Desk will come to this channel.",
  "discord.test.shield":
    "LAPTracker can post here. The Raid Shield check’s summary from the Officers’ Desk will come to this channel.",
};

export const discordPt: typeof discordEn = {
  "discord.head": "Discord",
  "discord.lead":
    "Conecte o servidor do Discord da sua aliança: o bot, os comandos de mensagem e os canais dos avisos. Siga os passos na ordem.",
  "discord.bot.head": "1. Adicione o LAPTracker ao seu servidor",
  "discord.bot.lead":
    "O bot pode ver canais, enviar mensagens, abrir tópicos públicos e postar neles, e dar o cargo de membro que você escolher abaixo. Ele não precisa de permissão de administrador.",
  "discord.bot.tip":
    "Você precisa da permissão Gerenciar servidor no Discord. O link abre só no servidor da sua aliança.",
  "discord.bot.add": "Adicionar o LAPTracker ao Discord",
  "discord.check.head": "2. Confira o bot e ligue os comandos",
  "discord.check.lead":
    "Depois de adicionar o bot, volte aqui e toque em Conferir. Os comandos aparecem em qualquer mensagem: toque e segure nela (no computador, clique com o botão direito) → Apps.",
  "discord.check.leadNone": "Depois de adicionar o bot, volte aqui e toque em Conferir.",
  "discord.check.button": "Conferir",
  "discord.check.checking": "Conferindo com o Discord…",
  "discord.check.never": "Ainda não conferido.",
  "discord.check.seen": "O LAPTracker está no seu servidor.",
  "discord.check.commands": "Comandos ligados: {list}.",
  "discord.check.missing":
    "O bot ainda não está no seu servidor: toque antes em Adicionar o LAPTracker ao Discord, no passo 1.",
  "discord.check.unreachable": "O Discord não respondeu. Tente de novo em um minuto.",
  "discord.check.failed":
    "O bot está no seu servidor, mas o Discord não aceitou os comandos. Tente de novo em um minuto.",
  "discord.check.rateLimited": "Muitas conferências agora. Espere 15 minutos e tente de novo.",
  "discord.check.off": "O bot ainda não está configurado neste site. Fale com o dono do site.",
  "discord.private":
    "Só se um canal for privado: para os comandos postarem nele, abra as configurações do canal → Permissões → adicione o LAPTracker e permita Ver canal, Enviar mensagens, Criar tópicos públicos e Enviar mensagens em tópicos.",
  "discord.hooks.head": "3. Canais dos avisos",
  "discord.hooks.headAlone": "Canais dos avisos",
  "discord.hooks.howSummary": "Como pegar a URL do webhook",
  "discord.privateSummary": "Vai postar num canal privado?",
  "discord.bot.siteOffHead": "Bot e comandos",
  "discord.bot.siteOff":
    "O bot do LAPTracker no Discord está desligado neste site por enquanto, então não há nada para adicionar ou conferir aqui. Os canais abaixo não precisam dele: os avisos e o resumo do Escudo de raid são postados pelos próprios webhooks.",
  "discord.channel.leadersOnly": "Só liderança",
  "discord.hooks.lead":
    "Quando você toca em Publicar no Discord num aviso, os avisos da liderança vão para o canal dos líderes e os avisos dos membros para o canal dos membros. Cada canal precisa do seu próprio webhook. O resumo da conferência do Escudo de raid é postado só no seu próprio canal.",
  "discord.hooks.how":
    "No Discord: abra as configurações do canal → Integrações → Webhooks → Novo webhook → Copiar URL do webhook. Cole aqui.",
  "discord.channel.leaders": "Canal dos líderes",
  "discord.channel.members": "Canal dos membros",
  "discord.channel.shield": "Canal do Escudo de raid",
  "discord.channel.shieldHelp":
    "Para o resumo da conferência do Escudo de raid. Ele cita os membros sem escudo visto, então use um canal que só os líderes e os oficiais veem. Sem este canal, nenhum resumo é postado.",
  "discord.channel.look":
    "As postagens mostram o nome e a imagem deste webhook. Mude-os no Discord: Configurações do servidor → Integrações → Webhooks.",
  "discord.hook.set": "Configurado · #{name}",
  "discord.hook.site":
    "Usando um canal configurado pelo site (#{name}). Adicione o webhook da sua aliança para postar no seu canal.",
  "discord.hook.none": "Ainda não configurado.",
  "discord.hook.noneShield":
    "Ainda não configurado. Nenhum resumo do Escudo de raid é postado até você configurar um.",
  "discord.hook.reenter":
    "Este webhook precisa ser colado de novo. A configuração de segurança do site mudou, então o salvo não pode mais ser lido.",
  "discord.hook.url": "URL do webhook",
  "discord.hook.urlHelp":
    "Começa com https://discord.com/api/webhooks/. Fica guardado criptografado e nunca é mostrado de novo.",
  "discord.hook.name": "Nome do canal",
  "discord.hook.nameHelp":
    "Como o Discord mostra, sem o #. Exemplo: avisos. Os oficiais veem o nome antes de postar.",
  "discord.hook.nameHelpShield": "Como o Discord mostra, sem o #. Exemplo: escudo-raid.",
  "discord.hook.forum": "Este é um canal de fórum",
  "discord.hook.forumHelp": "Assim cada aviso abre a sua própria postagem no fórum.",
  "discord.hook.forumHelpShield":
    "Assim o resumo de cada semana abre a sua própria postagem no fórum.",
  "discord.hook.save": "Conferir e salvar",
  "discord.hook.saving": "Conferindo com o Discord…",
  "discord.hook.add": "Adicionar um webhook",
  "discord.hook.replace": "Trocar",
  "discord.hook.remove": "Remover",
  "discord.hook.cancel": "Cancelar",
  "discord.hook.test": "Enviar uma mensagem de teste",
  "discord.hook.testing": "Enviando…",
  "discord.hook.tested": "Mensagem de teste enviada. Veja no canal.",
  "discord.hook.saved": "Webhook salvo.",
  "discord.hook.removed": "Webhook removido.",
  "discord.hook.removeAsk": "Remover o webhook deste canal?",
  "discord.hook.removeMore": "Publicar no Discord deixa de postar neste canal.",
  "discord.hook.removeMoreShield": "O resumo do Escudo de raid deixa de ser postado.",
  "discord.hook.keep": "Manter",
  "discord.hook.bad":
    "Isto não é uma URL de webhook do Discord. Copie de novo em Integrações → Webhooks do canal.",
  "discord.hook.refused":
    "O Discord não conhece este webhook. Talvez ele tenha sido apagado. Copie de novo.",
  "discord.hook.wrongServer":
    "Este webhook é de outro servidor do Discord. Use um canal do servidor da sua aliança.",
  "discord.hook.unreachable": "O Discord não respondeu. Tente de novo em um minuto.",
  "discord.hook.rateLimited": "Muitas tentativas agora. Espere 15 minutos e tente de novo.",
  "discord.hook.off":
    "Salvar webhooks ainda não está configurado neste site. Fale com o dono do site.",
  "discord.hook.failed": "Não foi possível salvar. Tente de novo.",
  "discord.hook.testFailed":
    "O Discord não aceitou a mensagem de teste. Confira se o webhook ainda existe.",
  "discord.hook.notSetUp": "Nenhum webhook configurado para este canal.",
  "discord.test.title": "Teste do LAPTracker",
  "discord.test.leaders":
    "O LAPTracker pode postar aqui. Os avisos da liderança da Mesa dos oficiais vão chegar neste canal.",
  "discord.test.members":
    "O LAPTracker pode postar aqui. Os avisos para os membros da Mesa dos oficiais vão chegar neste canal.",
  "discord.test.shield":
    "O LAPTracker pode postar aqui. O resumo da conferência do Escudo de raid da Mesa dos oficiais vai chegar neste canal.",
};
