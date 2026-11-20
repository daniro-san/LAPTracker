// What a stale Discord command says when the site's owner turned it off for the alliance, and what the desk
// and the commands say when the alliance's daily limit is used up (D126), in English, Brazilian Portuguese
// and French: one module the three workspace dictionaries spread. A feature turned off is otherwise simply
// not there, with no line about it (D126 amendment, issue 483).
// French puts a no-break space before : and inside « ». Alliance settings' own switches (D134) come with it.
import { switchesEn, switchesFr, switchesPt } from "./dictionary.switches";

export const featuresEn = {
  ...switchesEn,
  "features.off.command": "This command is turned off for your alliance.",
  "features.cap.ai":
    "This alliance’s daily limit for writing help is used up. It resets at 00:00 UTC.",
  "features.cap.translate":
    "This alliance’s daily limit for translations is used up. It resets at 00:00 UTC.",
};

export const featuresPt: typeof featuresEn = {
  ...switchesPt,
  "features.off.command": "Este comando está desligado para a sua aliança.",
  "features.cap.ai":
    "O limite diário desta aliança para a ajuda para escrever acabou. Ele volta às 00:00 UTC.",
  "features.cap.translate":
    "O limite diário desta aliança para traduções acabou. Ele volta às 00:00 UTC.",
};

export const featuresFr: typeof featuresEn = {
  ...switchesFr,
  "features.off.command": "Cette commande est désactivée pour votre alliance.",
  "features.cap.ai":
    "La limite du jour de cette alliance pour l’aide à la rédaction est atteinte. Elle repart à 00:00 UTC.",
  "features.cap.translate":
    "La limite du jour de cette alliance pour les traductions est atteinte. Elle repart à 00:00 UTC.",
};
