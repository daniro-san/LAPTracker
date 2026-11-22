// What a member tells their officers about themselves (D154, issue 301) in English, Brazilian Portuguese and
// French: the form on the member's own page, and the officers' side (the member card and Home's To review).
// Spread by dictionary.board.ts. The two kinds of value are never written alike: the member's is "Member
// says", the card's is "On the card"; "Put on the card" changes the card, "Mark seen" does not (persona
// panel, 2026-11-22). French puts a no-break space before : ; ! and ?.
export const selfReportEn = {
  "self.head": "Tell your officers",
  "self.lead":
    "Your Alliance Duel tech, your time zone and the languages you read. Your officers see what you send on your member card and decide what goes on it.",
  "self.empty":
    "After you send, what you sent shows under each field. Your officers may already know it: send what is new or changed.",
  "self.adTech": "Alliance Duel tech (AD Tech), in %",
  "self.adBad": "Write a number from 0 to 100.",
  "self.timeZone": "Your time zone",
  "self.phoneZone": "Use this phone’s time zone ({zone})",
  "self.clearZone": "Clear",
  "self.languages": "Languages you read",
  "self.send": "Send to your officers",
  "self.sending": "Sending…",
  "self.sent": "Sent. Your officers see it on your member card.",
  "self.nothing": "Nothing new to send yet.",
  "self.state.sent": "You sent this on {day} · not seen yet",
  "self.state.seen": "You sent this on {day} · an officer has seen it",
  "self.state.took": "You took back what you sent, on {day} · not seen yet",
  "self.state.tookSeen": "You took back what you sent, on {day} · an officer has seen it",
  "self.takeBack":
    "To take something back, empty it and send. That does not change your card by itself: your officers decide.",
  "self.changed": "You changed this on another phone or tab. This shows what was saved there.",
  "self.tooMany": "You have sent a lot today. Try again tomorrow.",
  "self.failed": "Could not send. Try again.",
  "self.card.head": "Sent by the member",
  "self.card.says": "Member says: {value}",
  "self.card.took": "Member took back what they sent",
  "self.card.sent": "Self-reported · {day}",
  "self.card.new": "New",
  "self.card.onCard": "On the card: {value}",
  "self.card.same": "Same as on the card.",
  "self.card.use": "Put on the card",
  "self.card.seen": "Seen, keep the card",
  "self.card.seenHint": "“Seen, keep the card” leaves the card as it is.",
  "self.card.used": "Put on the card.",
  "self.card.marked": "Seen. The card stays as it is.",
  "self.card.changed": "The member sent something new since you opened the card. Look again.",
  "self.card.conflict": "Another officer saved {field} since you opened the card. Look again.",
  "self.card.info": "Member says: {value} · {day} · not on the card",
  "self.home": "{player} sent their own info: {fields}",
  "self.card.onCardNone": "On the card: nothing yet",
  "self.notSent": "Not sent yet: {n}",
  "self.notSent.one": "1 change",
  "self.notSent.other": "{n} changes",
  "src.member": "from the member",
  // D125's download README: the file of what members sent (D154).
  "data.file.member-self-reports":
    "What members sent about themselves from their own page, the newest per field (version: their sends; seen_version: the send an officer last saw). Not on the card unless an officer put it there.",
} as const;

export type SelfReportWords = Record<keyof typeof selfReportEn, string>;

export const selfReportPt: SelfReportWords = {
  "self.head": "Conte aos seus oficiais",
  "self.lead":
    "Sua tecnologia do Duelo de Aliança, seu fuso horário e os idiomas que você lê. Os oficiais veem o que você envia no seu cartão de membro e decidem o que entra nele.",
  "self.empty":
    "Depois de enviar, o que você enviou aparece embaixo de cada campo. Os oficiais talvez já saibam: envie o que é novo ou mudou.",
  "self.adTech": "Tecnologia do Duelo de Aliança (AD Tech), em %",
  "self.adBad": "Escreva um número de 0 a 100.",
  "self.timeZone": "Seu fuso horário",
  "self.phoneZone": "Usar o fuso deste celular ({zone})",
  "self.clearZone": "Limpar",
  "self.languages": "Idiomas que você lê",
  "self.send": "Enviar aos oficiais",
  "self.sending": "Enviando…",
  "self.sent": "Enviado. Os oficiais veem isso no seu cartão de membro.",
  "self.nothing": "Ainda não há nada novo para enviar.",
  "self.state.sent": "Você enviou em {day} · ainda não visto",
  "self.state.seen": "Você enviou em {day} · um oficial já viu",
  "self.state.took": "Você retirou o que tinha enviado, em {day} · ainda não visto",
  "self.state.tookSeen": "Você retirou o que tinha enviado, em {day} · um oficial já viu",
  "self.takeBack":
    "Para retirar algo, deixe o campo vazio e envie. Isso não muda o seu cartão sozinho: os oficiais decidem.",
  "self.changed": "Você mudou isso em outro celular ou aba. Aqui está o que foi salvo lá.",
  "self.tooMany": "Você já enviou muitas vezes hoje. Tente de novo amanhã.",
  "self.failed": "Não deu para enviar. Tente de novo.",
  "self.card.head": "Enviado pelo membro",
  "self.card.says": "O membro diz: {value}",
  "self.card.took": "O membro retirou o que tinha enviado",
  "self.card.sent": "Enviado pelo membro · {day}",
  "self.card.new": "Novo",
  "self.card.onCard": "No cartão: {value}",
  "self.card.same": "Igual ao cartão.",
  "self.card.use": "Pôr no cartão",
  "self.card.seen": "Visto, manter o cartão",
  "self.card.seenHint": "“Visto, manter o cartão” deixa o cartão como está.",
  "self.card.used": "Posto no cartão.",
  "self.card.marked": "Visto. O cartão fica como está.",
  "self.card.changed": "O membro enviou algo novo desde que você abriu o cartão. Veja de novo.",
  "self.card.conflict": "Outro oficial salvou {field} desde que você abriu o cartão. Veja de novo.",
  "self.card.info": "O membro diz: {value} · {day} · não está no cartão",
  "self.home": "{player} enviou os próprios dados: {fields}",
  "self.card.onCardNone": "No cartão: nada ainda",
  "self.notSent": "Ainda não enviado: {n}",
  "self.notSent.one": "1 mudança",
  "self.notSent.other": "{n} mudanças",
  "src.member": "do membro",
  // D125's download README: the file of what members sent (D154).
  "data.file.member-self-reports":
    "O que os membros enviaram sobre si pela própria página, o mais recente de cada campo (version: os envios; seen_version: o envio que um oficial viu por último). Só está no cartão se um oficial o pôs lá.",
};

