// The ready messages of Follow-up (issue 460, D140), written to the member in their own language: fixed
// sentences put together by lib/private/ready-message.ts, never a translation request. English, Brazilian
// Portuguese and French. People first (D75): a hello, never a complaint; a missing fact is a question.
// Plain apostrophes, since the text is pasted into the game's mail; French keeps its no-break space
// before ! ? : and a narrow one in 1 000.
export const READY_MESSAGE = {
  en: {
    hello: "Hey {name}!",
    welcome: "Hey {name}, welcome to the alliance! Glad to have you.",
    idle: "How are things going? All good on your side?",
    might: "How's the game going? Need a hand with anything?",
    kvk: "How did KvK go for you? Anything we can help with?",
    coins: "Small tip: helping alliance mates gives you Alliance Help coins, up to 1,000 a day.",
    ask: "Quick one for the alliance sheet: could you tell me your {list}?",
    squadMight: "main squad might",
    troopTier: "troop tier",
    adTech: "AD Tech",
    timeZone: "time zone",
    languages: "languages",
    and: "and",
    easy: "Just checking in 🙂",
    thanks: "Thanks! 🙂",
    fun: "Have fun! 🙂",
  },
  "pt-BR": {
    hello: "Oi {name}!",
    welcome: "Oi {name}, que bom ter você na aliança!",
    idle: "Como estão as coisas? Tudo certo por aí?",
    might: "Como vai o jogo? Precisa de uma mão com algo?",
    kvk: "Como foi o KvK para você? Podemos ajudar com algo?",
    coins:
      "Uma dica: ajudar os colegas da aliança dá moedas de Ajuda da aliança, até 1.000 por dia.",
    ask: "Uma rapidinha para a planilha da aliança: pode me passar {list}?",
    squadMight: "o might do esquadrão principal",
    troopTier: "o tier das tropas",
    adTech: "a AD Tech",
    timeZone: "o fuso horário",
    languages: "os idiomas que você fala",
    and: "e",
    easy: "Só passando para saber de você 🙂",
    thanks: "Valeu! 🙂",
    fun: "Bom jogo! 🙂",
  },
  fr: {
    hello: "Salut {name} !",
    welcome: "Salut {name}, bienvenue dans l'alliance ! Contents de t'avoir avec nous.",
    idle: "Comment ça va de ton côté ? Tout se passe bien ?",
    might: "Comment ça se passe dans le jeu ? Besoin d'un coup de main ?",
    kvk: "Comment s'est passé le KvK pour toi ? On peut t'aider ?",
    coins:
      "Petite astuce : aider les membres de l'alliance rapporte des pièces d'Aide d'alliance, jusqu'à 1 000 par jour.",
    ask: "Petite question pour le tableau de l'alliance : tu peux me donner {list} ?",
    squadMight: "ton might d'escouade principale",
    troopTier: "ton niveau de troupes",
    adTech: "ton AD Tech",
    timeZone: "ton fuseau horaire",
    languages: "les langues que tu parles",
    and: "et",
    easy: "Je prends juste des nouvelles 🙂",
    thanks: "Merci ! 🙂",
    fun: "Bon jeu ! 🙂",
  },
} as const;

export type ReadyWords = Record<keyof (typeof READY_MESSAGE)["en"], string>;
