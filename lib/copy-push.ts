// The officers' browser notifications (D148), in the language the desk had on the device when it was turned
// on. Sent by the tick and by routes after their answer, outside lib/private, so the words live here. They
// show on lock screens: counts and a link only, never a member's name, uid or any private field. People
// first (D75): "not seen yet" is a hint about the tracker's map scan, and "not set" is an officer's task,
// never a mark against a member. French puts a no-break space before : and ?.
import type { PushLanguage } from "./schema-push";

export interface PushWords {
  shieldTitle: string;
  /** "{read}": Friday's or Saturday's read, from `fri` / `sat`. */
  shieldSome: string;
  shieldNone: string;
  fri: string;
  sat: string;
  nightTitle: string;
  nightBody: string;
  claimTitle: string;
  claimBody: string;
  rollTitle: string;
  rollOpen: string;
  rollOpenShield: string;
  rollLeft: string;
  /** A roll call's name by its kind ("{team}": an Elixir Scramble team, A or B). */
  kinds: { shield: string; raid: string; elixir: string; cheese: string; plunder: string };
}

export const PUSH_WORDS: Record<PushLanguage, PushWords> = {
  en: {
    shieldTitle: "Raid Shield check",
    shieldSome: "{read}: {n} not seen with a shield yet. Tap to review in Raid prep.",
    shieldNone: "{read}: every member read was seen with a shield.",
    fri: "Friday’s read",
    sat: "Saturday’s read",
    nightTitle: "Roster read failed",
    nightBody:
      "Tonight’s roster read failed, and so did its retry. The desk keeps the last numbers. Tap for the status.",
    claimTitle: "“This is me” to approve",
    claimBody: "A member asked to link their player. {n} waiting in To review.",
    rollTitle: "Roll call: {name}",
    rollOpen: "{n} to mark. Tap to open the roll call.",
    rollOpenShield: "{n} to check before KvK. Tap to open Raid prep.",
    rollLeft: "{n} still not set. Tap to open the roll call.",
    kinds: {
      shield: "Raid prep",
      raid: "Undead Siege",
      elixir: "Elixir Scramble {team}",
      cheese: "Cheese Trap",
      plunder: "Plunders",
    },
  },
  "pt-BR": {
    shieldTitle: "Conferência do Escudo de raid",
    shieldSome: "{read}: {n} ainda sem escudo visto. Toque para revisar na Preparação do raid.",
    shieldNone: "{read}: todos os membros lidos estavam com escudo visto.",
    fri: "Leitura de sexta",
    sat: "Leitura de sábado",
    nightTitle: "A leitura da lista falhou",
    nightBody:
      "A leitura da lista desta noite falhou, e a nova tentativa também. A mesa mostra os últimos números. Toque para ver o status.",
    claimTitle: "“Este sou eu” para aprovar",
    claimBody: "Um membro pediu para vincular o jogador dele. {n} esperando em Para revisar.",
    rollTitle: "Chamada: {name}",
    rollOpen: "{n} para marcar. Toque para abrir a chamada.",
    rollOpenShield: "{n} para conferir antes do KvK. Toque para abrir a Preparação do raid.",
    rollLeft: "{n} ainda sem marcação. Toque para abrir a chamada.",
    kinds: {
      shield: "Preparação do raid",
      raid: "Undead Siege",
      elixir: "Elixir Scramble {team}",
      cheese: "Cheese Trap",
      plunder: "Saques",
    },
  },
  fr: {
    shieldTitle: "Vérification du Bouclier de raid",
    shieldSome:
      "{read} : {n} sans bouclier vu pour l’instant. Touchez pour vérifier dans Préparation du raid.",
    shieldNone: "{read} : chaque membre lu avait un bouclier vu.",
    fri: "Lecture de vendredi",
    sat: "Lecture de samedi",
    nightTitle: "La lecture de la liste a échoué",
    nightBody:
      "La lecture de la liste de ce soir a échoué, et sa nouvelle tentative aussi. Le bureau garde les derniers chiffres. Touchez pour voir l’état.",
    claimTitle: "« C’est moi » à approuver",
    claimBody: "Un membre a demandé à lier son joueur. {n} en attente dans À vérifier.",
    rollTitle: "Appel : {name}",
    rollOpen: "{n} à marquer. Touchez pour ouvrir l’appel.",
    rollOpenShield: "{n} à vérifier avant le KvK. Touchez pour ouvrir Préparation du raid.",
    rollLeft: "{n} toujours sans marque. Touchez pour ouvrir l’appel.",
    kinds: {
      shield: "Préparation du raid",
      raid: "Undead Siege",
      elixir: "Elixir Scramble {team}",
      cheese: "Cheese Trap",
      plunder: "Pillages",
    },
  },
};

/** "{n} waiting" with its values. */
export const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
