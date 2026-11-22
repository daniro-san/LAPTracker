// "Send feedback" (D155, issue 713) in English, Brazilian Portuguese and French: the button at the end of the
// desk's and the board's pages, and its sheet. Collect only: the sheet says the owner reads it without the
// sender's name and does not reply. French puts a no-break space before : ; ! and ?.
export const feedbackEn = {
  "feedback.open": "Send feedback",
  "feedback.lead":
    "An idea, a problem, or something that works well: tell the site owner. They read it without your name and do not reply.",
  "feedback.kind": "What is it about?",
  "feedback.kind.idea": "Idea",
  "feedback.kind.problem": "Problem",
  "feedback.kind.good": "Something good",
  "feedback.text": "Your message",
  "feedback.limit": "Up to 1,000 characters. Leave out members’ map positions and online times.",
  "feedback.count": "{n} of {max} characters",
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
  "feedback.lead":
    "Uma ideia, um problema ou algo que funciona bem: conte ao dono do site. Ele lê sem o seu nome e não responde.",
  "feedback.kind": "Sobre o que é?",
  "feedback.kind.idea": "Ideia",
  "feedback.kind.problem": "Problema",
  "feedback.kind.good": "Algo bom",
  "feedback.text": "Sua mensagem",
  "feedback.limit":
    "Até 1.000 caracteres. Não inclua posições no mapa nem horários online de membros.",
  "feedback.count": "{n} de {max} caracteres",
  "feedback.send": "Enviar",
  "feedback.sending": "Enviando…",
  "feedback.received": "Recebido, obrigado.",
  "feedback.tooMany": "Você já enviou muito hoje. Tente de novo amanhã.",
  "feedback.failed": "Não foi possível enviar. Tente de novo.",
  "feedback.website": "Site",
};

export const feedbackFr: FeedbackWords = {
  "feedback.open": "Donner votre avis",
  "feedback.lead":
    "Une idée, un problème ou quelque chose qui marche bien : dites-le au propriétaire du site. Il le lit sans votre nom et ne répond pas.",
  "feedback.kind": "C’est à propos de quoi ?",
  "feedback.kind.idea": "Idée",
  "feedback.kind.problem": "Problème",
  "feedback.kind.good": "Quelque chose de bien",
  "feedback.text": "Votre message",
  "feedback.limit":
    "Jusqu’à 1 000 caractères. N’indiquez pas la position sur la carte ni les heures de connexion des membres.",
  "feedback.count": "{n} sur {max} caractères",
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
