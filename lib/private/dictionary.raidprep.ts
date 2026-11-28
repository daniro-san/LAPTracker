// Raid prep (issue 474, D137): the Raid Shield roll call's second mark, the tracker's shield readings on each
// row, "Mark ✓ the n seen with a shield", the ready message, the reminder list to copy, the Discord
// summary's state, and Alliance settings → Raid Shield check. English, Brazilian Portuguese and French: one
// module the three roll call dictionaries spread. People first (D75): "not seen yet" is a hint about the
// tracker's map scan, and the tracker's own marks are shown "from the tracker" until an officer checks them
// (D137, 2026-11-21). One vocabulary (issue 585): the Raid Shield check has a night check and a morning
// check, on this page, on Insights, in settings and in the Discord summary. French puts a no-break space
// before : and ?. The first-glance words (issue 585) are in dictionary.raidprep-glance.ts, "Check by hand"
// (issue 726) in dictionary.raidprep-hand.ts, the raid opponent (issue 861) in dictionary.raidprep-opponent.ts.
import { glanceEn, glanceFr, glancePt } from "./dictionary.raidprep-glance";
import { handEn, handFr, handPt } from "./dictionary.raidprep-hand";
import { opponentEn, opponentFr, opponentPt } from "./dictionary.raidprep-opponent";

export const prepEn = {
  "roll.prep.shield": "Shield",
  "roll.prep.wall": "Squads off the wall",
  "roll.prep.wall.yes": "Off the wall",
  "roll.prep.wall.no": "On the wall",
  "roll.prep.wall.toggle": "Show squads off the wall",
  "roll.prep.wall.help":
    "Squads off the wall is optional and never counts. Turn on “Show squads off the wall” to mark it on the cards; a card keeps showing it once it is marked.",
  "roll.prep.on": "shield seen",
  "roll.prep.notSeen": "no shield seen",
  "roll.prep.checkpoint": "{pass}: {state}",
  "roll.prep.pass.night": "Night check",
  "roll.prep.pass.reset": "After-reset check",
  "roll.prep.pass.morning": "Morning check",
  "roll.prep.noShieldSeen": "No shield seen",
  "roll.prep.notSeenLeft": "{n} not seen yet, left out",
  "roll.prep.notSeenLeft.one": "{n} not seen yet, left out",
  ...glanceEn,
  ...handEn,
  ...opponentEn,
  "roll.prep.read.none":
    "Night check: Friday from {night} ST. Morning check: Saturday from {time} ST. The tracker reads every member at each.",
  "roll.prep.read.unread": "{n} not read yet",
  "roll.prep.hint":
    "The tracker sees a shield at its map scan, every 1 to 7 hours. The times on the cards are those scans, in server time (ST), with how far each is from the reset. A shield turned on after the scan is not seen yet.",
  "roll.prep.accept": "Mark ✓ the {n} seen with a shield",
  "roll.prep.accept.one": "Mark ✓ the 1 seen with a shield",
  "roll.prep.acceptHelp":
    "“Mark ✓ the n seen with a shield” marks ✓ those seen with a shield who are not on To check by hand. Those marks say “from the tracker”.",
  "roll.prep.accepted": "{n} marked from the tracker",
  "roll.prep.fromTracker": "from the tracker",
  "roll.prep.check":
    "{n} marks came from the tracker's reading at {time}. They say “from the tracker” below.",
  "roll.prep.check.one":
    "1 mark came from the tracker's reading at {time}. It says “from the tracker” below.",
  "roll.prep.checked": "Checked",
  "roll.prep.trackerName": "The tracker",
  "roll.prep.message": "Message",
  "roll.prep.messageFor": "Message for {name}, in {language}",
  "roll.prep.messageTo": "for {name}",
  "roll.prep.copy": "Copy",
  "roll.prep.copied": "Copied",
  "roll.prep.allSet": "All set",
  "roll.prep.copyNames": "Copy {n} names",
  "roll.prep.copyNames.one": "Copy 1 name",
  "roll.prep.copyMessage": "Copy one message",
  "roll.prep.copiedNames": "{n} names copied",
  "roll.prep.copiedNames.one": "1 name copied",
  "roll.prep.copiedMessage": "Message copied",
  "roll.prep.copyHelp":
    "“Copy names” and “Copy one message” are for the members whose Shield is ✗, or not set and not seen with a shield by the tracker; away members are left out. Names only, to paste into Discord; they do not ping anyone.",
  "roll.prep.discord.posted": "Discord summary posted · updated {time} ST",
  "roll.prep.discord.waiting": "Discord summary: posted after the night check.",
  "roll.prep.discord.unset": "No Discord summary: it is not set up.",
  "roll.prep.discord.off": "The Discord summary is off.",
  "roll.prep.discord.failed": "The Discord summary was not posted. Check the Raid Shield channel.",
  "roll.prep.discord.gone":
    "The Discord summary was deleted in Discord. It is not posted again this week.",
  "roll.prep.discord.settings": "Alliance settings ›",
  "roll.prep.lang.en": "English",
  "roll.prep.lang.pt-BR": "Portuguese",
  "roll.prep.lang.fr": "French",
  "prep.settings.head": "Raid Shield check",
  "prep.settings.lead":
    "The tracker reads every member at the times below: the night check on Friday, before the reset, the after-reset check, and the morning check on Saturday. Nothing is read after 12:00 ST, when KvK starts.",
  "prep.settings.night": "Night check from (ST)",
  "prep.settings.morning": "Morning check from (ST)",
  "prep.settings.reset": "After-reset check",
  "prep.settings.resetHelp":
    "One more read of every member after the 00:00 ST reset, before the morning check.",
  "prep.settings.resetAt": "After-reset check at (ST)",
  "prep.settings.tradeoff":
    "Earlier means fewer maps refreshed after the reset: the tracker rescans maps in the hours after it, and about half of maps were refreshed by 02:30 ST.",
  "prep.settings.eventWindow":
    "Not saved: one of these times falls in an event's window. Pick another time.",
  "prep.settings.readsOverlap":
    "Not saved: the after-reset check must end before the morning check starts. Pick an earlier time or a later morning check.",
  "prep.settings.discord": "Post the summary to Discord",
  "prep.settings.discordHelp":
    "One message after the night check, updated after the morning check: how many have a shield seen and who not yet, with a link here. It is posted only to the Raid Shield channel set up under Discord. Never to the leaders' or members' channel.",
  "prep.settings.noChannel":
    "The summary needs the Raid Shield channel. Set it up under Discord first.",
  "prep.settings.notPosting":
    "On, but no summary is posted: the Raid Shield channel is not set up under Discord.",
  "prep.settings.reenter":
    "Paste the Raid Shield channel's webhook again under Discord first. Until then the summary is not posted.",
  "prep.settings.language": "Message language",
  "prep.settings.failed": "Not saved. Try again.",
} as const;

