// A new alliance's pages (D130, issue 453) in French. French puts a no-break space before : ? and !.
import type { inviteEn } from "./dictionary.invite";

export const inviteFr: typeof inviteEn = {
  "invite.title": "Créez votre Bureau des officiers",
  "invite.lead":
    "Pour {alliance}. Quatre étapes courtes, environ 5 minutes. Il faut être propriétaire du serveur Discord de l’alliance, ou y avoir Gérer le serveur.",
  "invite.expires": "Ce lien fonctionne une fois, jusqu’au {date}.",
  "invite.none.title": "Lien d’invitation",
  "invite.none.text":
    "Ouvrez le lien d’invitation que vous avez reçu. Il commence par l’adresse de ce site et fonctionne une fois.",
  "invite.e.link":
    "Ce lien ne fonctionne pas. Il est peut-être coupé, ou un lien plus récent l’a remplacé. Demandez-en un nouveau à la personne qui l’a envoyé.",
  "invite.e.denied": "Discord n’a pas confirmé la connexion. Réessayez.",
  "invite.e.discord": "Discord n’a pas répondu. Réessayez dans une minute.",
  "invite.e.claimed":
    "Quelqu’un d’autre a déjà créé ce Bureau avec ce lien. Demandez-en un nouveau à la personne qui l’a envoyé.",
  "invite.e.not_configured":
    "La connexion n’est pas encore configurée sur ce site. Demandez au propriétaire du site.",
  "invite.used.mine": "Votre Bureau des officiers est prêt.",
  "invite.used.open": "Ouvrir le Bureau des officiers",
  "invite.used.other":
    "Ce lien d’invitation a déjà servi. Si le Bureau de votre alliance existe, demandez son adresse à votre direction.",
  "invite.expired":
    "Ce lien d’invitation a expiré. Demandez-en un nouveau au propriétaire du site.",
  "invite.cancelled":
    "Ce lien d’invitation a été annulé. Demandez-en un nouveau au propriétaire du site.",
  "invite.done": "Fait",
  "invite.signin.head": "1. Connectez-vous avec Discord",
  "invite.signin.tip":
    "Utilisez le compte Discord propriétaire du serveur de l’alliance. Discord nous montre votre nom et la liste de vos serveurs. Rien n’est publié.",
  "invite.signin.button": "Se connecter avec Discord",
  "invite.signin.as": "Connecté·e en tant que {name}.",
  "invite.signin.other": "Utiliser un autre compte",
  "invite.server.head": "2. Choisissez le serveur de l’alliance",
  "invite.server.tip":
    "Seuls les serveurs dont vous êtes propriétaire ou que vous pouvez gérer sont listés.",
  "invite.server.none":
    "Aucun de vos serveurs ne peut être choisi : vous n’êtes propriétaire d’aucun, et n’avez Gérer le serveur sur aucun. Connectez-vous avec le compte propriétaire du serveur de l’alliance.",
  "invite.server.taken": "A déjà un Bureau",
  "invite.server.picked": "Serveur : {name}",
  "invite.server.change": "Changer",
  "invite.server.save": "Utiliser ce serveur",
  "invite.bot.head": "3. Ajoutez LAPTracker au serveur",
  "invite.bot.tip":
    "LAPTracker peut voir les salons, envoyer des messages et ouvrir des fils. Il n’a besoin d’aucun droit d’administrateur. Choisissez Autoriser sur la page de Discord, puis revenez ici.",
  "invite.bot.add": "Ajouter LAPTracker à Discord",
  "invite.bot.continue": "C’est fait : continuer",
  "invite.bot.checking": "Vérification avec Discord…",
  "invite.bot.in": "LAPTracker est sur votre serveur.",
  "invite.roles.head": "4. Choisissez qui entre",
  "invite.roles.leaders": "Direction : qui ouvre le Bureau des officiers",
  "invite.roles.leadersHelp":
    "Choisissez-en un ou plusieurs. En général, le rôle R5 et le rôle R4, pas celui des membres.",
  "invite.roles.members": "Membres : qui voit le tableau des membres (facultatif)",
  "invite.roles.membersHelp":
    "Sans rôle de membre, le tableau des membres reste fermé. Vous pourrez l’ajouter plus tard.",
  "invite.roles.none": "Votre serveur n’a pas encore de rôles. Créez-les ci-dessous.",
  "invite.roles.reload": "Recharger les rôles",
  "invite.roles.assign":
    "Pour donner un rôle sur Discord : Paramètres du serveur → Membres → la personne → le + sous son nom.",
  "invite.create.head": "Pas encore de rôles pour ça ? Créez-les ici",
  "invite.create.lead":
    "LAPTracker crée deux rôles sans aucune permission propre. Autorisez-le d’abord à créer des rôles : Discord le demande encore une fois, pour ce serveur seulement.",
  "invite.create.allow": "Autoriser LAPTracker à créer des rôles",
  "invite.create.leader": "Nom du rôle de la direction",
  "invite.create.member": "Nom du rôle des membres",
  "invite.create.giveMe": "Me donner le rôle de la direction",
  "invite.create.button": "Créer les rôles",
  "invite.create.creating": "Création…",
  "invite.create.made": "Créés : {list}. Ils sont cochés plus haut.",
  "invite.create.memberFailed":
    "Discord n’a pas créé le rôle des membres. Touchez à nouveau Créer les rôles : le rôle de la direction est gardé, il n’est pas créé deux fois.",
  "invite.create.gaveRefused":
    "LAPTracker n’a pas pu vous donner le rôle : son propre rôle est plus bas que ce rôle dans la liste de Discord. Vous entrez quand même avec cette invitation. Donnez-vous le rôle sur Discord plus tard.",
  "invite.create.noPermission":
    "Discord a refusé : LAPTracker ne peut pas encore créer de rôles. Touchez d’abord Autoriser LAPTracker à créer des rôles. Ou créez les rôles sur Discord, puis touchez Recharger les rôles.",
  "invite.finish.button": "Ouvrir notre Bureau des officiers",
  "invite.finish.creating": "Création en cours…",
  "invite.finish.note":
    "Vous entrez avec cette invitation, même sans le rôle. Le reste (les commandes du bot, les salons des annonces) se trouve dans Réglages de l’alliance.",
  "invite.finish.pick": "Choisissez d’abord au moins un rôle de la direction.",
  "invite.err.bot_missing":
    "LAPTracker n’est pas encore sur votre serveur. Touchez Ajouter LAPTracker à Discord, choisissez Autoriser, puis touchez C’est fait : continuer.",
  "invite.err.taken": "Ce serveur a déjà un Bureau. Choisissez le serveur de votre alliance.",
  "invite.err.has_desk":
    "Votre alliance a déjà un Bureau des officiers. Demandez son adresse à votre direction.",
  "invite.err.closed": "Ce lien d’invitation ne fonctionne plus. Rechargez la page.",
  "invite.err.signed_out":
    "Votre connexion a pris fin. Touchez à nouveau Se connecter avec Discord.",
  "invite.err.rate_limited": "Trop d’essais pour l’instant. Attendez 15 minutes, puis réessayez.",
  "invite.err.bot_off":
    "Le bot n’est pas encore configuré sur ce site. Demandez au propriétaire du site.",
  "invite.err.bad_role":
    "Les rôles ont changé sur Discord. Touchez Recharger les rôles, puis choisissez à nouveau.",
  "invite.err.failed": "Un problème est survenu. Réessayez dans une minute.",
  "request.title": "Demander un Bureau des officiers",
  "request.lead":
    "Un espace privé pour la direction de votre alliance : membres, appels, annonces et calendrier. C’est gratuit. Le propriétaire du site lit chaque demande.",
  "request.alliance": "Votre alliance",
  "request.name": "Votre nom dans le jeu",
  "request.nameHelp":
    "Tel que le jeu l’affiche, pour que le propriétaire vous trouve dans votre alliance.",
  "request.leader": "Je suis le chef de l’alliance (R5) ou un R4",
  "request.rank": "Votre rang",
  "request.r5": "R5 (chef)",
  "request.r4": "R4",
  "request.onlyLeaders":
    "Un Bureau est demandé par la direction de l’alliance. Demandez à votre R5 ou à un R4 de l’envoyer.",
  "request.send": "Envoyer la demande",
  "request.sending": "Envoi…",
  "request.keep": "Nous gardons seulement votre alliance, votre nom dans le jeu et votre rang.",
  "request.err.has_desk":
    "Votre alliance a déjà un Bureau des officiers. Demandez son adresse à votre direction.",
  "request.err.rate_limited": "Trop de demandes d’ici aujourd’hui. Réessayez demain.",
  "request.err.failed": "Envoi impossible. Réessayez dans une minute.",
  "request.e.link":
    "Ce lien ne fonctionne pas. Il est peut-être coupé. Ouvrez le lien gardé à l’envoi de la demande.",
  "request.waiting.title": "Demande envoyée",
  "request.waiting.text":
    "Merci. Le propriétaire du site va regarder la demande de {name} pour {alliance}. Revenez sur cette page pour voir la réponse.",
  "request.waiting.keep":
    "Gardez ce lien. C’est le seul moyen de voir la réponse plus tard, sur n’importe quel téléphone ou ordinateur :",
  "request.copy": "Copier le lien",
  "request.copied": "Copié.",
  "request.approved.title": "Acceptée",
  "request.approved.text":
    "Votre demande pour {alliance} a été acceptée. Créez maintenant le Bureau des officiers de l’alliance : quatre étapes courtes.",
  "request.approved.button": "Continuer",
  "request.declined.title": "Non acceptée",
  "request.declined.text": "Votre demande pour {alliance} n’a pas été acceptée.",
  "request.declined.reason": "Le propriétaire du site a écrit : {reason}",
};
