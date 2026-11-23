// Alliance settings → Posts (#713 part C, D159): the catalog of posts LAPTracker makes on its own, and post 1's
// own words (its title and what it holds), in English, Brazilian Portuguese and French: one module the
// settings dictionaries spread. The post itself takes its title and the calendar's words in the language
// officers pick for it. French puts a no-break space before : and inside « ».
export const postsEn = {
  "posts.head": "Posts",
  "posts.lead":
    "Posts LAPTracker can make for you on its own, on a set day. Each one is off until you turn it on. They name no one and ping no one.",
  "posts.week.name": "This week in the alliance",
  "posts.week.what":
    "The week’s calendar entries marked “Members can see this”, with their times in server time (ST). No names, notes or links. Nothing is posted in a week with none.",
  "posts.week.defaultTitle": "This week in the alliance",
  "posts.turnOn": "Post it",
  "posts.channel": "Channel",
  "posts.channel.members": "Members’ channel",
  "posts.channel.leaders": "Leaders’ channel",
  "posts.channel.notSet": "{channel} (not set up)",
  "posts.day": "Day",
  "posts.day.fixed": "Every {day}: the calendar week starts then.",
  "posts.title": "Title",
  "posts.titleHelp": "Leave it empty for “{title}”.",
  "posts.titleCount": "{n} of 80 characters",
  "posts.titleTooLong": "Too long: keep it to 80 characters.",
  "posts.language": "Language of the post",
  "posts.preview": "Next post",
  "posts.when": "Every {day}, between {from} and {to} ST, in #{channel}.",
  "posts.off": "Off: nothing is posted.",
  "posts.noChannel":
    "Nothing is posted until the {channel} is set up: paste its webhook under Discord, above.",
  "posts.failed": "That didn’t save. Try again.",
  "posts.rateLimited": "Too many saves just now. Wait 15 minutes, then try again.",
  "settings.state.posts": "{on} of {n} on",
  "callouts.post.week": "This week in the alliance",
  "callouts.where.week": "Goes above the week’s calendar post, on Monday.",
  "activity.callout.week": "{who} changed the line on “This week in the alliance”",
};

export const postsPt: typeof postsEn = {
  "posts.head": "Posts",
  "posts.lead":
    "Posts que o LAPTracker pode fazer por vocês sozinho, num dia fixo. Cada um fica desligado até vocês ligarem. Eles não citam nem marcam ninguém.",
  "posts.week.name": "Esta semana na aliança",
  "posts.week.what":
    "Os eventos da semana no calendário marcados “Os membros podem ver isto”, com os horários do servidor (ST). Sem nomes, notas ou links. Nada sai numa semana sem nenhum.",
  "posts.week.defaultTitle": "Esta semana na aliança",
  "posts.turnOn": "Postar",
  "posts.channel": "Canal",
  "posts.channel.members": "Canal dos membros",
  "posts.channel.leaders": "Canal dos líderes",
  "posts.channel.notSet": "{channel} (não configurado)",
  "posts.day": "Dia",
  "posts.day.fixed": "Toda {day}: é quando a semana do calendário começa.",
  "posts.title": "Título",
  "posts.titleHelp": "Deixe vazio para “{title}”.",
  "posts.titleCount": "{n} de 80 caracteres",
  "posts.titleTooLong": "Longo demais: use até 80 caracteres.",
  "posts.language": "Idioma do post",
  "posts.preview": "Próximo post",
  "posts.when": "Toda {day}, entre {from} e {to} ST, em #{channel}.",
  "posts.off": "Desligado: nada é postado.",
  "posts.noChannel":
    "Nada é postado até o {channel} ser configurado: cole o webhook dele em Discord, acima.",
  "posts.failed": "Não salvou. Tente de novo.",
  "posts.rateLimited": "Muitas alterações agora. Espere 15 minutos e tente de novo.",
  "settings.state.posts": "{on} de {n} ligados",
  "callouts.post.week": "Esta semana na aliança",
  "callouts.where.week": "Vai acima do post do calendário da semana, na segunda.",
  "activity.callout.week": "{who} mudou a frase de “Esta semana na aliança”",
};

export const postsFr: typeof postsEn = {
  "posts.head": "Messages",
  "posts.lead":
    "Des messages que LAPTracker peut publier pour vous tout seul, un jour fixe. Chacun reste éteint jusqu’à ce que vous l’allumiez. Ils ne nomment ni ne mentionnent personne.",
  "posts.week.name": "Cette semaine dans l’alliance",
  "posts.week.what":
    "Les entrées du calendrier de la semaine marquées « Les membres peuvent voir ceci », avec leurs heures du serveur (ST). Sans noms, notes ni liens. Rien n’est publié une semaine sans aucune.",
  "posts.week.defaultTitle": "Cette semaine dans l’alliance",
  "posts.turnOn": "Le publier",
  "posts.channel": "Salon",
  "posts.channel.members": "Salon des membres",
  "posts.channel.leaders": "Salon des chefs",
  "posts.channel.notSet": "{channel} (pas configuré)",
  "posts.day": "Jour",
  "posts.day.fixed": "Chaque {day} : la semaine du calendrier commence ce jour-là.",
  "posts.title": "Titre",
  "posts.titleHelp": "Laissez vide pour « {title} ».",
  "posts.titleCount": "{n} sur 80 caractères",
  "posts.titleTooLong": "Trop long : 80 caractères au plus.",
  "posts.language": "Langue du message",
  "posts.preview": "Prochain message",
  "posts.when": "Chaque {day}, entre {from} et {to} ST, dans #{channel}.",
  "posts.off": "Éteint : rien n’est publié.",
  "posts.noChannel":
    "Rien n’est publié tant que le {channel} n’est pas configuré : collez son webhook sous Discord, plus haut.",
  "posts.failed": "Ce n’est pas enregistré. Réessayez.",
  "posts.rateLimited": "Trop d’enregistrements d’un coup. Attendez 15 minutes, puis réessayez.",
  "settings.state.posts": "{on} sur {n} allumés",
  "callouts.post.week": "Cette semaine dans l’alliance",
  "callouts.where.week": "Au-dessus du message du calendrier de la semaine, le lundi.",
  "activity.callout.week": "{who} a changé la phrase de « Cette semaine dans l’alliance »",
};
