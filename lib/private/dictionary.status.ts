// The desk's read status bar (D135, issue 478) in English, Brazilian Portuguese and French: one module
// `dictionary.squads.ts` spreads. Counts and server times only, never a member. A member the tracker
// did not answer for is one "the tracker missed": the tracker's gap, never the member's (D75). Each line
// starts with what and how far ("Squads: 43 of 101 read"), so the 360 px bar's one cut line still says
// it. The stop reasons reuse Alliance settings' "squads.stop.*" words; the reset is said as Home's key
// card says it, 00:00 UTC, with its server time.
export const statusEn = {
  "status.label": "Reads from the tracker",
  "status.more": "+{n} more",
  "status.squads.running": "Squads: {read} of {members} read so far · started {at} ST",
  "status.squads.waiting": "Squads: {read} of {members} read · {retrying} to try again at {at} ST",
  "status.squads.pausedEvent": "Squads paused at {read} of {members} · they go on after the event",
  "status.squads.pausedMargin":
    "Squads paused at {read} of {members} · tracker calls are kept for other reads",
  "status.squads.done": "Squads: {read} of {members} read · updated at {at} ST",
  "status.squads.doneMissed":
    "Squads: {read} of {members} read · the tracker missed {failed} · updated at {at} ST",
  "status.squads.limit":
    "Squads paused at {read} of {members} · today’s tracker limit is reached · it resets at 00:00 UTC ({at} ST)",
  "status.squads.stopped": "Squads stopped at {read} of {members} · {why}",
  "status.squads.skipped": "Squads not read today: {why}",
  "status.why.quotaUnknown": "tracker limit unknown",
  "status.why.other": "the tracker did not answer",
  "status.roster.failed": "Today’s daily update failed · the cards keep the last numbers",
  "status.roster.late": "Today’s daily update is late · the cards keep the last numbers",
  "status.roster.squadsWait": "squads wait for it",
  "status.key.invalid": "Tracker key refused · paste a new key in Alliance settings",
  "status.key.reenter": "Tracker key: paste it again in Alliance settings",
  "status.key.link": "Open Alliance settings",
  // D137: the Raid Shield check.
  "status.shield.running": "Checking Raid Shields · {read} of {members} · started {at} ST",
  "status.shield.done": "Raid Shield check {at} ST · {on} of {members} seen with a shield",
};

export const statusPt: typeof statusEn = {
  "status.label": "Leituras do tracker",
  "status.more": "+{n} mais",
  "status.squads.running": "Esquadrões: {read} de {members} lidos até agora · começou às {at} ST",
  "status.squads.waiting":
    "Esquadrões: {read} de {members} lidos · {retrying} para tentar de novo às {at} ST",
  "status.squads.pausedEvent":
    "Esquadrões pausados em {read} de {members} · continuam depois do evento",
  "status.squads.pausedMargin":
    "Esquadrões pausados em {read} de {members} · as chamadas do tracker ficam para outras leituras",
  "status.squads.done": "Esquadrões: {read} de {members} lidos · atualizados às {at} ST",
  "status.squads.doneMissed":
    "Esquadrões: {read} de {members} lidos · o tracker não leu {failed} · atualizados às {at} ST",
  "status.squads.limit":
    "Esquadrões pausados em {read} de {members} · o limite de hoje do tracker foi atingido · ele volta às 00:00 UTC ({at} ST)",
  "status.squads.stopped": "Esquadrões parados em {read} de {members} · {why}",
  "status.squads.skipped": "Esquadrões não lidos hoje: {why}",
  "status.why.quotaUnknown": "limite do tracker desconhecido",
  "status.why.other": "o tracker não respondeu",
  "status.roster.failed":
    "A atualização diária de hoje falhou · os cartões mostram os últimos números",
  "status.roster.late":
    "A atualização diária de hoje está atrasada · os cartões mostram os últimos números",
  "status.roster.squadsWait": "os esquadrões esperam por ela",
  "status.key.invalid":
    "Chave do tracker recusada · cole uma chave nova em Configurações da aliança",
  "status.key.reenter": "Chave do tracker: cole-a de novo em Configurações da aliança",
  "status.key.link": "Abrir Configurações da aliança",
  // D137: the Raid Shield check.
  "status.shield.running":
    "Conferindo os Escudos de raid · {read} de {members} · começou às {at} ST",
  "status.shield.done":
    "Conferência do Escudo de raid {at} ST · {on} de {members} com escudo visto",
};

export const statusFr: typeof statusEn = {
  "status.label": "Lectures du tracker",
  "status.more": "+{n} de plus",
  "status.squads.running":
    "Escouades : {read} sur {members} lues pour l’instant · commencé à {at} ST",
  "status.squads.waiting":
    "Escouades : {read} sur {members} lues · {retrying} à réessayer à {at} ST",
  "status.squads.pausedEvent":
    "Escouades en pause à {read} sur {members} · elles reprennent après l’événement",
  "status.squads.pausedMargin":
    "Escouades en pause à {read} sur {members} · les appels au tracker sont gardés pour d’autres lectures",
  "status.squads.done": "Escouades : {read} sur {members} lues · mises à jour à {at} ST",
  "status.squads.doneMissed":
    "Escouades : {read} sur {members} lues · le tracker en a manqué {failed} · mises à jour à {at} ST",
  "status.squads.limit":
    "Escouades en pause à {read} sur {members} · la limite du tracker est atteinte pour aujourd’hui · elle repart à 00:00 UTC ({at} ST)",
  "status.squads.stopped": "Escouades arrêtées à {read} sur {members} · {why}",
  "status.squads.skipped": "Escouades non lues aujourd’hui : {why}",
  "status.why.quotaUnknown": "limite du tracker inconnue",
  "status.why.other": "le tracker n’a pas répondu",
  "status.roster.failed":
    "La mise à jour quotidienne d’aujourd’hui a échoué · les cartes gardent les derniers chiffres",
  "status.roster.late":
    "La mise à jour quotidienne d’aujourd’hui est en retard · les cartes gardent les derniers chiffres",
  "status.roster.squadsWait": "les escouades l’attendent",
  "status.key.invalid":
    "Clé du tracker refusée · collez une nouvelle clé dans Réglages de l’alliance",
  "status.key.reenter": "Clé du tracker : collez-la à nouveau dans Réglages de l’alliance",
  "status.key.link": "Ouvrir Réglages de l’alliance",
  // D137: the Raid Shield check.
  "status.shield.running":
    "Vérification des Boucliers de raid · {read} sur {members} · commencée à {at} ST",
  "status.shield.done":
    "Vérification du Bouclier de raid {at} ST · {on} sur {members} avec un bouclier vu",
};
