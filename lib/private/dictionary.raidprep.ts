// Raid prep (issue 474, D137): the Raid Shield roll call's second mark, the tracker's shield readings on each
// row, "Accept the tracker's", the ready message, and Alliance settings → Raid Shield check. English,
// Brazilian Portuguese and French: one module the three roll call dictionaries spread. People first (D75):
// "not seen yet" and "may end before KvK" are hints about the tracker's map scan, never a ✗. French puts
// a no-break space before : and ?.
export const prepEn = {
  "roll.prep.shield": "Shield",
  "roll.prep.wall": "Squads off the wall",
  "roll.prep.wall.yes": "Off the wall",
  "roll.prep.wall.no": "On the wall",
  "roll.prep.on": "Tracker: shield seen",
  "roll.prep.notSeen": "Tracker: no shield seen yet",
  "roll.prep.map": "map seen {time}",
  "roll.prep.endsBy": "8 h shield, ends by {time} at the latest",
  "roll.prep.otherKind": "shield on, length unknown",
  "roll.prep.mayEnd": "May end before KvK",
  "roll.prep.lost": "Seen Fri {night}, not seen this morning ({morning})",
  "roll.prep.read.night": "Friday's read: {on} of {read} with a shield seen",
  "roll.prep.read.morning": "Saturday's read: {on} of {read} with a shield seen",
  "roll.prep.read.none":
    "The tracker reads every member on Friday from 23:30 ST, and again on Saturday at {time} ST.",
  "roll.prep.read.unread": "{n} not read yet",
  "roll.prep.hint":
    "The tracker sees a shield at its map scan, every 1 to 7 hours. A shield turned on after the scan shows as “not seen yet”: a hint, never a ✗.",
  "roll.prep.accept": "Accept the tracker's ({n})",
  "roll.prep.acceptHelp":
    "Marks ✓ Shield up for everyone the tracker saw with a shield and nobody marked yet. Not seen yet stays not set.",
  "roll.prep.accepted": "{n} marked from the tracker",
  "roll.prep.message": "Message",
  "roll.prep.messageFor": "Message for {name}, in {language}",
  "roll.prep.copy": "Copy",
  "roll.prep.copied": "Copied",
  "roll.prep.allSet": "All set",
  "roll.prep.lang.en": "English",
  "roll.prep.lang.pt-BR": "Portuguese",
  "roll.prep.lang.fr": "French",
  "prep.settings.head": "Raid Shield check",
  "prep.settings.lead":
    "The tracker reads every member on Friday from 23:30 ST, before the reset, and again on Saturday morning. Nothing is read after 12:00 ST, when KvK starts.",
  "prep.settings.morning": "Saturday's read at (ST)",
  "prep.settings.discord": "Post the summary to the leaders' channel",
  "prep.settings.discordHelp":
    "One message after Friday's read, updated by Saturday's: how many have a shield seen and who not yet, with a link here. Never to the members' channel.",
  "prep.settings.noChannel": "Set up the leaders' channel under Discord first.",
  "prep.settings.language": "Message language",
  "prep.settings.save": "Save",
  "prep.settings.saved": "Saved.",
  "prep.settings.failed": "Not saved. Try again.",
} as const;

export type PrepWords = Record<keyof typeof prepEn, string>;

export const prepPt: PrepWords = {
  "roll.prep.shield": "Escudo",
  "roll.prep.wall": "Esquadrões fora da muralha",
  "roll.prep.wall.yes": "Fora da muralha",
  "roll.prep.wall.no": "Na muralha",
  "roll.prep.on": "Tracker: escudo visto",
  "roll.prep.notSeen": "Tracker: ainda sem escudo visto",
  "roll.prep.map": "mapa visto {time}",
  "roll.prep.endsBy": "escudo de 8 h, acaba até {time} no máximo",
  "roll.prep.otherKind": "escudo ligado, duração desconhecida",
  "roll.prep.mayEnd": "Pode acabar antes do KvK",
  "roll.prep.lost": "Visto sex {night}, não visto hoje de manhã ({morning})",
  "roll.prep.read.night": "Leitura de sexta: {on} de {read} com escudo visto",
  "roll.prep.read.morning": "Leitura de sábado: {on} de {read} com escudo visto",
  "roll.prep.read.none":
    "O tracker lê todos os membros na sexta a partir das 23:30 ST, e de novo no sábado às {time} ST.",
  "roll.prep.read.unread": "{n} ainda sem leitura",
  "roll.prep.hint":
    "O tracker vê o escudo na varredura do mapa, a cada 1 a 7 horas. Um escudo ligado depois da varredura aparece como “ainda sem escudo visto”: uma dica, nunca um ✗.",
  "roll.prep.accept": "Aceitar o do tracker ({n})",
  "roll.prep.acceptHelp":
    "Marca ✓ Escudo ligado para quem o tracker viu com escudo e ninguém marcou ainda. Ainda sem escudo visto continua sem marcação.",
  "roll.prep.accepted": "{n} marcados pelo tracker",
  "roll.prep.message": "Mensagem",
  "roll.prep.messageFor": "Mensagem para {name}, em {language}",
  "roll.prep.copy": "Copiar",
  "roll.prep.copied": "Copiado",
  "roll.prep.allSet": "Tudo certo",
  "roll.prep.lang.en": "inglês",
  "roll.prep.lang.pt-BR": "português",
  "roll.prep.lang.fr": "francês",
  "prep.settings.head": "Conferência do Escudo de raid",
  "prep.settings.lead":
    "O tracker lê todos os membros na sexta a partir das 23:30 ST, antes do reset, e de novo no sábado de manhã. Nada é lido depois das 12:00 ST, quando o KvK começa.",
  "prep.settings.morning": "Leitura de sábado às (ST)",
  "prep.settings.discord": "Postar o resumo no canal dos líderes",
  "prep.settings.discordHelp":
    "Uma mensagem depois da leitura de sexta, atualizada pela de sábado: quantos têm escudo visto e quem ainda não, com um link para cá. Nunca no canal dos membros.",
  "prep.settings.noChannel": "Configure antes o canal dos líderes em Discord.",
  "prep.settings.language": "Idioma da mensagem",
  "prep.settings.save": "Salvar",
  "prep.settings.saved": "Salvo.",
  "prep.settings.failed": "Não foi salvo. Tente de novo.",
};

