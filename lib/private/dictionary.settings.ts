// Alliance settings and the tracker key (D124, issue 438) in English, Brazilian Portuguese and French: one
// module the three workspace dictionaries spread. The key itself is never shown: only its last 4
// characters, its status and the quota it has left. French puts a no-break space before : and inside « ».
import { calloutsEn, calloutsFr, calloutsPt } from "./dictionary.callouts";
import { chooserEn, chooserFr, chooserPt } from "./dictionary.chooser";
import { discordEn, discordPt } from "./dictionary.discord";
import { discordFr } from "./dictionary.discord-fr";
import { glossaryEn, glossaryFr, glossaryPt } from "./dictionary.glossary";
import { inviteEn, invitePt } from "./dictionary.invite";
import { inviteFr } from "./dictionary.invite-fr";
import { postsEn, postsFr, postsPt } from "./dictionary.posts";
import { pushEn, pushFr, pushPt } from "./dictionary.push";

export const settingsEn = {
  "settings.link": "Alliance settings",
  "settings.title": "Alliance settings",
  // Issue 585 (F28): the page head's save line, the "On this page" index and its states, the save row.
  "settings.saveModel":
    "Each card saves with its own button. Notifications are for this device only.",
  "settings.index": "On this page",
  "settings.index.attention": "Needs a look",
  "settings.state.key.ok": "Working",
  "settings.state.key.invalid": "Refused",
  "settings.state.key.out_of_quota": "No quota left today",
  "settings.state.key.reenter": "Enter it again",
  "settings.state.key.none": "Not set",
  "settings.state.key.site": "Site’s key",
  "settings.state.key.off": "Off on this site",
  "settings.state.features": "{on} of {allowed} on",
  "settings.state.shieldOn": "Summary to Discord: on",
  "settings.state.shieldOff": "Summary to Discord: off",
  "settings.state.channels": "{set} of {n} channels set",
  "settings.state.botOff": "commands off on this site",
  "settings.state.deletion": "Deletion asked: {date}",
  "save.button": "Save",
  "save.saving": "Saving…",
  "save.saved": "Saved.",
  "save.pendingOne": "Not saved yet: 1 change",
  "save.pending": "Not saved yet: {n} changes",
  "key.head": "Tracker key",
  "key.lead":
    "Your alliance’s own key for the tracker (Last Asylum Tracker). Squads from the tracker are read with it, and spend only this key’s quota.",
  "key.set": "Key set, ends in ••••{last4}",
  "key.state.ok": "Working.",
  "key.state.invalid": "The tracker refused this key. Squads are paused until you replace it.",
  "key.state.out_of_quota":
    "No quota left today. Squads start again after the tracker’s reset at 00:00 UTC.",
  "key.state.reenter":
    "This key needs to be entered again. The site’s security setting changed, so the saved key can no longer be read. Paste it again in Alliance settings.",
  "key.state.site": "No key yet. Your squads are read with the site’s key until you add yours.",
  "key.state.none": "No key yet. Squads from the tracker stay off until you add one.",
  "key.state.off": "Tracker keys are not set up on this site yet. Ask the site’s owner.",
  "key.quota": "Quota left: {n}",
  "key.checked": "Checked {when}",
  "key.label": "Your tracker key",
  "key.help":
    "It starts with lap_. Saving tests it with one call on this key’s quota. It is stored encrypted and never shown again.",
  "key.get": "Don’t have a key yet?",
  "key.getLink": "Get yours on the tracker",
  "key.save": "Save and test",
  "key.saving": "Testing the key…",
  "key.replace": "Replace",
  "key.remove": "Remove",
  "key.cancel": "Cancel",
  "key.removeAsk": "Remove the tracker key?",
  "key.removeMore": "Squads from the tracker stop using it at once.",
  "key.keep": "Keep it",
  "key.bad": "This is not a tracker key. It starts with lap_.",
  "key.refused": "The tracker refused this key. Check it and try again.",
  "key.unreachable": "The tracker did not answer. Try again in a minute.",
  "key.failed": "Could not save. Try again.",
  "key.rateLimited": "Too many tests of a key just now. Wait 15 minutes, then try again.",
  "key.saved": "Key saved and tested.",
  "key.removed": "Key removed.",
  "key.card.add": "Add your tracker key",
  "key.card.fix": "Your tracker key needs you",
  "key.card.none": "Squads from the tracker need your alliance’s own key.",
  "key.card.site": "Your squads are read with the site’s key for now. Add your alliance’s own key.",
  "key.card.reenter":
    "This key needs to be entered again. The site’s security setting changed, so the saved key can no longer be read. Paste it again in Alliance settings.",
  "key.card.invalid": "The tracker refused your key, so squads are paused. Replace it.",
  "key.card.out_of_quota":
    "Your key has no quota left today. Squads start again after the reset at 00:00 UTC.",
  "key.card.where":
    "To get a key: sign in with Patreon on the tracker’s API page and create one; it starts with lap_. A free account gets 1,000 calls a day, a paid membership 2,000.",
  "key.card.whereLink": "Open the tracker’s API page",
  "activity.key.set": "{who} updated the tracker key",
  "activity.key.removed": "{who} removed the tracker key",
  // D132: today's squads read, under the key.
  "squads.today": "Squads today: {read} of {members} read · {retrying} waiting to try again",
  "squads.todayNext": "next try at {at} ST",
  "squads.todayNone": "Squads today: not started yet. They are read after the daily update.",
  "squads.todayStopped": "Squads today: {read} of {members} read · stopped: {why}",
  "squads.todayStoppedNone": "Squads today: stopped: {why}",
  "squads.stop.key": "the tracker refused the key",
  "squads.stop.limit": "the limit is reached until 00:00 UTC",
  "squads.stop.cap": "today’s 120 reads are used",
  // D129: Alliance settings → Discord.
  ...discordEn,
  ...inviteEn,
  ...chooserEn,
  ...calloutsEn,
  ...glossaryEn,
  ...postsEn,
  ...pushEn,
};

