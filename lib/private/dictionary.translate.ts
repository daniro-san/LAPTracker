// The Discord Translate commands' replies (D101) in English, Brazilian Portuguese and French: one module
// that the three workspace dictionaries spread. The replies reuse the notices' translator lines where they
// say the same thing ("busy", "took too long", "partly untranslated") and the import's "no desk" line.
// French puts a no-break space before : ; ! and ?.
export const translateEn = {
  "translate.discord.noText": "This message has no text to translate.",
  "translate.discord.tooLong":
    "This message is too long to translate: {count} characters. The limit is {limit}.",
  "translate.discord.tooMany":
    "You can translate {limit} messages a minute. Wait a minute and try again.",
  "translate.discord.already": "Already in English. Translate to:",
  "translate.discord.other": "Other language:",
  "translate.discord.off": "Translate isn’t available yet. Ask the site owner.",
  "translate.discord.failed": "The translator did not answer this time. Try again in a minute.",
  "translate.discord.choose":
    "Choose the languages and where to post, then press Post. Everyone in the channel will see it.",
  "translate.discord.chooseChannel":
    "Choose the languages, then press Post. It is posted in the channel for everyone.",
  "translate.discord.noBot": "Threads need the bot. See /admin.",
  "translate.discord.languages": "Languages",
  "translate.discord.inThread": "In a thread",
  "translate.discord.inChannel": "In the channel",
  "translate.discord.post": "Post",
  "translate.discord.working": "Translating…",
  "translate.discord.thread": "Translation",
  "translate.discord.postedThread": "Posted in the message’s thread.",
  "translate.discord.posted": "Posted in the channel.",
  "translate.discord.noThread": "Posted in the channel: the bot can’t open threads here.",
  "translate.discord.nothing": "Nothing to post: the message is already in the chosen languages.",
  "translate.discord.notYours": "Only the person who opened this menu can use it.",
  "translate.discord.chooseThread":
    "Choose the languages, then press Post. It is posted in a thread on the message, for everyone.",
  "translate.discord.cantPost": "You can’t post in this channel.",
  "translate.discord.paused": "Translations are paused for today. Try again tomorrow.",
  "translate.discord.askedBy": "Asked by {user}",
  "translate.discord.inThreadList": "Posted in the thread: {languages}.",
  "translate.discord.restInChannel":
    "The bot could not post the rest in the thread. In the channel: {languages}.",
  "translate.discord.threadStopped":
    "The bot could not post in the thread, so it was posted in the channel.",
  "translate.discord.missing": "Not translated: {languages}.",
};

type TranslateWords = Record<keyof typeof translateEn, string>;