export type PrepWords = Record<keyof typeof prepEn, string>;

export const prepPt: PrepWords = {
  "roll.prep.shield": "Escudo",
  "roll.prep.wall": "Esquadrões fora da muralha",
  "roll.prep.wall.yes": "Fora da muralha",
  "roll.prep.wall.no": "Na muralha",
  "roll.prep.wall.toggle": "Mostrar esquadrões fora da muralha",
  "roll.prep.wall.help":
    "Esquadrões fora da muralha é opcional e nunca conta. Ligue “Mostrar esquadrões fora da muralha” para marcar nos cartões; o cartão continua mostrando depois de marcado.",
  "roll.prep.on": "escudo visto",
  "roll.prep.notSeen": "sem escudo visto",
  "roll.prep.checkpoint": "{pass}: {state}",
  "roll.prep.pass.night": "Noite",
  "roll.prep.pass.reset": "Após o reset",
  "roll.prep.pass.morning": "Manhã",
  "roll.prep.noShieldSeen": "Sem escudo visto",
  "roll.prep.notSeenLeft": "{n} ainda sem escudo visto, deixados de fora",
  "roll.prep.notSeenLeft.one": "{n} ainda sem escudo visto, deixado de fora",
  ...glancePt,
  ...handPt,
  ...opponentPt,
  "roll.prep.read.none":
    "Conferência da noite: sexta a partir das {night} ST. Conferência da manhã: sábado a partir das {time} ST. O tracker lê todos os membros em cada uma.",
  "roll.prep.read.unread": "{n} ainda sem leitura",
  "roll.prep.hint":
    "O tracker vê o escudo na varredura do mapa, a cada 1 a 7 horas. Os horários nos cartões são dessas varreduras, no horário do servidor (ST), com a distância de cada uma até o reset. Um escudo ligado depois da varredura ainda não foi visto.",
  "roll.prep.accept": "Marcar ✓ os {n} vistos com escudo",
  "roll.prep.accept.one": "Marcar ✓ o 1 visto com escudo",
  "roll.prep.acceptHelp":
    "“Marcar ✓ os n vistos com escudo” marca ✓ os vistos com escudo que não estão em Para conferir à mão. Essas marcas dizem “pelo tracker”.",
  "roll.prep.accepted": "{n} marcados pelo tracker",
  "roll.prep.fromTracker": "pelo tracker",
  "roll.prep.check":
    "{n} marcas vieram da leitura do tracker às {time}. Elas dizem “pelo tracker” abaixo.",
  "roll.prep.check.one":
    "1 marca veio da leitura do tracker às {time}. Ela diz “pelo tracker” abaixo.",
  "roll.prep.checked": "Conferido",
  "roll.prep.trackerName": "O tracker",
  "roll.prep.message": "Mensagem",
  "roll.prep.messageFor": "Mensagem para {name}, em {language}",
  "roll.prep.messageTo": "para {name}",
  "roll.prep.copy": "Copiar",
  "roll.prep.copied": "Copiado",
  "roll.prep.allSet": "Tudo certo",
  "roll.prep.copyNames": "Copiar {n} nomes",
  "roll.prep.copyNames.one": "Copiar 1 nome",
  "roll.prep.copyMessage": "Copiar uma mensagem",
  "roll.prep.copiedNames": "{n} nomes copiados",
  "roll.prep.copiedNames.one": "1 nome copiado",
  "roll.prep.copiedMessage": "Mensagem copiada",
  "roll.prep.copyHelp":
    "“Copiar nomes” e “Copiar uma mensagem” são para os membros com Escudo ✗, ou sem marca e sem escudo visto pelo tracker; os ausentes ficam de fora. Só os nomes, para colar no Discord; ninguém é marcado com @.",
  "roll.prep.discord.posted": "Resumo no Discord postado · atualizado às {time} ST",
  "roll.prep.discord.waiting": "Resumo no Discord: postado depois da conferência da noite.",
  "roll.prep.discord.unset": "Sem resumo no Discord: ele não está configurado.",
  "roll.prep.discord.off": "O resumo no Discord está desligado.",
  "roll.prep.discord.failed":
    "O resumo no Discord não foi postado. Confira o canal do Escudo de raid.",
  "roll.prep.discord.gone":
    "O resumo foi apagado no Discord. Ele não é postado de novo nesta semana.",
  "roll.prep.discord.settings": "Configurações da aliança ›",
  "roll.prep.lang.en": "inglês",
  "roll.prep.lang.pt-BR": "português",
  "roll.prep.lang.fr": "francês",
  "prep.settings.head": "Conferência do Escudo de raid",
  "prep.settings.lead":
    "O tracker lê todos os membros nos horários abaixo: a conferência da noite na sexta, antes do reset, a conferência após o reset e a conferência da manhã no sábado. Nada é lido depois das 12:00 ST, quando o KvK começa.",
  "prep.settings.night": "Conferência da noite a partir das (ST)",
  "prep.settings.morning": "Conferência da manhã a partir das (ST)",
  "prep.settings.reset": "Conferência após o reset",
  "prep.settings.resetHelp":
    "Mais uma leitura de todos os membros depois do reset das 00:00 ST, antes da conferência da manhã.",
  "prep.settings.resetAt": "Conferência após o reset às (ST)",
  "prep.settings.tradeoff":
    "Mais cedo significa menos mapas atualizados depois do reset: o tracker varre os mapas nas horas seguintes, e cerca de metade dos mapas estava atualizada às 02:30 ST.",
  "prep.settings.eventWindow":
    "Não foi salvo: um desses horários cai na janela de um evento. Escolha outro horário.",
  "prep.settings.readsOverlap":
    "Não foi salvo: a conferência após o reset precisa terminar antes de a conferência da manhã começar. Escolha um horário mais cedo ou uma conferência da manhã mais tarde.",
  "prep.settings.discord": "Postar o resumo no Discord",
  "prep.settings.discordHelp":
    "Uma mensagem depois da conferência da noite, atualizada depois da conferência da manhã: quantos têm escudo visto e quem ainda não, com um link para cá. É postada só no canal do Escudo de raid configurado em Discord. Nunca no canal dos líderes nem no dos membros.",
  "prep.settings.noChannel":
    "O resumo precisa do canal do Escudo de raid. Configure-o antes em Discord.",
  "prep.settings.notPosting":
    "Ligado, mas nenhum resumo é postado: o canal do Escudo de raid não está configurado em Discord.",
  "prep.settings.reenter":
    "Cole de novo o webhook do canal do Escudo de raid em Discord. Até lá, o resumo não é postado.",
  "prep.settings.language": "Idioma da mensagem",
  "prep.settings.failed": "Não foi salvo. Tente de novo.",
};

