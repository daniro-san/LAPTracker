// The thefts log's warning message (issue 321, D97 amended 2026-11-19): a few plain sentences an officer
// pastes into in-game mail to a player of our own server who took from our members. The player's language
// is not known, so the message is made in English, Portuguese and French at once, whatever the officer's
// own language. Polite and factual (D75): what was reported, that we share a server, and what to do instead.
import { fill } from "../copy";

export const WARNING_LANGUAGES = ["en", "pt-BR", "fr"] as const;
export type WarningLanguage = (typeof WARNING_LANGUAGES)[number];

const TEXT: Record<
  WarningLanguage,
  { hello: string; one: string; other: string; onDay: string; lastDay: string; ask: string }
> = {
  en: {
    hello: "Hello {name}, this is the leadership of [{tag}].",
    one: "One of our members reported a theft by you.",
    other: "Our members reported {n} thefts by you.",
    onDay: "It was on {day} (server time).",
    lastDay: "The last one was on {day} (server time).",
    ask: "We are on the same server, #{server}. Please take from the enemy server in KvK, not from players of your own server. Thank you.",
  },
  "pt-BR": {
    hello: "Olá, {name}. Aqui é a liderança da [{tag}].",
    one: "Um dos nossos membros relatou um roubo seu.",
    other: "Nossos membros relataram {n} roubos seus.",
    onDay: "Foi em {day} (horário do servidor).",
    lastDay: "O último foi em {day} (horário do servidor).",
    ask: "Estamos no mesmo servidor, #{server}. Por favor, roube do servidor inimigo no KvK, não de jogadores do seu próprio servidor. Obrigado.",
  },
  fr: {
    hello: "Bonjour {name}, ici la direction de [{tag}].",
    one: "Un de nos membres a signalé un vol de votre part.",
    other: "Nos membres ont signalé {n} vols de votre part.",
    onDay: "C’était le {day} (heure du serveur).",
    lastDay: "Le dernier date du {day} (heure du serveur).",
    ask: "Nous sommes sur le même serveur, le #{server}. Merci de prendre au serveur ennemi en KvK, pas aux joueurs de votre propre serveur. Bonne journée.",
  },
};

export interface WarningInput {
  /** The player's name as the log holds it. */
  name: string;
  /** Our alliance's tag. */
  tag: string;
  server: number;
  /** Thefts by this player in the log. */
  count: number;
  /** The newest theft's time; null when no time was read. */
  lastAt: Date | null;
  /** SERVER_TZ: the day is the server's day. */
  zone: string;
}

/** The warning in each language: a greeting, what was reported (and when, if known), and the request. */
export function theftWarnings(input: WarningInput): Record<WarningLanguage, string> {
  const one = input.count === 1;
  const made = (language: WarningLanguage) => {
    const t = TEXT[language];
    const day = input.lastAt
      ? new Intl.DateTimeFormat(language, {
          day: "numeric",
          month: "long",
          timeZone: input.zone,
        }).format(input.lastAt)
      : null;
    return [
      fill(t.hello, { name: input.name, tag: input.tag }),
      fill(one ? t.one : t.other, { n: input.count }),
      ...(day ? [fill(one ? t.onDay : t.lastDay, { day })] : []),
      fill(t.ask, { server: input.server }),
    ].join(" ");
  };
  return { en: made("en"), "pt-BR": made("pt-BR"), fr: made("fr") };
}
