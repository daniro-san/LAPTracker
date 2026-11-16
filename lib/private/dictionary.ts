// The workspace's own words in English, Brazilian Portuguese and French (D71, issue #305): separate from
// lib/copy.ts, so the public pages' i18n check and payload do not change. Names and game terms stay as the
// officers write them (naming.md). French puts a no-break space before : ? and !.
export const WORKSPACE_LANGUAGES = ["en", "pt-BR", "fr"] as const;
export type WorkspaceLanguage = (typeof WORKSPACE_LANGUAGES)[number];
/** Written by the EN · PT · FR switch; read on the server. */
export const WORKSPACE_LANG_COOKIE = "lap_ws_lang";

const en = {
  "app.name": "Officers’ Desk",
  "tab.aria": "Sections",
  "tab.home": "Home",
  "tab.members": "Members",
  "tab.mark": "Roll call",
  "tab.days": "Calendar",
  "tab.review": "Follow-up",
  "tab.soon": "Soon",
  "lang.aria": "Language",
  "signin.title": "Sign in",
  "signin.lead":
    "For the alliance’s leadership: sign in with the Discord account you use in the alliance’s server.",
  "signin.button": "Sign in with Discord",
  "signin.note":
    "Discord tells us your name and your roles in that server. Nothing else, and nothing is posted.",
  "signin.e.denied": "Discord did not confirm the sign-in. Try again.",
  "signin.e.discord": "Discord did not answer. Try again in a minute.",
  "signin.e.not_configured": "Sign-in is not set up yet. The site owner has to finish it first.",
  "noaccess.title": "No access",
  "noaccess.not_member":
    "This Discord account is not in the alliance’s Discord server. Join the server, or sign in with the account you use there.",
  "noaccess.no_role":
    "This Discord account does not have a leadership role in the alliance’s server. Ask an R5 to give you the role, then sign in again.",
  "noaccess.allowlist_expired":
    "Your access was for a limited time, and that time is over. Ask the site owner to extend it.",
  "noaccess.blocked": "This account has been removed from this workspace.",
  "noaccess.retry": "Sign in again",
  "noaccess.public": "Go to the public Event Ledger",
  "shell.signedIn": "Signed in as {name}",
  "shell.signOut": "Sign out",
  "home.title": "This week",
  "home.empty": "Nothing here yet. The kettle is on.",
  "home.next":
    "Coming next: the Members tab, with every member’s might, donations and activity from the game.",
} as const;

export type WorkspaceKey = keyof typeof en;
export type WorkspaceDictionary = Record<WorkspaceKey, string>;

const pt: WorkspaceDictionary = {
  "app.name": "Mesa dos oficiais",
  "tab.aria": "Seções",
  "tab.home": "Início",
  "tab.members": "Membros",
  "tab.mark": "Chamada",
  "tab.days": "Agenda",
  "tab.review": "Atenção",
  "tab.soon": "Em breve",
  "lang.aria": "Idioma",
  "signin.title": "Entrar",
  "signin.lead":
    "Para a liderança da aliança: entre com a conta do Discord que você usa no servidor da aliança.",
  "signin.button": "Entrar com o Discord",
  "signin.note":
    "O Discord nos informa seu nome e seus cargos nesse servidor. Nada mais, e nada é publicado.",
  "signin.e.denied": "O Discord não confirmou a entrada. Tente de novo.",
  "signin.e.discord": "O Discord não respondeu. Tente de novo em um minuto.",
  "signin.e.not_configured":
    "A entrada ainda não está configurada. O dono do site precisa concluir isso primeiro.",
  "noaccess.title": "Sem acesso",
  "noaccess.not_member":
    "Esta conta do Discord não está no servidor da aliança. Entre no servidor ou use a conta que você usa lá.",
  "noaccess.no_role":
    "Esta conta do Discord não tem um cargo de liderança no servidor da aliança. Peça a um R5 que lhe dê o cargo e entre de novo.",
  "noaccess.allowlist_expired":
    "Seu acesso era por tempo limitado, e esse tempo acabou. Peça ao dono do site que o prolongue.",
  "noaccess.blocked": "Esta conta foi removida deste espaço.",
  "noaccess.retry": "Entrar de novo",
  "noaccess.public": "Ir para o Registro de eventos público",
  "shell.signedIn": "Conectado como {name}",
  "shell.signOut": "Sair",
  "home.title": "Esta semana",
  "home.empty": "Nada aqui ainda. A chaleira está no fogo.",
  "home.next":
    "A seguir: a aba Membros, com o might, as doações e a atividade de cada membro, vindos do jogo.",
};

const fr: WorkspaceDictionary = {
  "app.name": "Bureau des officiers",
  "tab.aria": "Sections",
  "tab.home": "Accueil",
  "tab.members": "Membres",
  "tab.mark": "Appel",
  "tab.days": "Agenda",
  "tab.review": "À suivre",
  "tab.soon": "Bientôt",
  "lang.aria": "Langue",
  "signin.title": "Connexion",
  "signin.lead":
    "Pour la direction de l’alliance : connectez-vous avec le compte Discord que vous utilisez sur le serveur de l’alliance.",
  "signin.button": "Se connecter avec Discord",
  "signin.note":
    "Discord nous donne votre nom et vos rôles sur ce serveur. Rien d’autre, et rien n’est publié.",
  "signin.e.denied": "Discord n’a pas confirmé la connexion. Réessayez.",
  "signin.e.discord": "Discord n’a pas répondu. Réessayez dans une minute.",
  "signin.e.not_configured":
    "La connexion n’est pas encore configurée. Le propriétaire du site doit d’abord la terminer.",
  "noaccess.title": "Pas d’accès",
  "noaccess.not_member":
    "Ce compte Discord n’est pas sur le serveur Discord de l’alliance. Rejoignez le serveur, ou connectez-vous avec le compte que vous y utilisez.",
  "noaccess.no_role":
    "Ce compte Discord n’a pas de rôle de direction sur le serveur de l’alliance. Demandez le rôle à un R5, puis reconnectez-vous.",
  "noaccess.allowlist_expired":
    "Votre accès était limité dans le temps, et ce temps est écoulé. Demandez au propriétaire du site de le prolonger.",
  "noaccess.blocked": "Ce compte a été retiré de cet espace.",
  "noaccess.retry": "Se reconnecter",
  "noaccess.public": "Aller au Registre des événements public",
  "shell.signedIn": "Connecté en tant que {name}",
  "shell.signOut": "Se déconnecter",
  "home.title": "Cette semaine",
  "home.empty": "Rien ici pour l’instant. La bouilloire est sur le feu.",
  "home.next":
    "Ensuite : l’onglet Membres, avec la might, les dons et l’activité de chaque membre, venus du jeu.",
};

export const WORKSPACE_DICTIONARIES: Record<WorkspaceLanguage, WorkspaceDictionary> = {
  en,
  "pt-BR": pt,
  fr,
};

const BASE: Record<string, WorkspaceLanguage> = { en: "en", pt: "pt-BR", fr: "fr" };

/** The switch's cookie, else the first Accept-Language tag in one of the three, else English. */
export function pickWorkspaceLanguage(
  cookie: string | undefined,
  acceptLanguage: string | null,
): WorkspaceLanguage {
  if (WORKSPACE_LANGUAGES.includes(cookie as WorkspaceLanguage)) return cookie as WorkspaceLanguage;
  const tags = (acceptLanguage ?? "").split(",").map((t) => t.split(";")[0]?.trim().toLowerCase());
  for (const tag of tags) {
    const language = BASE[tag?.split("-")[0] ?? ""];
    if (language) return language;
  }
  return "en";
}