export const settingsPt: typeof settingsEn = {
  "settings.link": "Configurações da aliança",
  "settings.title": "Configurações da aliança",
  "settings.saveModel":
    "Cada cartão salva com o próprio botão. As notificações valem só para este aparelho.",
  "settings.index": "Nesta página",
  "settings.index.attention": "Precisa de atenção",
  "settings.state.key.ok": "Funcionando",
  "settings.state.key.invalid": "Recusada",
  "settings.state.key.out_of_quota": "Sem cota hoje",
  "settings.state.key.reenter": "Cole de novo",
  "settings.state.key.none": "Sem chave",
  "settings.state.key.site": "Chave do site",
  "settings.state.key.off": "Desligada neste site",
  "settings.state.features": "{on} de {allowed} ligados",
  "settings.state.shieldOn": "Resumo no Discord: ligado",
  "settings.state.shieldOff": "Resumo no Discord: desligado",
  "settings.state.channels": "{set} de {n} canais configurados",
  "settings.state.botOff": "comandos desligados neste site",
  "settings.state.deletion": "Exclusão pedida: {date}",
  "save.button": "Salvar",
  "save.saving": "Salvando…",
  "save.saved": "Salvo.",
  "save.pendingOne": "Ainda não salvo: 1 mudança",
  "save.pending": "Ainda não salvo: {n} mudanças",
  "key.head": "Chave do tracker",
  "key.lead":
    "A chave da sua própria aliança no tracker (Last Asylum Tracker). Os esquadrões do tracker são lidos com ela e gastam só a cota desta chave.",
  "key.set": "Chave salva, termina em ••••{last4}",
  "key.state.ok": "Funcionando.",
  "key.state.invalid":
    "O tracker recusou esta chave. Os esquadrões ficam pausados até você trocá-la.",
  "key.state.out_of_quota":
    "Sem cota hoje. Os esquadrões voltam depois do reinício do tracker às 00:00 UTC.",
  "key.state.reenter":
    "Esta chave precisa ser informada de novo. A configuração de segurança do site mudou, então a chave salva não pode mais ser lida. Cole-a de novo em Configurações da aliança.",
  "key.state.site":
    "Ainda sem chave. Seus esquadrões são lidos com a chave do site até você adicionar a sua.",
  "key.state.none":
    "Ainda sem chave. Os esquadrões do tracker ficam desligados até você adicionar uma.",
  "key.state.off":
    "As chaves do tracker ainda não estão configuradas neste site. Fale com o dono do site.",
  "key.quota": "Cota restante: {n}",
  "key.checked": "Verificada {when}",
  "key.label": "Sua chave do tracker",
  "key.help":
    "Começa com lap_. Ao salvar, ela é testada com uma chamada na cota desta chave. Fica guardada criptografada e nunca é mostrada de novo.",
  "key.get": "Ainda não tem chave?",
  "key.getLink": "Pegue a sua no tracker",
  "key.save": "Salvar e testar",
  "key.saving": "Testando a chave…",
  "key.replace": "Trocar",
  "key.remove": "Remover",
  "key.cancel": "Cancelar",
  "key.removeAsk": "Remover a chave do tracker?",
  "key.removeMore": "Os esquadrões do tracker deixam de usá-la na hora.",
  "key.keep": "Manter",
  "key.bad": "Isto não é uma chave do tracker. Ela começa com lap_.",
  "key.refused": "O tracker recusou esta chave. Confira e tente de novo.",
  "key.unreachable": "O tracker não respondeu. Tente de novo em um minuto.",
  "key.failed": "Não foi possível salvar. Tente de novo.",
  "key.rateLimited": "Muitos testes de chave agora há pouco. Espere 15 minutos e tente de novo.",
  "key.saved": "Chave salva e testada.",
  "key.removed": "Chave removida.",
  "key.card.add": "Adicione sua chave do tracker",
  "key.card.fix": "Sua chave do tracker precisa de você",
  "key.card.none": "Os esquadrões do tracker precisam da chave da sua própria aliança.",
  "key.card.site":
    "Por enquanto seus esquadrões são lidos com a chave do site. Adicione a chave da sua aliança.",
  "key.card.reenter":
    "Esta chave precisa ser informada de novo. A configuração de segurança do site mudou, então a chave salva não pode mais ser lida. Cole-a de novo em Configurações da aliança.",
  "key.card.invalid": "O tracker recusou sua chave, então os esquadrões estão pausados. Troque-a.",
  "key.card.out_of_quota":
    "Sua chave está sem cota hoje. Os esquadrões voltam depois do reinício às 00:00 UTC.",
  "key.card.where":
    "Para pegar uma chave: entre com o Patreon na página da API do tracker e crie uma; ela começa com lap_. A conta grátis tem 1.000 chamadas por dia, o apoio pago 2.000.",
  "key.card.whereLink": "Abrir a página da API do tracker",
  "activity.key.set": "{who} atualizou a chave do tracker",
  "activity.key.removed": "{who} removeu a chave do tracker",
  "squads.today":
    "Esquadrões hoje: {read} de {members} lidos · {retrying} esperando nova tentativa",
  "squads.todayNext": "próxima tentativa às {at} ST",
  "squads.todayNone":
    "Esquadrões hoje: ainda não começou. Eles são lidos depois da atualização diária.",
  "squads.todayStopped": "Esquadrões hoje: {read} de {members} lidos · parado: {why}",
  "squads.todayStoppedNone": "Esquadrões hoje: parado: {why}",
  "squads.stop.key": "o tracker recusou a chave",
  "squads.stop.limit": "o limite foi atingido até 00:00 UTC",
  "squads.stop.cap": "as 120 leituras de hoje foram usadas",
  // D129: Alliance settings → Discord.
  ...discordPt,
  ...invitePt,
  ...chooserPt,
  ...calloutsPt,
  ...glossaryPt,
  ...postsPt,
  ...pushPt,
};

