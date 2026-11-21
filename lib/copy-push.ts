// The officers' browser notifications (D148), in the language the desk had on the device when it was turned
// on. Sent by the tick and by routes after their answer, outside lib/private, so the words live here. They
// show on lock screens: counts and a link only, never a member's name, uid or any private field. People
// first (D75): "not seen yet" is a hint about the tracker's map scan, and "not set" is an officer's task,
// never a mark against a member. French puts a no-break space before : and ?.
import type { PushLanguage } from "./schema-push";

export interface PushWords {
  shieldTitle: string;
  /** "{read}": the night check or the morning check, from `fri` / `sat` (issue 585's one vocabulary). */
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
    fri: "Night check",
    sat: "Morning check",
    nightTitle: "Roster read failed",
    nightBody:
      "The read and its retry failed. Nothing to do: the desk keeps the last numbers and reads again tomorrow.",
    claimTitle: "“This is me” to approve",
    claimBody: "A member asked to link their player. {n} waiting in To review.",
    rollTitle: "Roll call: {name}",
    rollOpen: "Open now. Tap to mark who took part.",
    rollOpenShield: "Open now. Tap to check shields before KvK.",
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
    shieldNone: "{read}: todos os membros lidos foram vistos com escudo.",
    fri: "Conferência da noite",
    sat: "Conferência da manhã",
    nightTitle: "A leitura da lista falhou",
    nightBody:
      "A leitura e a nova tentativa falharam. Nada a fazer: a mesa mantém os últimos números e lê de novo amanhã.",
    claimTitle: "“Este sou eu” para aprovar",
    claimBody: "Um membro indicou qual jogador é. {n} aguardando em Para revisar.",
    rollTitle: "Chamada: {name}",
    rollOpen: "Aberta agora. Toque para marcar quem participou.",
    rollOpenShield: "Aberta agora. Toque para conferir os escudos antes do KvK.",
    rollLeft: "{n} ainda sem marca. Toque para abrir a chamada.",
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
      "{read} : pas encore de bouclier vu pour {n}. Touchez pour vérifier dans la Préparation du raid.",
    shieldNone: "{read} : tous les membres lus ont été vus avec un bouclier.",
    fri: "Vérification du soir",
    sat: "Vérification du matin",
    nightTitle: "La lecture de la liste a échoué",
    nightBody:
      "La lecture et sa nouvelle tentative ont échoué. Rien à faire : le bureau garde les derniers chiffres et relit demain.",
    claimTitle: "« C’est moi » à approuver",
    claimBody: "Un membre a choisi son joueur. {n} en attente dans À vérifier.",
    rollTitle: "Appel : {name}",
    rollOpen: "Ouvert maintenant. Touchez pour marquer qui a participé.",
    rollOpenShield: "Ouvert maintenant. Touchez pour ouvrir la Préparation du raid avant le KvK.",
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
