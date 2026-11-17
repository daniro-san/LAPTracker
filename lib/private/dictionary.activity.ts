// Home's "On the desk now" and "Recent activity" (D108) in English, Brazilian Portuguese and French: one
// module that the three workspace dictionaries spread. Lines say who worked on what, never a member's
// values or a note; no counts per officer, no list of who is away (D75). French puts a no-break space
// before : and inside « ».
export const activityEn = {
  "desk.now": "On the desk now",
  "desk.alone": "Nobody else right now.",
  "activity.head": "Recent activity",
  "activity.none": "Nothing in the last two weeks.",
  "activity.more": "Show more",
  "activity.facts": "{who} updated {member}’s info",
  "activity.factsSomeone": "{who} updated a member’s info",
  "activity.factsMany": "{who} updated the info of {n} members",
  "activity.noticeSaved": "{who} saved the notice “{title}”",
  "activity.noticePosted": "{who} posted the notice “{title}” on Discord",
  "activity.draft": "{who} saved a screenshot: {kind}",
  "activity.entry": "{who} added “{entry}” to the Calendar",
  "activity.marks": "{who} marked the roll call “{call}”",
  "activity.marksRest": "{who} marked the rest of the roll call “{call}”",
  "activity.followUp": "{who} added a follow-up note for {member}",
  "activity.followUpSomeone": "{who} added a follow-up note",
  "activity.thefts.one": "{who} added a theft to the log",
  "activity.thefts.other": "{who} added {n} thefts to the log",
  "activity.newMember": "{who} added the new member {member}",
};

type ActivityWords = Record<keyof typeof activityEn, string>;

export const activityPt: ActivityWords = {
  "desk.now": "Na mesa agora",
  "desk.alone": "Ninguém mais agora.",
  "activity.head": "Atividade recente",
  "activity.none": "Nada nas últimas duas semanas.",
  "activity.more": "Mostrar mais",
  "activity.facts": "{who} atualizou as informações de {member}",
  "activity.factsSomeone": "{who} atualizou as informações de um membro",
  "activity.factsMany": "{who} atualizou as informações de {n} membros",
  "activity.noticeSaved": "{who} salvou o aviso “{title}”",
  "activity.noticePosted": "{who} publicou o aviso “{title}” no Discord",
  "activity.draft": "{who} salvou um print: {kind}",
  "activity.entry": "{who} adicionou “{entry}” à Agenda",
  "activity.marks": "{who} marcou a chamada “{call}”",
  "activity.marksRest": "{who} marcou o restante da chamada “{call}”",
  "activity.followUp": "{who} anotou um acompanhamento de {member}",
  "activity.followUpSomeone": "{who} anotou um acompanhamento",
  "activity.thefts.one": "{who} registrou um roubo",
  "activity.thefts.other": "{who} registrou {n} roubos",
  "activity.newMember": "{who} adicionou o novo membro {member}",
};

export const activityFr: ActivityWords = {
  "desk.now": "Au bureau maintenant",
  "desk.alone": "Personne d’autre pour l’instant.",
  "activity.head": "Activité récente",
  "activity.none": "Rien ces deux dernières semaines.",
  "activity.more": "Voir plus",
  "activity.facts": "{who} a mis à jour les infos de {member}",
  "activity.factsSomeone": "{who} a mis à jour les infos d’un membre",
  "activity.factsMany": "{who} a mis à jour les infos de {n} membres",
  "activity.noticeSaved": "{who} a enregistré l’annonce « {title} »",
  "activity.noticePosted": "{who} a publié l’annonce « {title} » sur Discord",
  "activity.draft": "{who} a enregistré une capture : {kind}",
  "activity.entry": "{who} a ajouté « {entry} » à l’agenda",
  "activity.marks": "{who} a fait l’appel « {call} »",
  "activity.marksRest": "{who} a marqué le reste de l’appel « {call} »",
  "activity.followUp": "{who} a noté un suivi pour {member}",
  "activity.followUpSomeone": "{who} a noté un suivi",
  "activity.thefts.one": "{who} a ajouté un vol au registre",
  "activity.thefts.other": "{who} a ajouté {n} vols au registre",
  "activity.newMember": "{who} a ajouté le nouveau membre {member}",
};