export const settingsFr: typeof settingsEn = {
  "settings.link": "Réglages de l’alliance",
  "settings.title": "Réglages de l’alliance",
  "settings.saveModel":
    "Chaque carte s’enregistre avec son propre bouton. Les notifications ne valent que pour cet appareil.",
  "settings.index": "Sur cette page",
  "settings.index.attention": "À vérifier",
  "settings.state.key.ok": "Fonctionne",
  "settings.state.key.invalid": "Refusée",
  "settings.state.key.out_of_quota": "Plus de quota aujourd’hui",
  "settings.state.key.reenter": "À recoller",
  "settings.state.key.none": "Pas de clé",
  "settings.state.key.site": "Clé du site",
  "settings.state.key.off": "Désactivée sur ce site",
  "settings.state.features": "{on} sur {allowed} activées",
  "settings.state.shieldOn": "Résumé sur Discord : activé",
  "settings.state.shieldOff": "Résumé sur Discord : désactivé",
  "settings.state.channels": "{set} salons sur {n} configurés",
  "settings.state.botOff": "commandes arrêtées sur ce site",
  "settings.state.deletion": "Suppression demandée : {date}",
  "save.button": "Enregistrer",
  "save.saving": "Enregistrement…",
  "save.saved": "Enregistré.",
  "save.pendingOne": "Pas encore enregistré : 1 modification",
  "save.pending": "Pas encore enregistré : {n} modifications",
  "key.head": "Clé du tracker",
  "key.lead":
    "La clé de votre alliance sur le tracker (Last Asylum Tracker). Les escouades du tracker sont lues avec elle et ne dépensent que le quota de cette clé.",
  "key.set": "Clé enregistrée, se termine par ••••{last4}",
  "key.state.ok": "Elle fonctionne.",
  "key.state.invalid":
    "Le tracker a refusé cette clé. Les escouades sont en pause jusqu’à ce que vous la remplaciez.",
  "key.state.out_of_quota":
    "Plus de quota aujourd’hui. Les escouades reprennent après la remise à zéro du tracker à 00:00 UTC.",
  "key.state.reenter":
    "Cette clé doit être saisie à nouveau. Le réglage de sécurité du site a changé, la clé enregistrée ne peut donc plus être lue. Collez-la à nouveau dans Réglages de l’alliance.",
  "key.state.site":
    "Pas encore de clé. Vos escouades sont lues avec la clé du site jusqu’à ce que vous ajoutiez la vôtre.",
  "key.state.none":
    "Pas encore de clé. Les escouades du tracker restent coupées jusqu’à ce que vous en ajoutiez une.",
  "key.state.off":
    "Les clés du tracker ne sont pas encore configurées sur ce site. Demandez au propriétaire du site.",
  "key.quota": "Quota restant : {n}",
  "key.checked": "Vérifiée {when}",
  "key.label": "Votre clé du tracker",
  "key.help":
    "Elle commence par lap_. L’enregistrer la teste avec un appel sur le quota de cette clé. Elle est stockée chiffrée et n’est plus jamais affichée.",
  "key.get": "Pas encore de clé ?",
  "key.getLink": "Obtenez la vôtre sur le tracker",
  "key.save": "Enregistrer et tester",
  "key.saving": "Test de la clé…",
  "key.replace": "Remplacer",
  "key.remove": "Retirer",
  "key.cancel": "Annuler",
  "key.removeAsk": "Retirer la clé du tracker ?",
  "key.removeMore": "Les escouades du tracker cessent aussitôt de l’utiliser.",
  "key.keep": "La garder",
  "key.bad": "Ce n’est pas une clé du tracker. Elle commence par lap_.",
  "key.refused": "Le tracker a refusé cette clé. Vérifiez-la et réessayez.",
  "key.unreachable": "Le tracker n’a pas répondu. Réessayez dans une minute.",
  "key.failed": "Enregistrement impossible. Réessayez.",
  "key.rateLimited": "Trop de tests de clé à l’instant. Attendez 15 minutes, puis réessayez.",
  "key.saved": "Clé enregistrée et testée.",
  "key.removed": "Clé retirée.",
  "key.card.add": "Ajoutez votre clé du tracker",
  "key.card.fix": "Votre clé du tracker a besoin de vous",
  "key.card.none": "Les escouades du tracker ont besoin de la clé de votre alliance.",
  "key.card.site":
    "Vos escouades sont lues avec la clé du site pour l’instant. Ajoutez la clé de votre alliance.",
  "key.card.reenter":
    "Cette clé doit être saisie à nouveau. Le réglage de sécurité du site a changé, la clé enregistrée ne peut donc plus être lue. Collez-la à nouveau dans Réglages de l’alliance.",
  "key.card.invalid":
    "Le tracker a refusé votre clé, les escouades sont donc en pause. Remplacez-la.",
  "key.card.out_of_quota":
    "Votre clé n’a plus de quota aujourd’hui. Les escouades reprennent après la remise à zéro à 00:00 UTC.",
  "key.card.where":
    "Pour obtenir une clé : connectez-vous avec Patreon sur la page API du tracker et créez-en une ; elle commence par lap_. Un compte gratuit a 1 000 appels par jour, un abonnement payant 2 000.",
  "key.card.whereLink": "Ouvrir la page API du tracker",
  "activity.key.set": "{who} a mis à jour la clé du tracker",
  "activity.key.removed": "{who} a retiré la clé du tracker",
  "squads.today":
    "Escouades aujourd’hui : {read} sur {members} lues · {retrying} en attente d’un nouvel essai",
  "squads.todayNext": "prochain essai à {at} ST",
  "squads.todayStopped": "Escouades aujourd’hui : {read} sur {members} lues · arrêté : {why}",
  "squads.todayStoppedNone": "Escouades aujourd’hui : arrêté : {why}",
  "squads.stop.key": "le tracker a refusé la clé",
  "squads.stop.limit": "la limite est atteinte jusqu’à 00:00 UTC",
  "squads.stop.cap": "les 120 lectures du jour sont utilisées",
  "squads.todayNone":
    "Escouades aujourd’hui : pas encore commencé. Elles sont lues après la mise à jour quotidienne.",
  // D129: Alliance settings → Discord.
  ...discordFr,
  ...inviteFr,
  ...chooserFr,
  ...calloutsFr,
  ...glossaryFr,
  ...postsFr,
  ...pushFr,
};
