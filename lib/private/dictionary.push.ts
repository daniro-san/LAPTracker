// Alliance settings → Notifications (D148) in English, Brazilian Portuguese and French: one module the settings
// dictionary spreads. Each officer turns notifications on for their own device. The notifications' own words
// are in lib/copy-push.ts (the tick sends them, outside lib/private). Also Home's one-time hint that points to
// the card. French puts a no-break space before : and inside « ».
export const pushEn = {
  "push.head": "Notifications",
  "push.lead":
    "Get a notification on this phone or computer when something needs an officer. Each officer turns it on for their own devices.",
  "push.use.shield": "Raid Shield check",
  "push.use.shield.help":
    "After Friday’s and Saturday’s reads: how many members were not seen with a shield yet.",
  "push.use.night_read": "Night roster read failed",
  "push.use.night_read.help":
    "When tonight’s roster read fails, also on its retry. Nothing to do then: off unless you want to know.",
  "push.use.claim": "“This is me” to approve",
  "push.use.claim.help": "When a member asks to link their player.",
  "push.use.roll_call": "Roll call reminders",
  "push.use.roll_call.help":
    "When a Calendar roll call opens, and again about a day later if anyone is still not set.",
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
  "push.iosTab":
    "On iPhone and iPad, notifications work only when the desk is opened from its Home Screen icon (see below).",
  "push.ios":
    "iPhone and iPad: open the desk in Safari, tap Share (or ••• → Share), then Add to Home Screen. Open the desk from that icon, then open Alliance settings → Notifications.",
  "push.iosSignIn":
    "The Home Screen icon may ask you to sign in with Discord once more: it keeps its own sign-in.",
  "push.android":
    "Android: Chrome asks once. If you said no, allow notifications in the site’s settings (the icon beside the address).",
  "push.session":
    "They come while you are signed in to the desk. A sign-in lasts 7 days; after that, sign in again and they come back.",
  "push.hint": "Get notifications on this phone",
  "push.hintLink": "Alliance settings",
  "push.hintClose": "Hide",
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
    "Quando a leitura da lista desta noite falha, também na nova tentativa. Não há nada a fazer: desligado, a não ser que você queira saber.",
  "push.use.claim": "“Este sou eu” para aprovar",
  "push.use.claim.help": "Quando um membro indica qual jogador é.",
  "push.use.roll_call": "Lembretes de chamada",
  "push.use.roll_call.help":
    "Quando uma chamada do Calendário abre, e de novo cerca de um dia depois se alguém ainda estiver sem marca.",
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
  "push.iosTab":
    "No iPhone e no iPad, as notificações só funcionam quando a mesa é aberta pelo ícone na Tela de Início (veja abaixo).",
  "push.ios":
    "iPhone e iPad: abra a mesa no Safari, toque em Compartilhar (ou ••• → Compartilhar) e depois em Adicionar à Tela de Início. Abra a mesa por esse ícone e depois abra Configurações da aliança → Notificações.",
  "push.iosSignIn":
    "O ícone da Tela de Início pode pedir para entrar com o Discord mais uma vez: ele tem o próprio login.",
  "push.android":
    "Android: o Chrome pergunta uma vez. Se você disse não, permita as notificações nas configurações do site (o ícone ao lado do endereço).",
  "push.session":
    "Elas chegam enquanto você está conectado à mesa. O login vale por 7 dias; depois, entre de novo e elas voltam.",
  "push.hint": "Receba notificações neste celular",
  "push.hintLink": "Configurações da aliança",
  "push.hintClose": "Ocultar",
};

export const pushFr: Record<keyof typeof pushEn, string> = {
  "push.head": "Notifications",
  "push.lead":
    "Recevez une notification sur ce téléphone ou cet ordinateur quand quelque chose attend un officier. Chaque officier l’active sur ses propres appareils.",
  "push.use.shield": "Vérification du Bouclier de raid",
  "push.use.shield.help":
    "Après les lectures de vendredi et de samedi : combien de membres n’ont pas encore de bouclier vu.",
  "push.use.night_read": "Échec de la lecture de nuit",
  "push.use.night_read.help":
    "Quand la lecture de la liste de ce soir échoue, aussi lors de sa nouvelle tentative. Rien à faire alors : désactivé, sauf si vous voulez le savoir.",
  "push.use.claim": "« C’est moi » à approuver",
  "push.use.claim.help": "Quand un membre choisit son joueur.",
  "push.use.roll_call": "Rappels d’appel",
  "push.use.roll_call.help":
    "Quand un appel du Calendrier s’ouvre, et de nouveau environ un jour plus tard si quelqu’un est encore sans marque.",
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
  "push.iosTab":
    "Sur iPhone et iPad, les notifications ne marchent que si le bureau est ouvert depuis son icône sur l’écran d’accueil (voir plus bas).",
  "push.ios":
    "iPhone et iPad : ouvrez le bureau dans Safari, touchez Partager (ou ••• → Partager), puis Sur l’écran d’accueil. Ouvrez le bureau depuis cette icône, puis Réglages de l’alliance → Notifications.",
  "push.iosSignIn":
    "L’icône de l’écran d’accueil peut vous demander de vous connecter avec Discord une fois de plus : elle garde sa propre connexion.",
  "push.android":
    "Android : Chrome demande une fois. Si vous avez refusé, autorisez les notifications dans les réglages du site (l’icône à côté de l’adresse).",
  "push.session":
    "Elles arrivent tant que vous êtes connecté au bureau. Une connexion dure 7 jours ; reconnectez-vous ensuite pour les recevoir à nouveau.",
  "push.hint": "Recevez les notifications sur ce téléphone",
  "push.hintLink": "Réglages de l’alliance",
  "push.hintClose": "Masquer",
};