export const prepFr: PrepWords = {
  "roll.prep.shield": "Bouclier",
  "roll.prep.wall": "Escouades hors du mur",
  "roll.prep.wall.yes": "Hors du mur",
  "roll.prep.wall.no": "Sur le mur",
  "roll.prep.wall.toggle": "Afficher les escouades hors du mur",
  "roll.prep.wall.help":
    "Escouades hors du mur est facultatif et ne compte jamais. Activez « Afficher les escouades hors du mur » pour le marquer sur les cartes ; une carte continue de l’afficher une fois marqué.",
  "roll.prep.on": "bouclier vu",
  "roll.prep.notSeen": "pas de bouclier vu",
  "roll.prep.checkpoint": "{pass} : {state}",
  "roll.prep.pass.night": "Soir",
  "roll.prep.pass.reset": "Après le reset",
  "roll.prep.pass.morning": "Matin",
  "roll.prep.noShieldSeen": "Pas de bouclier vu",
  "roll.prep.notSeenLeft": "{n} pas encore vus, laissés de côté",
  "roll.prep.notSeenLeft.one": "{n} pas encore vu, laissé de côté",
  ...glanceFr,
  ...handFr,
  ...opponentFr,
  "roll.prep.read.none":
    "Vérification du soir : vendredi à partir de {night} ST. Vérification du matin : samedi à partir de {time} ST. Le tracker lit chaque membre à chacune.",
  "roll.prep.read.unread": "{n} pas encore lus",
  "roll.prep.hint":
    "Le tracker voit un bouclier lors de son scan de la carte, toutes les 1 à 7 heures. Les heures sur les cartes sont celles de ces scans, à l’heure du serveur (ST), avec leur écart au reset. Un bouclier activé après le scan n’est pas encore vu.",
  "roll.prep.accept": "Marquer ✓ les {n} vus avec un bouclier",
  "roll.prep.accept.one": "Marquer ✓ le 1 vu avec un bouclier",
  "roll.prep.acceptHelp":
    "« Marquer ✓ les n vus avec un bouclier » marque ✓ ceux vus avec un bouclier qui ne sont pas dans À vérifier à la main. Ces marques indiquent « d’après le tracker ».",
  "roll.prep.accepted": "{n} marqués d’après le tracker",
  "roll.prep.fromTracker": "d’après le tracker",
  "roll.prep.check":
    "{n} marques viennent de la lecture du tracker à {time}. Elles indiquent « d’après le tracker » ci-dessous.",
  "roll.prep.check.one":
    "1 marque vient de la lecture du tracker à {time}. Elle indique « d’après le tracker » ci-dessous.",
  "roll.prep.checked": "Vérifié",
  "roll.prep.trackerName": "Le tracker",
  "roll.prep.message": "Message",
  "roll.prep.messageFor": "Message pour {name}, en {language}",
  "roll.prep.messageTo": "pour {name}",
  "roll.prep.copy": "Copier",
  "roll.prep.copied": "Copié",
  "roll.prep.allSet": "Tout est prêt",
  "roll.prep.copyNames": "Copier {n} noms",
  "roll.prep.copyNames.one": "Copier 1 nom",
  "roll.prep.copyMessage": "Copier un seul message",
  "roll.prep.copiedNames": "{n} noms copiés",
  "roll.prep.copiedNames.one": "1 nom copié",
  "roll.prep.copiedMessage": "Message copié",
  "roll.prep.copyHelp":
    "« Copier les noms » et « Copier un seul message » concernent les membres dont le Bouclier est ✗, ou non défini et sans bouclier vu par le tracker ; les absents sont laissés de côté. Les noms seulement, à coller dans Discord ; personne n’est mentionné.",
  "roll.prep.discord.posted": "Résumé Discord publié · mis à jour à {time} ST",
  "roll.prep.discord.waiting": "Résumé Discord : publié après la vérification du soir.",
  "roll.prep.discord.unset": "Pas de résumé Discord : il n’est pas configuré.",
  "roll.prep.discord.off": "Le résumé Discord est désactivé.",
  "roll.prep.discord.failed":
    "Le résumé Discord n’a pas été publié. Vérifiez le salon du Bouclier de raid.",
  "roll.prep.discord.gone":
    "Le résumé a été supprimé dans Discord. Il n’est pas republié cette semaine.",
  "roll.prep.discord.settings": "Réglages de l’alliance ›",
  "roll.prep.lang.en": "anglais",
  "roll.prep.lang.pt-BR": "portugais",
  "roll.prep.lang.fr": "français",
  "prep.settings.head": "Vérification du Bouclier de raid",
  "prep.settings.lead":
    "Le tracker lit chaque membre aux heures ci-dessous : la vérification du soir le vendredi, avant le reset, la vérification après le reset et la vérification du matin le samedi. Rien n’est lu après 12:00 ST, quand le KvK commence.",
  "prep.settings.night": "Vérification du soir à partir de (ST)",
  "prep.settings.morning": "Vérification du matin à partir de (ST)",
  "prep.settings.reset": "Vérification après le reset",
  "prep.settings.resetHelp":
    "Une lecture de plus de chaque membre après le reset de 00:00 ST, avant la vérification du matin.",
  "prep.settings.resetAt": "Vérification après le reset à (ST)",
  "prep.settings.tradeoff":
    "Plus tôt, moins de cartes sont rafraîchies après le reset : le tracker rescanne les cartes dans les heures qui suivent, et environ la moitié des cartes l’étaient à 02:30 ST.",
  "prep.settings.eventWindow":
    "Pas enregistré : une de ces heures tombe dans la fenêtre d’un événement. Choisissez une autre heure.",
  "prep.settings.readsOverlap":
    "Pas enregistré : la vérification après le reset doit finir avant le début de celle du matin. Choisissez une heure plus tôt ou une vérification du matin plus tard.",
  "prep.settings.discord": "Publier le résumé sur Discord",
  "prep.settings.discordHelp":
    "Un message après la vérification du soir, mis à jour après celle du matin : combien ont un bouclier vu et qui pas encore, avec un lien ici. Il est publié seulement dans le salon du Bouclier de raid configuré sous Discord. Jamais dans le salon des chefs ni dans celui des membres.",
  "prep.settings.noChannel":
    "Le résumé a besoin du salon du Bouclier de raid. Configurez-le d’abord sous Discord.",
  "prep.settings.notPosting":
    "Activé, mais aucun résumé n’est publié : le salon du Bouclier de raid n’est pas configuré sous Discord.",
  "prep.settings.reenter":
    "Collez à nouveau le webhook du salon du Bouclier de raid sous Discord. D’ici là, le résumé n’est pas publié.",
  "prep.settings.language": "Langue du message",
  "prep.settings.failed": "Pas enregistré. Réessayez.",
};

