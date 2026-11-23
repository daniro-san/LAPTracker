// "Send feedback" (D157, issue 713) in English, Brazilian Portuguese and French: the button at the end of the
// desk's and the board's pages, and its sheet. Collect only: the sheet says the owner reads it without the
// sender's name and does not reply. French puts a no-break space before : ; ! and ?.
export const feedbackEn = {
  "feedback.open": "Send feedback",
  "feedback.badge": "Feedback",
  "feedback.lead":
    "An idea, a problem, or something that works well: tell the people who make this site, not your officers. They read it without your name and do not reply.",
  "feedback.kind": "What is it about?",
  "feedback.kind.idea": "Idea",
  "feedback.kind.problem": "Problem",
  "feedback.kind.good": "Something good",
  "feedback.pickKind": "Choose what it is about first.",
  "feedback.text": "Your message",
  "feedback.limit": "Up to 1,000 characters. Leave out members’ map positions and online times.",
  "feedback.count": "{n} of {max} characters",
  "feedback.picture": "Picture (optional)",
  "feedback.picture.add": "Add a picture",
  "feedback.picture.remove": "Remove the picture",
  "feedback.picture.hint":
    "One picture. Leave out screens that show members’ map positions or online times.",
  "feedback.picture.preparing": "Preparing the picture…",
  "feedback.picture.unusable": "This picture could not be used. Try another one.",
  "feedback.picture.alt": "The picture you chose",
  "feedback.send": "Send",
  "feedback.sending": "Sending…",
  "feedback.received": "Received, thank you.",
  "feedback.tooMany": "You have sent a lot today. Try again tomorrow.",
  "feedback.failed": "Could not send. Try again.",
  "feedback.website": "Website",
};

export type FeedbackWords = Record<keyof typeof feedbackEn, string>;

export const feedbackPt: FeedbackWords = {
  "feedback.open": "Enviar feedback",
  "feedback.badge": "Feedback",
  "feedback.lead":
    "Uma ideia, um problema ou algo que funciona bem: conte a quem faz este site, não aos seus oficiais. Eles leem sem o seu nome e não respondem.",
  "feedback.kind": "Sobre o que é?",
  "feedback.kind.idea": "Ideia",
  "feedback.kind.problem": "Problema",
  "feedback.kind.good": "Algo bom",
  "feedback.pickKind": "Escolha antes sobre o que é.",
  "feedback.text": "Sua mensagem",
  "feedback.limit":
    "Até 1.000 caracteres. Não inclua posições no mapa nem horários online de membros.",
  "feedback.count": "{n} de {max} caracteres",
  "feedback.picture": "Imagem (opcional)",
  "feedback.picture.add": "Adicionar uma imagem",
  "feedback.picture.remove": "Remover a imagem",
  "feedback.picture.hint":
    "Uma imagem. Não envie telas que mostrem posições no mapa ou horários online de membros.",
  "feedback.picture.preparing": "Preparando a imagem…",
  "feedback.picture.unusable": "Não foi possível usar esta imagem. Tente outra.",
  "feedback.picture.alt": "A imagem que você escolheu",
  "feedback.send": "Enviar",
  "feedback.sending": "Enviando…",
  "feedback.received": "Recebido, obrigado.",
  "feedback.tooMany": "Você já enviou muito hoje. Tente de novo amanhã.",
  "feedback.failed": "Não foi possível enviar. Tente de novo.",
  "feedback.website": "Site",
};

export const feedbackFr: FeedbackWords = {
  "feedback.open": "Envoyer un retour",
  "feedback.badge": "Retour",
  "feedback.lead":
    "Une idée, un problème ou quelque chose qui marche bien : dites-le aux personnes qui font ce site, pas à vos officiers. Elles le lisent sans votre nom et ne répondent pas.",
  "feedback.kind": "C’est à propos de quoi ?",
  "feedback.kind.idea": "Idée",
  "feedback.kind.problem": "Problème",
  "feedback.kind.good": "Quelque chose de bien",
  "feedback.pickKind": "Choisissez d’abord de quoi il s’agit.",
  "feedback.text": "Votre message",
  "feedback.limit":
    "Jusqu’à 1 000 caractères. N’indiquez pas la position sur la carte ni les heures de connexion des membres.",
  "feedback.count": "{n} sur {max} caractères",
  "feedback.picture": "Image (facultative)",
  "feedback.picture.add": "Ajouter une image",
  "feedback.picture.remove": "Retirer l’image",
  "feedback.picture.hint":
    "Une image. N’envoyez pas d’écran qui montre la position sur la carte ou les heures de connexion des membres.",
  "feedback.picture.preparing": "Préparation de l’image…",
  "feedback.picture.unusable": "Cette image ne peut pas être utilisée. Essayez-en une autre.",
  "feedback.picture.alt": "L’image que vous avez choisie",
  "feedback.send": "Envoyer",
  "feedback.sending": "Envoi…",
  "feedback.received": "Reçu, merci.",
  "feedback.tooMany": "Vous avez beaucoup envoyé aujourd’hui. Réessayez demain.",
  "feedback.failed": "Envoi impossible. Réessayez.",
  "feedback.website": "Site web",
};

/** The sheet's own words, with the sheet frame's (Close, Cancel, "Discard your changes?"). */
export const feedbackWords = <T extends FeedbackWords>(t: T): FeedbackWords =>
  Object.fromEntries(
    Object.keys(feedbackEn).map((k) => [k, t[k as keyof FeedbackWords]]),
  ) as FeedbackWords;
