// Alliance settings → Discord (D129, issue 451) in French. French puts a no-break space before : and ?.
import type { discordEn } from "./dictionary.discord";

export const discordFr: typeof discordEn = {
  "discord.head": "Discord",
  "discord.lead":
    "Reliez le serveur Discord de votre alliance : le bot, les commandes de message et les salons des annonces. Suivez les étapes dans l’ordre.",
  "discord.bot.head": "1. Ajoutez LAPTracker à votre serveur",
  "discord.bot.lead":
    "Le bot peut voir les salons, envoyer des messages, ouvrir des fils publics et y écrire. Il n’a besoin d’aucun droit d’administrateur.",
  "discord.bot.tip":
    "Il vous faut la permission Gérer le serveur sur Discord. Le lien s’ouvre seulement sur le serveur de votre alliance.",
  "discord.bot.add": "Ajouter LAPTracker à Discord",
  "discord.bot.unset":
    "Discord n’est pas encore configuré sur ce site. Demandez au propriétaire du site.",
  "discord.check.head": "2. Vérifiez le bot et activez les commandes",
  "discord.check.lead":
    "Après avoir ajouté le bot, revenez ici et touchez Vérifier. Les commandes apparaissent alors sur n’importe quel message : appui long dessus (sur ordinateur, clic droit) → Applications.",
  "discord.check.leadNone": "Après avoir ajouté le bot, revenez ici et touchez Vérifier.",
  "discord.check.button": "Vérifier",
  "discord.check.checking": "Vérification avec Discord…",
  "discord.check.never": "Pas encore vérifié.",
  "discord.check.seen": "LAPTracker est sur votre serveur.",
  "discord.check.commands": "Commandes activées : {list}.",
  "discord.check.missing":
    "Le bot n’est pas encore sur votre serveur : touchez d’abord Ajouter LAPTracker à Discord, à l’étape 1.",
  "discord.check.unreachable": "Discord n’a pas répondu. Réessayez dans une minute.",
  "discord.check.failed":
    "Le bot est sur votre serveur, mais Discord n’a pas accepté les commandes. Réessayez dans une minute.",
  "discord.check.rateLimited":
    "Trop de vérifications pour l’instant. Attendez 15 minutes, puis réessayez.",
  "discord.check.off":
    "Le bot n’est pas encore configuré sur ce site. Demandez au propriétaire du site.",
  "discord.private":
    "Seulement si un salon est privé : pour que les commandes y publient, ouvrez les paramètres du salon → Permissions → ajoutez LAPTracker, puis autorisez Voir le salon, Envoyer des messages, Créer des fils publics et Envoyer des messages dans les fils.",
  "discord.hooks.head": "3. Salons des annonces",
  "discord.hooks.lead":
    "Quand vous touchez Publier sur Discord sur une annonce, les annonces de la direction vont dans le salon des chefs et celles des membres dans le salon des membres. Chaque salon a besoin de son propre webhook. Le résumé de la vérification du Bouclier de raid peut avoir son propre salon.",
  "discord.hooks.how":
    "Sur Discord : ouvrez les paramètres du salon → Intégrations → Webhooks → Nouveau webhook → Copier l’URL du webhook. Collez-la ici.",
  "discord.channel.leaders": "Salon des chefs",
  "discord.channel.members": "Salon des membres",
  "discord.channel.shield": "Salon du Bouclier de raid",
  "discord.channel.shieldHelp":
    "Pour le résumé de la vérification du Bouclier de raid. Il cite les membres sans bouclier vu, alors choisissez un salon que seuls les chefs et les officiers voient.",
  "discord.hook.set": "Configuré · #{name}",
  "discord.hook.site":
    "Utilise un salon configuré par le site (#{name}). Ajoutez le webhook de votre alliance pour publier dans votre salon.",
  "discord.hook.none": "Pas encore configuré.",
  "discord.hook.noneShield":
    "Pas encore configuré. Le résumé va dans le salon des chefs tant qu’aucun n’est configuré.",
  "discord.hook.reenter":
    "Ce webhook doit être collé à nouveau. Le réglage de sécurité du site a changé, celui enregistré ne peut plus être lu.",
  "discord.hook.url": "URL du webhook",
  "discord.hook.urlHelp":
    "Elle commence par https://discord.com/api/webhooks/. Elle est enregistrée chiffrée et n’est plus jamais affichée.",
  "discord.hook.name": "Nom du salon",
  "discord.hook.nameHelp":
    "Comme Discord l’affiche, sans le #. Exemple : annonces. Les officiers le voient avant de publier.",
  "discord.hook.forum": "C’est un salon forum",
  "discord.hook.forumHelp": "Chaque annonce ouvre alors sa propre publication dans le forum.",
  "discord.hook.save": "Vérifier et enregistrer",
  "discord.hook.saving": "Vérification avec Discord…",
  "discord.hook.add": "Ajouter un webhook",
  "discord.hook.replace": "Remplacer",
  "discord.hook.remove": "Retirer",
  "discord.hook.cancel": "Annuler",
  "discord.hook.test": "Envoyer un message de test",
  "discord.hook.testing": "Envoi…",
  "discord.hook.tested": "Message de test envoyé. Regardez dans le salon.",
  "discord.hook.saved": "Webhook enregistré.",
  "discord.hook.removed": "Webhook retiré.",
  "discord.hook.removeAsk": "Retirer le webhook de ce salon ?",
  "discord.hook.removeMore": "Publier sur Discord ne poste plus dans ce salon.",
  "discord.hook.removeMoreShield":
    "Le résumé du Bouclier de raid retourne dans le salon des chefs.",
  "discord.hook.keep": "Le garder",
  "discord.hook.bad":
    "Ce n’est pas une URL de webhook Discord. Copiez-la à nouveau depuis Intégrations → Webhooks du salon.",
  "discord.hook.refused":
    "Discord ne connaît pas ce webhook. Il a peut-être été supprimé. Copiez-le à nouveau.",
  "discord.hook.wrongServer":
    "Ce webhook appartient à un autre serveur Discord. Utilisez un salon du serveur de votre alliance.",
  "discord.hook.unreachable": "Discord n’a pas répondu. Réessayez dans une minute.",
  "discord.hook.rateLimited": "Trop d’essais pour l’instant. Attendez 15 minutes, puis réessayez.",
  "discord.hook.off":
    "L’enregistrement des webhooks n’est pas encore configuré sur ce site. Demandez au propriétaire du site.",
  "discord.hook.failed": "Impossible d’enregistrer. Réessayez.",
  "discord.hook.testFailed":
    "Discord n’a pas accepté le message de test. Vérifiez que le webhook existe encore.",
  "discord.hook.notSetUp": "Aucun webhook n’est configuré pour ce salon.",
  "discord.test.title": "Test de LAPTracker",
  "discord.test.leaders":
    "LAPTracker peut publier ici. Les annonces de la direction du Bureau des officiers arriveront dans ce salon.",
  "discord.test.members":
    "LAPTracker peut publier ici. Les annonces pour les membres du Bureau des officiers arriveront dans ce salon.",
  "discord.test.shield":
    "LAPTracker peut publier ici. Le résumé de la vérification du Bouclier de raid du Bureau des officiers arrivera dans ce salon.",
};