export const selfReportFr: SelfReportWords = {
  "self.head": "Dites-le à vos officiers",
  "self.lead":
    "Votre tech du Duel d’alliance, votre fuseau horaire et les langues que vous lisez. Vos officiers voient ce que vous envoyez sur votre fiche de membre et décident de ce qu’elle contient.",
  "self.empty":
    "Une fois envoyé, ce que vous avez envoyé s’affiche sous chaque champ. Vos officiers le savent peut-être déjà : envoyez ce qui est nouveau ou a changé.",
  "self.adTech": "Tech du Duel d’alliance (AD Tech), en %",
  "self.adBad": "Écrivez un nombre de 0 à 100.",
  "self.timeZone": "Votre fuseau horaire",
  "self.phoneZone": "Utiliser le fuseau de ce téléphone ({zone})",
  "self.clearZone": "Effacer",
  "self.languages": "Langues que vous lisez",
  "self.send": "Envoyer à vos officiers",
  "self.sending": "Envoi…",
  "self.sent": "Envoyé. Vos officiers le voient sur votre fiche de membre.",
  "self.nothing": "Rien de nouveau à envoyer pour l’instant.",
  "self.state.sent": "Envoyé le {day} · pas encore vu",
  "self.state.seen": "Envoyé le {day} · un officier l’a vu",
  "self.state.took": "Vous avez retiré ce que vous aviez envoyé, le {day} · pas encore vu",
  "self.state.tookSeen": "Vous avez retiré ce que vous aviez envoyé, le {day} · un officier l’a vu",
  "self.takeBack":
    "Pour retirer quelque chose, videz le champ et envoyez. Votre fiche ne change pas pour autant : vos officiers décident.",
  "self.changed":
    "Vous l’avez changé sur un autre téléphone ou onglet. Voici ce qui y a été enregistré.",
  "self.tooMany": "Vous avez beaucoup envoyé aujourd’hui. Réessayez demain.",
  "self.failed": "Envoi impossible. Réessayez.",
  "self.card.head": "Envoyé par le membre",
  "self.card.says": "Le membre dit : {value}",
  "self.card.took": "Le membre a retiré ce qu’il avait envoyé",
  "self.card.sent": "Déclaré par le membre · {day}",
  "self.card.new": "Nouveau",
  "self.card.onCard": "Sur la fiche : {value}",
  "self.card.same": "Identique à la fiche.",
  "self.card.use": "Mettre sur la fiche",
  "self.card.seen": "Vu, garder la fiche",
  "self.card.seenHint": "« Vu, garder la fiche » laisse la fiche telle quelle.",
  "self.card.used": "Mis sur la fiche.",
  "self.card.marked": "Vu. La fiche reste telle quelle.",
  "self.card.changed":
    "Le membre a envoyé du nouveau depuis que vous avez ouvert la fiche. Regardez à nouveau.",
  "self.card.conflict":
    "Un autre officier a enregistré {field} depuis que vous avez ouvert la fiche. Regardez à nouveau.",
  "self.card.info": "Le membre dit : {value} · {day} · pas sur la fiche",
  "self.home": "{player} a envoyé ses propres infos : {fields}",
  "self.card.onCardNone": "Sur la fiche : rien pour l’instant",
  "self.notSent": "Pas encore envoyé : {n}",
  "self.notSent.one": "1 changement",
  "self.notSent.other": "{n} changements",
  "src.member": "du membre",
  // D125's download README: the file of what members sent (D154).
  "data.file.member-self-reports":
    "Ce que les membres ont envoyé sur eux-mêmes depuis leur page, le plus récent par champ (version : leurs envois ; seen_version : l’envoi qu’un officier a vu en dernier). Pas sur la fiche sauf si un officier l’y a mis.",
};

/** The words the member card's block takes, sent with the card. */
const CARD_KEYS = [
  "self.card.head",
  "self.card.says",
  "self.card.took",
  "self.card.new",
  "self.card.same",
  "self.card.onCardNone",
  "self.card.use",
  "self.card.seen",
  "self.card.seenHint",
  "self.card.used",
  "self.card.marked",
  "self.card.changed",
  "self.card.conflict",
] as const;
export type SelfReportCardWords = Record<(typeof CARD_KEYS)[number], string>;

export const selfReportCardWords = (t: SelfReportWords): SelfReportCardWords =>
  Object.fromEntries(CARD_KEYS.map((k) => [k, t[k]])) as SelfReportCardWords;

/** The words the member's form takes (the member's own keys), sent to the page once. */
export const selfReportWords = (t: SelfReportWords): SelfReportWords =>
  Object.fromEntries(
    Object.keys(selfReportEn).map((k) => [k, t[k as keyof SelfReportWords]]),
  ) as SelfReportWords;
