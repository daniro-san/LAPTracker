// Alliance settings → Notifications (D148) in English, Brazilian Portuguese and French: one module the settings
// dictionary spreads. Each officer turns notifications on for their own device. The notifications' own words
// are in lib/copy-push.ts (the tick sends them, outside lib/private). French puts a no-break space before :.
export const pushEn = {
  "push.head": "Notifications",
  "push.lead":
    "Get a notification on this phone or computer when something needs an officer. Each officer turns it on for their own devices.",
  "push.use.shield": "Raid Shield check",
  "push.use.shield.help":
    "After Friday’s and Saturday’s reads: how many members were not seen with a shield yet.",
  "push.use.night_read": "Night roster read failed",
  "push.use.night_read.help": "When tonight’s roster read fails, also on its retry.",
  "push.use.claim": "“This is me” to approve",
  "push.use.claim.help": "When a member asks to link their player.",
  "push.use.roll_call": "Roll call reminders",
  "push.use.roll_call.help":
    "When a Calendar roll call opens, and in its last hours if anyone is still not set.",
  "push.private":
    "Notifications show on the lock screen, so they hold counts only, never a member’s name.",
  "push.enable": "Enable on this device",
  "push.disable": "Turn off on this device",
  "push.on": "On for this device.",
  "push.off": "Off for this device.",
  "push.saved": "Saved.",
  "push.failed": "Not saved. Try again.",
  "push.blocked":
    "Notifications are blocked for this site. Allow them in your browser’s or phone’s settings, then tap “Enable on this device” again.",
  "push.unsupported": "This browser can’t show notifications from the desk.",
  "push.ios":
    "iPhone and iPad: open the desk in Safari, tap Share, then Add to Home Screen. Open the desk from that icon and turn notifications on here.",
  "push.android":
    "Android: Chrome asks once. If you said no, allow notifications in the site’s settings (the icon beside the address).",
  "push.session":
    "They come while you are signed in to the desk. A sign-in lasts up to 7 days; opening the desk again keeps them coming.",
};

export const pushPt: Record<keyof typeof pushEn, string> = {
  "push.head": "Notificações",
  "push.lead":
    "Receba uma notificação neste celular ou computador quando algo precisar de um oficial. Cada oficial ativa nos próprios aparelhos.",
  "push.use.shield": "Conferência do Escudo de raid",
  "push.use.shield.help":
    "Depois das leituras de sexta e de sábado: quantos membros ainda estão sem escudo visto.",
  "push.use.night_read": "Leitura noturna da lista falhou",
  "push.use.night_read.help":
    "Quando a leitura da lista desta noite falha, também na nova tentativa.",
  "push.use.claim": "“Este sou eu” para aprovar",
  "push.use.claim.help": "Quando um membro pede para vincular o jogador dele.",
  "push.use.roll_call": "Lembretes de chamada",
  "push.use.roll_call.help":
    "Quando uma chamada do Calendário abre, e nas últimas horas dela se alguém ainda estiver sem marcação.",
  "push.private":
    "As notificações aparecem na tela de bloqueio, então trazem só números, nunca o nome de um membro.",
  "push.enable": "Ativar neste aparelho",
  "push.disable": "Desativar neste aparelho",
  "push.on": "Ativadas neste aparelho.",
  "push.off": "Desativadas neste aparelho.",
  "push.saved": "Salvo.",
  "push.failed": "Não foi salvo. Tente de novo.",
  "push.blocked":
    "As notificações estão bloqueadas para este site. Permita nas configurações do navegador ou do celular e toque em “Ativar neste aparelho” de novo.",
  "push.unsupported": "Este navegador não consegue mostrar notificações da mesa.",
  "push.ios":
    "iPhone e iPad: abra a mesa no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início. Abra a mesa por esse ícone e ative as notificações aqui.",
  "push.android":
    "Android: o Chrome pergunta uma vez. Se você disse não, permita as notificações nas configurações do site (o ícone ao lado do endereço).",
  "push.session":
    "Elas chegam enquanto você está conectado à mesa. O login dura até 7 dias; abrir a mesa de novo mantém as notificações chegando.",
};

export const pushFr: Record<keyof typeof pushEn, string> = {
  "push.head": "Notifications",
  "push.lead":
    "Recevez une notification sur ce téléphone ou cet ordinateur quand quelque chose demande un officier. Chaque officier l’active sur ses propres appareils.",
  "push.use.shield": "Vérification du Bouclier de raid",
  "push.use.shield.help":
    "Après les lectures de vendredi et de samedi : combien de membres n’ont pas encore de bouclier vu.",
  "push.use.night_read": "Échec de la lecture de nuit",
  "push.use.night_read.help":
    "Quand la lecture de la liste de ce soir échoue, aussi lors de sa nouvelle tentative.",
  "push.use.claim": "« C’est moi » à approuver",
  "push.use.claim.help": "Quand un membre demande à lier son joueur.",
  "push.use.roll_call": "Rappels d’appel",
  "push.use.roll_call.help":
    "Quand un appel du Calendrier s’ouvre, et dans ses dernières heures si quelqu’un est encore sans marque.",
  "push.private":
    "Les notifications s’affichent sur l’écran verrouillé : elles ne donnent que des nombres, jamais le nom d’un membre.",
  "push.enable": "Activer sur cet appareil",
  "push.disable": "Désactiver sur cet appareil",
  "push.on": "Activées sur cet appareil.",
  "push.off": "Désactivées sur cet appareil.",
  "push.saved": "Enregistré.",
  "push.failed": "Non enregistré. Réessayez.",
  "push.blocked":
    "Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur ou du téléphone, puis touchez « Activer sur cet appareil » à nouveau.",
  "push.unsupported": "Ce navigateur ne peut pas afficher les notifications du bureau.",
  "push.ios":
    "iPhone et iPad : ouvrez le bureau dans Safari, touchez Partager, puis Sur l’écran d’accueil. Ouvrez le bureau depuis cette icône et activez les notifications ici.",
  "push.android":
    "Android : Chrome demande une fois. Si vous avez refusé, autorisez les notifications dans les réglages du site (l’icône à côté de l’adresse).",
  "push.session":
    "Elles arrivent tant que vous êtes connecté au bureau. Une connexion dure jusqu’à 7 jours ; rouvrir le bureau les fait continuer.",
};