/**
 * The ready private message, in the member's language (not the officer's): only the parts not yet ✓.
 * "Bring your troops home" goes with every message: a shield does not protect troops outside. `all` is the
 * one message for every member still to remind, in the officers' language: the names first, then the same
 * request to many (issue 585).
 */
export const PREP_MESSAGE = {
  en: {
    text: "Hi {name}, {when}, please {parts}. Thanks!",
    reset: "before the reset",
    kvk: "before KvK starts at 12:00 ST",
    shield: "turn on your shield",
    check: "check your shield is still on",
    wall: "take your squads off the wall",
    home: "bring your troops home",
    and: "and",
    all: {
      text: "{name}: {when}, please {parts}. Thanks!",
      shield: "make sure your shield is on",
      wall: "take your squads off the wall",
      home: "bring your troops home",
    },
  },
  "pt-BR": {
    text: "Oi {name}, {when}, por favor {parts}. Obrigado!",
    reset: "antes do reset",
    kvk: "antes do KvK começar às 12:00 ST",
    shield: "ligue o seu escudo",
    check: "confira se o seu escudo continua ligado",
    wall: "tire os seus esquadrões da muralha",
    home: "traga as suas tropas para casa",
    and: "e",
    all: {
      text: "{name}: {when}, por favor {parts}. Obrigado!",
      shield: "confirmem que o escudo está ligado",
      wall: "tirem os esquadrões da muralha",
      home: "tragam as tropas para casa",
    },
  },
  fr: {
    text: "Salut {name}, {when}, pense à {parts}. Merci !",
    reset: "avant le reset",
    kvk: "avant le début du KvK à 12:00 ST",
    shield: "activer ton bouclier",
    check: "vérifier que ton bouclier est toujours actif",
    wall: "retirer tes escouades du mur",
    home: "ramener tes troupes à la maison",
    and: "et",
    all: {
      text: "{name} : {when}, pensez à {parts}. Merci !",
      shield: "vérifier que votre bouclier est actif",
      wall: "retirer vos escouades du mur",
      home: "ramener vos troupes à la maison",
    },
  },
} as const;
export type PrepMessageWords = (typeof PREP_MESSAGE)[keyof typeof PREP_MESSAGE];