export const prepFr: PrepWords = {
  "roll.prep.shield": "Bouclier",
  "roll.prep.wall": "Escouades hors du mur",
  "roll.prep.wall.yes": "Hors du mur",
  "roll.prep.wall.no": "Sur le mur",
  "roll.prep.on": "Tracker : bouclier vu",
  "roll.prep.notSeen": "Tracker : pas encore de bouclier vu",
  "roll.prep.map": "carte vue {time}",
  "roll.prep.endsBy": "bouclier de 8 h, finit au plus tard à {time}",
  "roll.prep.otherKind": "bouclier actif, durée inconnue",
  "roll.prep.mayEnd": "Peut finir avant le KvK",
  "roll.prep.lost": "Vu ven. {night}, pas vu ce matin ({morning})",
  "roll.prep.read.night": "Lecture du vendredi : {on} sur {read} avec un bouclier vu",
  "roll.prep.read.morning": "Lecture du samedi : {on} sur {read} avec un bouclier vu",
  "roll.prep.read.none":
    "Le tracker lit chaque membre le vendredi à partir de 23:30 ST, puis le samedi à {time} ST.",
  "roll.prep.read.unread": "{n} pas encore lus",
  "roll.prep.hint":
    "Le tracker voit un bouclier lors de son scan de la carte, toutes les 1 à 7 heures. Un bouclier activé après le scan apparaît comme « pas encore de bouclier vu » : un indice, jamais un ✗.",
  "roll.prep.accept": "Accepter le tracker ({n})",
  "roll.prep.acceptHelp":
    "Marque ✓ Bouclier actif pour ceux que le tracker a vus avec un bouclier et que personne n’a encore marqués. Pas encore vu reste non défini.",
  "roll.prep.accepted": "{n} marqués d’après le tracker",
  "roll.prep.message": "Message",
  "roll.prep.messageFor": "Message pour {name}, en {language}",
  "roll.prep.copy": "Copier",
  "roll.prep.copied": "Copié",
  "roll.prep.allSet": "Tout est prêt",
  "roll.prep.lang.en": "anglais",
  "roll.prep.lang.pt-BR": "portugais",
  "roll.prep.lang.fr": "français",
  "prep.settings.head": "Vérification du Bouclier de raid",
  "prep.settings.lead":
    "Le tracker lit chaque membre le vendredi à partir de 23:30 ST, avant le reset, puis le samedi matin. Rien n’est lu après 12:00 ST, quand le KvK commence.",
  "prep.settings.morning": "Lecture du samedi à (ST)",
  "prep.settings.discord": "Publier le résumé dans le salon des dirigeants",
  "prep.settings.discordHelp":
    "Un message après la lecture du vendredi, mis à jour par celle du samedi : combien ont un bouclier vu et qui pas encore, avec un lien ici. Jamais dans le salon des membres.",
  "prep.settings.noChannel": "Configurez d’abord le salon des dirigeants sous Discord.",
  "prep.settings.language": "Langue du message",
  "prep.settings.save": "Enregistrer",
  "prep.settings.saved": "Enregistré.",
  "prep.settings.failed": "Pas enregistré. Réessayez.",
};

/**
 * The ready private message, in the member's language (not the officer's): only the parts not yet ✓.
 * "Bring your troops home" goes with every message: a shield does not protect troops outside.
 */
export const PREP_MESSAGE = {
  en: {
    text: "Hi {name}, {when}, please {parts}. Thanks!",
    reset: "before the reset",
    kvk: "before KvK starts at 12:00 ST",
    shield: "turn on your shield",
    wall: "take your squads off the wall",
    home: "bring your troops home",
    and: "and",
  },
  "pt-BR": {
    text: "Oi {name}, {when}, por favor {parts}. Obrigado!",
    reset: "antes do reset",
    kvk: "antes do KvK começar às 12:00 ST",
    shield: "ligue o seu escudo",
    wall: "tire os seus esquadrões da muralha",
    home: "traga as suas tropas para casa",
    and: "e",
  },
  fr: {
    text: "Salut {name}, {when}, pense à {parts}. Merci !",
    reset: "avant le reset",
    kvk: "avant le début du KvK à 12:00 ST",
    shield: "activer ton bouclier",
    wall: "retirer tes escouades du mur",
    home: "ramener tes troupes à la maison",
    and: "et",
  },
} as const;
export type PrepMessageWords = (typeof PREP_MESSAGE)[keyof typeof PREP_MESSAGE];