export const translatePt: TranslateWords = {
  "translate.discord.noText": "Esta mensagem não tem texto para traduzir.",
  "translate.discord.tooLong":
    "Esta mensagem é longa demais para traduzir: {count} caracteres. O limite é {limit}.",
  "translate.discord.tooMany":
    "Você pode traduzir {limit} mensagens por minuto. Espere um minuto e tente de novo.",
  "translate.discord.already": "Já está em português. Traduzir para:",
  "translate.discord.other": "Outro idioma:",
  "translate.discord.off": "Traduzir ainda não está disponível. Peça ao dono do site.",
  "translate.discord.failed": "O tradutor não respondeu desta vez. Tente de novo em um minuto.",
  "translate.discord.choose":
    "Escolha os idiomas e onde publicar, depois toque em Publicar. Todos no canal vão ver.",
  "translate.discord.chooseChannel":
    "Escolha os idiomas, depois toque em Publicar. A tradução sai no canal para todos.",
  "translate.discord.noBot": "Tópicos precisam do bot. Veja /admin.",
  "translate.discord.languages": "Idiomas",
  "translate.discord.inThread": "Num tópico",
  "translate.discord.inChannel": "No canal",
  "translate.discord.post": "Publicar",
  "translate.discord.working": "Traduzindo…",
  "translate.discord.thread": "Tradução",
  "translate.discord.postedThread": "Publicado no tópico da mensagem.",
  "translate.discord.posted": "Publicado no canal.",
  "translate.discord.noThread": "Publicado no canal: o bot não pode abrir tópicos aqui.",
  "translate.discord.nothing": "Nada para publicar: a mensagem já está nos idiomas escolhidos.",
  "translate.discord.notYours": "Só quem abriu este menu pode usá-lo.",
  "translate.discord.chooseThread":
    "Escolha os idiomas, depois toque em Publicar. A tradução sai num tópico da mensagem, para todos.",
  "translate.discord.cantPost": "Você não pode publicar neste canal.",
  "translate.discord.paused": "As traduções estão pausadas por hoje. Tente de novo amanhã.",
  "translate.discord.askedBy": "Pedido por {user}",
  "translate.discord.inThreadList": "Publicado no tópico: {languages}.",
  "translate.discord.restInChannel":
    "O bot não conseguiu publicar o resto no tópico. No canal: {languages}.",
  "translate.discord.threadStopped":
    "O bot não conseguiu publicar no tópico, então a tradução saiu no canal.",
  "translate.discord.missing": "Sem tradução: {languages}.",
};

export const translateFr: TranslateWords = {
  "translate.discord.noText": "Ce message n’a pas de texte à traduire.",
  "translate.discord.tooLong":
    "Ce message est trop long pour être traduit : {count} caractères. La limite est de {limit}.",
  "translate.discord.tooMany":
    "Vous pouvez traduire {limit} messages par minute. Attendez une minute et réessayez.",
  "translate.discord.already": "Déjà en français. Traduire en :",
  "translate.discord.other": "Autre langue :",
  "translate.discord.off":
    "Traduire n’est pas encore disponible. Demandez au propriétaire du site.",
  "translate.discord.failed":
    "Le traducteur n’a pas répondu cette fois. Réessayez dans une minute.",
  "translate.discord.choose":
    "Choisissez les langues et où publier, puis appuyez sur Publier. Tout le salon le verra.",
  "translate.discord.chooseChannel":
    "Choisissez les langues, puis appuyez sur Publier. La traduction est publiée dans le salon pour tous.",
  "translate.discord.noBot": "Les fils ont besoin du bot. Voir /admin.",
  "translate.discord.languages": "Langues",
  "translate.discord.inThread": "Dans un fil",
  "translate.discord.inChannel": "Dans le salon",
  "translate.discord.post": "Publier",
  "translate.discord.working": "Traduction…",
  "translate.discord.thread": "Traduction",
  "translate.discord.postedThread": "Publié dans le fil du message.",
  "translate.discord.posted": "Publié dans le salon.",
  "translate.discord.noThread": "Publié dans le salon : le bot ne peut pas ouvrir de fils ici.",
  "translate.discord.nothing": "Rien à publier : le message est déjà dans les langues choisies.",
  "translate.discord.notYours": "Seule la personne qui a ouvert ce menu peut l’utiliser.",
  "translate.discord.chooseThread":
    "Choisissez les langues, puis appuyez sur Publier. La traduction est publiée dans un fil du message, pour tous.",
  "translate.discord.cantPost": "Vous ne pouvez pas publier dans ce salon.",
  "translate.discord.paused": "Les traductions sont en pause pour aujourd’hui. Réessayez demain.",
  "translate.discord.askedBy": "Demandé par {user}",
  "translate.discord.inThreadList": "Publié dans le fil : {languages}.",
  "translate.discord.restInChannel":
    "Le bot n’a pas pu publier le reste dans le fil. Dans le salon : {languages}.",
  "translate.discord.threadStopped":
    "Le bot n’a pas pu publier dans le fil, la traduction est donc publiée dans le salon.",
  "translate.discord.missing": "Non traduit : {languages}.",
};
