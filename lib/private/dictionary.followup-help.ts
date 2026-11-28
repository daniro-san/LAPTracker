// Follow-up's "Needs help" words (issue 585, slice 2) in English, Brazilian Portuguese and French: the group,
// since when and who added the mark, the officer's note in quotes, last week's context and the way out. People
// first (D75): a mark is "added", never "flagged" or "signalé"; last week is context, never "again". Slice 5:
// "After KvK, offer help", an offer, never a miss; no number beside a name (D139), and no "note" (in French
// "noter" reads as "to grade"). A no-break space sits inside French quotes and before : ; ! ?.
export const followUpHelpEn = {
  "followup.group.help": "Needs help · {n}",
  "followup.group.helpHint":
    "They stay here each week until someone taps their name, then “No longer needs help”.",
  "followup.mark.by": "Since {date} · added by {who}",
  "followup.mark.at": "Since {date}",
  "followup.quote": "“{note}”",
  "followup.last": "Recorded last week: {line}",
  "followup.helpDone": "No longer needs help",
  "followup.helpCleared": "Saved. {name} no longer needs help.",
  "followup.group.kvk": "After KvK, offer help · {n}",
  "followup.group.kvkHint":
    "Lost over a quarter of their might in the KvK of {date}, and still below 80% of what they had. Here for the week after it, or until someone writes down what they said.",
  "followup.reason.kvk": "Still rebuilding after the KvK of {date}.",
  "followup.kvk.jump.one": "{n} to offer help after the KvK ↓",
  "followup.kvk.jump.other": "{n} to offer help after the KvK ↓",
  "insights.kvk.help.followUp": "Offer help:",
  "insights.kvk.help.followUpLink": "Follow-up ›",
} as const;

type HelpWords = Record<keyof typeof followUpHelpEn, string>;

export const followUpHelpPt: HelpWords = {
  "followup.group.help": "Precisa de ajuda · {n}",
  "followup.group.helpHint":
    "Ficam aqui toda semana até alguém tocar no nome e depois em “Não precisa mais de ajuda”.",
  "followup.mark.by": "Desde {date} · marcado por {who}",
  "followup.mark.at": "Desde {date}",
  "followup.quote": "“{note}”",
  "followup.last": "Registrado na semana passada: {line}",
  "followup.helpDone": "Não precisa mais de ajuda",
  "followup.helpCleared": "Salvo. {name} não precisa mais de ajuda.",
  "followup.group.kvk": "Depois da KvK, ofereça ajuda · {n}",
  "followup.group.kvkHint":
    "Perderam mais de um quarto do poder na KvK de {date} e continuam abaixo de 80% do que tinham. Ficam aqui na semana seguinte, ou até alguém anotar o que a pessoa disse.",
  "followup.reason.kvk": "Ainda se recuperando da KvK de {date}.",
  "followup.kvk.jump.one": "{n} para oferecer ajuda depois da KvK ↓",
  "followup.kvk.jump.other": "{n} para oferecer ajuda depois da KvK ↓",
  "insights.kvk.help.followUp": "Oferecer ajuda:",
  "insights.kvk.help.followUpLink": "Acompanhar ›",
};

export const followUpHelpFr: HelpWords = {
  "followup.group.help": "Besoin d’aide · {n}",
  "followup.group.helpHint":
    "Ces membres restent ici chaque semaine jusqu’à ce que quelqu’un touche leur nom, puis « N’a plus besoin d’aide ».",
  "followup.mark.by": "Depuis {date} · indiqué par {who}",
  "followup.mark.at": "Depuis {date}",
  "followup.quote": "« {note} »",
  "followup.last": "Enregistré la semaine dernière : {line}",
  "followup.helpDone": "N’a plus besoin d’aide",
  "followup.helpCleared": "Enregistré. {name} n’a plus besoin d’aide.",
  "followup.group.kvk": "Après la KvK, proposer de l’aide · {n}",
  "followup.group.kvkHint":
    "Ont perdu plus d’un quart de leur puissance à la KvK du {date} et restent sous 80 % de ce qu’ils avaient. Ici pendant la semaine qui suit, ou jusqu’à ce que quelqu’un écrive ce qu’ils ont dit.",
  "followup.reason.kvk": "Se remet encore de la KvK du {date}.",
  "followup.kvk.jump.one": "{n} personne à qui proposer de l’aide après la KvK ↓",
  "followup.kvk.jump.other": "{n} personnes à qui proposer de l’aide après la KvK ↓",
  "insights.kvk.help.followUp": "Proposer de l’aide :",
  "insights.kvk.help.followUpLink": "À suivre ›",
};
