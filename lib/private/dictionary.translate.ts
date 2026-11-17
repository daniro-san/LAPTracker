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
  "translate.discord.same": "This message is already in your language.",
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
};

type TranslateWords = Record<keyof typeof translateEn, string>;

export const translatePt: TranslateWords = {
  "translate.discord.noText": "Esta mensagem não tem texto para traduzir.",
  "translate.discord.tooLong":
    "Esta mensagem é longa demais para traduzir: {count} caracteres. O limite é {limit}.",
  "translate.discord.tooMany":
    "Você pode traduzir {limit} mensagens por minuto. Espere um minuto e tente de novo.",
  "translate.discord.same": "Esta mensagem já está no seu idioma.",
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
};

export const translateFr: TranslateWords = {
  "translate.discord.noText": "Ce message n’a pas de texte à traduire.",
  "translate.discord.tooLong":
    "Ce message est trop long pour être traduit : {count} caractères. La limite est de {limit}.",
  "translate.discord.tooMany":
    "Vous pouvez traduire {limit} messages par minute. Attendez une minute et réessayez.",
  "translate.discord.same": "Ce message est déjà dans votre langue.",
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
};
