// Follow-up's "Needs help" words (issue 585, slice 2) in English, Brazilian Portuguese and French: the group,
// since when and who added the mark, the officer's note in quotes, last week's context and the way out. People
// first (D75): a mark is "added", never "flagged" or "signalé"; last week is context, never "again". A
// no-break space sits inside French quotes and before : ; ! ?.
export const followUpHelpEn = {
  "followup.group.help": "Needs help · {n}",
  "followup.group.helpHint":
    "They stay here each week until someone taps their name, then “No longer needs help”.",
  "followup.mark.by": "Since {date} · added by {who}",
  "followup.mark.at": "Since {date}",
  "followup.quote": "“{note}”",
  "followup.last": "Last week: {line}",
  "followup.helpDone": "No longer needs help",
  "followup.helpCleared": "Saved. {name} no longer needs help.",
} as const;

type HelpWords = Record<keyof typeof followUpHelpEn, string>;

export const followUpHelpPt: HelpWords = {
  "followup.group.help": "Precisa de ajuda · {n}",
  "followup.group.helpHint":
    "Ficam aqui toda semana até alguém tocar no nome e depois em “Não precisa mais de ajuda”.",
  "followup.mark.by": "Desde {date} · marcado por {who}",
  "followup.mark.at": "Desde {date}",
  "followup.quote": "“{note}”",
  "followup.last": "Semana passada: {line}",
  "followup.helpDone": "Não precisa mais de ajuda",
  "followup.helpCleared": "Salvo. {name} não precisa mais de ajuda.",
};

export const followUpHelpFr: HelpWords = {
  "followup.group.help": "Besoin d’aide · {n}",
  "followup.group.helpHint":
    "Ces membres restent ici chaque semaine jusqu’à ce que quelqu’un touche leur nom, puis « N’a plus besoin d’aide ».",
  "followup.mark.by": "Depuis {date} · indiqué par {who}",
  "followup.mark.at": "Depuis {date}",
  "followup.quote": "« {note} »",
  "followup.last": "Semaine dernière : {line}",
  "followup.helpDone": "N’a plus besoin d’aide",
  "followup.helpCleared": "Enregistré. {name} n’a plus besoin d’aide.",
};
