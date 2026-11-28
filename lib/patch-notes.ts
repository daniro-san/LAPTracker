// /admin/changes: what each release changed, newest first, and the owner's to-do (every owner step, only there). Static data,
// English only (D48). Before running Prepare release, add the release's entry on top (CONTRIBUTING.md).
// Plain words for the owner: what changed for officers, members, the public or the owner, and why. No file
// names, secrets, webhook URLs or member data; no player names. `#123` in a text links to GitHub.
// Issue 782: an entry's optional `officer` notes are the desk's What's new, in its three languages, written
// for officers (never about /admin or infrastructure). An entry without them stays on /admin/changes only.
import type { Feature } from "./workspace-features";

/** Officer copy in the desk's three languages. */
export interface DeskWords {
  en: string;
  "pt-BR": string;
  fr: string;
}

/** One change as officers see it on What's new. */
export interface OfficerNote {
  title: DeskWords;
  text: DeskWords;
  /** Shown only to a workspace with each of these features on; none: to every workspace. */
  needs?: Feature[];
}

export interface PatchNote {
  version: string;
  /** The day the release was published, YYYY-MM-DD (UTC). */
  date: string;
  title: string;
  changes: string[];
  prs?: number[];
  /** What's new on the desk (issue 782); none: this release is told on /admin/changes only. */
  officer?: OfficerNote[];
}

export interface OwnerTodo {
  text: string;
  issue?: number;
  done?: boolean;
}

export const REPO_URL = "https://github.com/daniro-san/LAPTracker";

/** Steps only the owner can do, open ones first in the order they matter. */
export const ownerTodo: OwnerTodo[] = [
  {
    text: "KvK matchup, before Saturday's KvK: on /admin → KvK opponent, save the opponent's server by Saturday 10:00 ST; the card then suggests its 15 largest alliances from that server's ranks board (untick or add tags, then save). After the Start (12:00 ST), check each tag's outcome on that card, then turn the kvk-matchup flag on in PostHog (it exists and is off).",
    issue: 306,
  },
  {
    text: "After the next Raid Shield window (Friday 23:30 ST), check that the leaders' Discord summary appears as a forum post in the Raid Shield channel.",
    issue: 527,
  },
  {
    text: "After the next raid, compare the two shield shares on the desk with Raid prep's own counts for that week.",
    issue: 527,
  },
  {
    text: 'After the next KvK, check Follow-up\'s "After KvK, offer help" list and the recovery days on Insights against what officers know; both were tested on invented data only.',
    issue: 527,
  },
  {
    text: "PostHog → your personal API keys: create one with only the error-tracking write scope for project 741657, then add it in Vercel → Production as POSTHOG_PERSONAL_API_KEY (Sensitive). The v5.47.0 build uploaded no source map because the key is missing, so PostHog shows minified stack traces for browser and server errors; the maps are still deleted from every deploy.",
    issue: 592,
    done: true,
  },
  {
    text: "Decide #634: show the Raid Shield reading on the member card? Recommendation: only from Friday's night check until KvK starts, in server time.",
    issue: 634,
    done: true,
  },
  {
    text: "Guide: after v5.47.0, retake the new-alliance guide's Alliance settings screenshots (the page now opens with an index and saves Features with a button), with names and channels blurred.",
    issue: 527,
    done: true,
  },
  {
    text: "Before the next release reaches production: check in Vercel that EDIT_PIN and CRON_SECRET are not the public placeholders from the repo's env template (000000 and the local cron placeholder). Then ask Claude for the guard that refuses them in production.",
    issue: 592,
    done: true,
  },
  {
    text: "On your Mac: take every production secret out of your local env file (use local Postgres or the Neon preview role), and restart open Claude sessions so they load the new env guard. Rotating the old secrets is optional.",
    issue: 592,
    done: true,
  },
  {
    text: "Decide #617: the 12 real game screenshots (and 6 OCR texts) with player names in the test fixtures. Recommendation: replace them with rendered screens with invented names; the real ones stay in git history.",
    issue: 617,
  },
  {
    text: 'Decide #621: a read-only "Who can open the desk" card in Alliance settings (roles and counts, or names too; who sees it).',
    issue: 621,
  },
  {
    text: "Decide whether a member's roll call marks and thanks belong in the History tab of their card (#516). A per-member record of marks could read as a list of misses (D75).",
    issue: 516,
  },
  {
    text: 'GitHub → Settings → Actions: allow only selected actions (GitHub\'s own, pnpm/action-setup, dependabot/fetch-metadata), require actions pinned to a full commit SHA, and set the default workflow token to read-only. Keep "Allow GitHub Actions to create and approve pull requests" ON: Prepare release opens the release PR with it (D29). The CI/CD panel recommends it; every workflow already pins SHAs and sets its own permissions. The default token is already read-only; the three commands are in the chat of 2026-11-22.',
    issue: 592,
    done: true,
  },
  {
    text: "Decide whether dev becomes the default branch. It is main today, a recorded choice, so changing it needs a new decision. Issues would close on their own, Dependabot security PRs would target dev and schedules would run from dev, but the after-deploy smoke check (D46) would need moving too. The order matters: first make the main ruleset target main by name, then switch the default branch, then ask Claude for the follow-up PR.",
    issue: 592,
  },
  {
    text: "Decide whether to drop the GitHub-side tick schedule. It fired in about 4% of its slots; cron-job.org is the real scheduler, and D30 keeps GitHub's as a second path, so dropping it needs an amendment. The monthly keep-alive must stay while any GitHub schedule is kept (uptime, the daily browser checks), or GitHub turns them off after 60 days.",
    issue: 592,
  },
  {
    text: 'PostHog "Discard client IP data" is on (checked 2026-11-22).',
    issue: 592,
    done: true,
  },
  {
    text: 'Decided #663: a "none" day counts as 0 in every average, and the line names the none days ("Average 400 · 6 days, of which 2 none"). Built in batch 4.',
    issue: 663,
    done: true,
  },
  {
    text: "Confirm the test rule: a change to a desk flow, or to the numbers a public page shows, updates its end-to-end test in the same PR (orchestrator recommendation).",
    issue: 592,
    done: true,
  },
  {
    text: "Private repo (needs its own decision): the CI/CD panel measured about 16,000 Actions minutes a month at the 2026-11-20/21 pace (69 PRs in 2 days, about 2 runs each, 13 releases a day). This release saves roughly 5,000–6,000 of that (faster checks, no double run per release), which still leaves several times GitHub Pro's 3,000, so a private repo would need a self-hosted runner or paid minutes.",
    issue: 592,
  },
  {
    text: "Browser notifications: test on a real iPhone (add the desk to the Home Screen, open it from the icon, then Alliance settings → Notifications) and on Android Chrome.",
    issue: 558,
  },
  {
    text: "Set the Raid Shield channel (Alliance settings → Discord) before Friday 23:30 ST, then tap Send a test message; without the channel no summary is posted.",
  },
  {
    text: 'For the OGs alliance, Discord: on its desk, Alliance settings → Discord, tap Check, save both webhooks and send a test message. When /admin shows both channels as "set", delete WORKSPACE_DISCORD_WEBHOOKS in Vercel.',
    issue: 527,
  },
  {
    text: "For the OGs alliance, Raid prep: check once that the Raid Shield check is allowed on /admin and turned on in Alliance settings → Features. Optional: turn on the Raid Shield summary (it needs the Raid Shield channel) and check Saturday's time (10:00 by default).",
    issue: 527,
  },
  {
    text: "Guide: sign in once at /w with the new Discord permissions, then review the guide screenshots of /w and Alliance settings → Features.",
    issue: 527,
    done: true,
  },
  {
    text: "Send the invite link and the guide PDF to the new alliance when you like.",
    issue: 527,
  },
  {
    text: "PostHog → Error tracking → Alerts: connect the admin Discord channel as a destination (paste its webhook there yourself), then ask Claude to send the error alert to it.",
    issue: 527,
    done: true,
  },

  {
    text: "cron-job.org: on the /api/tick job, turn on Notify on failure by email.",
    issue: 527,
    done: true,
  },
  {
    text: "GitHub: check that your notification settings email you about failed scheduled Actions runs. The uptime check relies on it.",
    issue: 527,
    done: true,
  },
  {
    text: "Neon → Billing: set a spending limit or alert of about US$ 10 a month, if the option exists.",
    issue: 527,
    done: true,
  },
  {
    text: "Neon → Branches: delete leftover preview branches. Keep main and any branch you use.",
    issue: 527,
    done: true,
  },
  {
    text: "Around 2026-11-28, look at Neon's compute graph. If it is well below 100 CU-hours a month, consider the Free plan. Then decide between Neon and Supabase.",
    issue: 527,
  },
  {
    text: 'Vercel previews: they are blocked (Ignored Build Step is "production only"). Decide whether to keep it that way or turn previews back on.',
    issue: 527,
  },
  {
    text: "VAPID keys for browser notifications: generated and set in Vercel (Production), private key Sensitive; production redeployed.",
    issue: 558,
    done: true,
  },
  {
    text: "Squad lineup confirmed: API slots 1–2 are the front row (top), 3–5 the back row.",
    done: true,
  },
  {
    text: 'KvK "Took a heavy hit" rule kept for now (lost more than 25% and still under 80% of might before the KvK); officers will give feedback.',
    done: true,
  },
  {
    text: "Neon pooler: confirmed. The production DATABASE_URL comes from the Neon integration, which fills it with the pooled address.",
    issue: 527,
    done: true,
  },
  {
    text: "PostHog query key: POSTHOG_QUERY_API_KEY created and added in Vercel.",
    issue: 484,
    done: true,
  },
  {
    text: "PostHog query key: the Endpoint: Read scope is added, and /admin Activity shows numbers.",
    issue: 484,
    done: true,
  },
  {
    text: '/admin Activity: action counts (notices, roll call marks, thanks, screenshots) are now shown exactly; people counts keep "under 5".',
    issue: 484,
    done: true,
  },
  {
    text: "Neon compute capped at 0.5 CU with scale to zero on, and the site's functions moved to iad1, next to the database.",
    issue: 527,
    done: true,
  },
];

export const patchNotes: PatchNote[] = [
  {
    version: "v5.71.0",
    date: "2026-11-28",
    title: "Origin of Chaos with its two windows, a player's day by day, and readable thanks",
    changes: [
      "Alliance settings → Posts: a third optional post, Welcome new members. Every day, after the end-of-day read (between 23:30 and 00:00 ST), it greets by name the members who joined since yesterday, in the members' channel. It runs only when both days' reads worked, never mentions anyone who left, pings nobody, and posts nothing on a day with no one new. Off until officers turn it on; allowed by default.",
      "Alliance settings → Posts: a fourth optional post, Weekly members summary, in the leaders' channel only. Every Monday between 00:00 and 01:15 ST it gives last week's counts: how many joined, how many left, the member count on two dated days, and how many of the 7 daily updates it is based on. Counts only: no names, no coins, quests or donations. Off until officers turn it on; allowed by default.",
      "Alliance settings → Posts: a fifth optional post, the KvK recap, in the members' channel after each KvK's End. It thanks everyone first, gives the kills gained together and the top 3 gainers by name, and thanks defenders and support. No bottom list and no one named for gaining nothing. Off until officers turn it on; allowed by default.",
      "Events can now have up to 4 windows, each read on its own, and an event's change is the sum of its windows. Origin of Chaos runs every fourth Saturday (next on 5 December) with two windows, 00:00–00:45 and 12:15–13:15 ST. Other reads pause only inside each window, not in the 12 hours between them.",
      "Player pages: a Day by day section lists every reading of the player, newest first, 14 at a time. Each line shows might and kills with their change, and notes when the player moved alliance or changed name. A gap of more than 36 hours is marked and never filled in.",
      "Thanks: the desk card lists one line per reason with the names after it. The shared message is now a fixed template, with writing help only for people an officer wrote a few words about. Members whose approved link is on the card see their own thank-you first on the board.",
      "Desk: a follow-up note can be deleted and an open review request withdrawn, with Undo for a short while. Both vanish from lists, counts and Home, and go to their own file in the export.",
      "The daily read now keeps its list of alliances, so /admin/runs shows an alliance it never reached and the automatic retry reads it. A roster the read itself stored is never read again (D72).",
      "Desktop shows one feedback entry: the floating badge from 1280 px, the button at the end of the page below that. The daily quest cap is 250, the game's limit.",
      'Calendar: every KvK entry has a KvK plan. Officers name roles (four are suggested), add members by name, write a note, and "Make the message" turns it into a notice with the day and time in ST, ready for languages, copying and Discord. Roles are never a ranking.',
      "Insights → KvK: an officers-only map of where members were at the KvK's End reading, one unnamed dot each, in three bands of kills gained. Officers can type the castle's point to see who was near, mid or far. It shows where members stood at the reading, not where they fought, and never leaves the desk.",
      "Errors now carry the release they happened in, and sign-in, sharing thanks and the screenshot import record where they stop, with reason codes only.",
      "Former members: officers can record why someone left (left, joined another alliance, removed by officers, inactive or unknown, with an optional note), and the view counts who left by month and reason, never by name.",
      'Desk Home: a "New" line points officers to What\'s new, a page of the changes for the features their alliance has on, in their language.',
    ],
    prs: [766, 768, 769, 784, 796, 786, 776, 787, 777, 774, 797, 800, 798, 802, 803],
    officer: [
      {
        title: {
          en: "KvK plans on the Calendar",
          "pt-BR": "Planos da KvK na Agenda",
          fr: "Plans de KvK dans l’agenda",
        },
        text: {
          en: "Every KvK on the Calendar has a plan: give people a role, add a note, and Make the message turns it into a notice with the time in ST.",
          "pt-BR":
            "Toda KvK na Agenda tem um plano: dê uma função a cada pessoa, escreva um recado, e Gerar a mensagem transforma tudo em um aviso com o horário em ST.",
          fr: "Chaque KvK de l’agenda a un plan : donnez un rôle à chacun, ajoutez une note, et Préparer le message en fait une annonce avec l’heure en ST.",
        },
        needs: ["notices"],
      },
      {
        title: {
          en: "Insights: the KvK map",
          "pt-BR": "Análises: o mapa da KvK",
          fr: "Analyses : la carte de la KvK",
        },
        text: {
          en: "Insights → KvK shows where members were at the KvK’s End reading, one unnamed dot each, in three bands of kills gained. Type the castle’s point to see who was near, mid or far. Only officers see it.",
          "pt-BR":
            "Análises → KvK mostra onde os membros estavam na leitura do Fim da KvK, um ponto sem nome para cada um, em três faixas de kills ganhas. Digite o ponto do castelo para ver quem estava perto, no meio ou longe. Só os oficiais veem.",
          fr: "Analyses → KvK montre où étaient les membres au relevé de fin de la KvK, un point sans nom par membre, en trois tranches de kills gagnés. Tapez le point du château pour voir qui était près, à mi-distance ou loin. Seuls les officiers la voient.",
        },
        needs: ["insights"],
      },
      {
        title: {
          en: "Welcome new members post",
          "pt-BR": "Post de boas-vindas aos novos membros",
          fr: "Message d’accueil des nouveaux membres",
        },
        text: {
          en: "Alliance settings → Posts: once a day, an optional post greets by name the members who joined since yesterday, in the members’ channel. It pings nobody. Off until you turn it on.",
          "pt-BR":
            "Configurações da aliança → Posts: uma vez por dia, um post opcional dá boas-vindas pelo nome a quem entrou desde ontem, no canal dos membros. Não menciona ninguém. Desligado até você ligar.",
          fr: "Réglages de l’alliance → Messages : une fois par jour, un message facultatif accueille par leur nom les membres arrivés depuis hier, dans le salon des membres. Il ne mentionne personne. Éteint jusqu’à ce que vous l’allumiez.",
        },
        needs: ["post_welcome"],
      },
      {
        title: {
          en: "Weekly members summary",
          "pt-BR": "Resumo semanal dos membros",
          fr: "Bilan hebdomadaire des membres",
        },
        text: {
          en: "Every Monday, an optional post in the leaders’ channel gives last week’s counts: how many joined, how many left, and the member count. Counts only, no names. Off until you turn it on.",
          "pt-BR":
            "Toda segunda, um post opcional no canal dos líderes traz os números da semana passada: quantos entraram, quantos saíram e o total de membros. Só números, sem nomes. Desligado até você ligar.",
          fr: "Chaque lundi, un message facultatif dans le salon des chefs donne les chiffres de la semaine passée : arrivées, départs et nombre de membres. Des chiffres seulement, aucun nom. Éteint jusqu’à ce que vous l’allumiez.",
        },
        needs: ["post_summary"],
      },
      {
        title: {
          en: "KvK recap post",
          "pt-BR": "Post de resumo da KvK",
          fr: "Message de bilan de la KvK",
        },
        text: {
          en: "After each KvK, an optional post thanks everyone, gives the kills gained together and the top 3 gainers, and thanks defenders and support. Nobody is named for gaining nothing. Off until you turn it on.",
          "pt-BR":
            "Depois de cada KvK, um post opcional agradece a todos, mostra as kills ganhas juntos e os 3 maiores ganhos, e agradece a defesa e o apoio. Ninguém é citado por não ganhar nada. Desligado até você ligar.",
          fr: "Après chaque KvK, un message facultatif remercie tout le monde, donne les kills gagnés ensemble et les 3 plus gros gains, et remercie défense et soutien. Personne n’est nommé pour n’avoir rien gagné. Éteint jusqu’à ce que vous l’allumiez.",
        },
        needs: ["post_kvk"],
      },
      {
        title: {
          en: "Thanks, one line per reason",
          "pt-BR": "Agradecimentos, uma linha por motivo",
          fr: "Remerciements, une ligne par raison",
        },
        text: {
          en: "The thanks card on Members lists one line per reason with the names after it, and the shared message follows a fixed template.",
          "pt-BR":
            "O cartão de agradecimentos em Membros mostra uma linha por motivo com os nomes depois, e a mensagem compartilhada segue um modelo fixo.",
          fr: "La carte des remerciements dans Membres donne une ligne par raison suivie des noms, et le message partagé suit un modèle fixe.",
        },
      },
      {
        title: {
          en: "Delete a follow-up note",
          "pt-BR": "Apagar uma anotação de acompanhamento",
          fr: "Supprimer une note de suivi",
        },
        text: {
          en: "A follow-up note can be deleted, with Undo for a short while.",
          "pt-BR":
            "Uma anotação de acompanhamento pode ser apagada, com Desfazer por alguns instantes.",
          fr: "Une note de suivi peut être supprimée, avec Annuler pendant un court moment.",
        },
        needs: ["follow_up"],
      },
      {
        title: {
          en: "Withdraw a review request",
          "pt-BR": "Retirar um pedido de revisão",
          fr: "Retirer une demande de relecture",
        },
        text: {
          en: "An open review request on a notice can be withdrawn, with Undo for a short while.",
          "pt-BR":
            "Um pedido de revisão aberto em um aviso pode ser retirado, com Desfazer por alguns instantes.",
          fr: "Une demande de relecture ouverte sur une annonce peut être retirée, avec Annuler pendant un court moment.",
        },
        needs: ["notices"],
      },
      {
        title: {
          en: "A player’s day by day",
          "pt-BR": "O dia a dia de um jogador",
          fr: "Le jour par jour d’un joueur",
        },
        text: {
          en: "Player pages list every reading, newest first: might and kills with their change, and when the player moved alliance or changed name.",
          "pt-BR":
            "As páginas de jogador mostram cada leitura, da mais nova para a mais antiga: poder e kills com a mudança, e quando o jogador mudou de aliança ou de nome.",
          fr: "Les pages de joueur listent chaque relevé, du plus récent au plus ancien : puissance et kills avec leur évolution, et quand le joueur a changé d’alliance ou de nom.",
        },
      },
    ],
  },
  {
    version: "v5.70.0",
    date: "2026-11-23",
    title: "A Friday shield reminder for members",
    changes: [
      "Alliance settings → Posts: a second optional post, the Shield-up reminder. Every Friday from 20:30 ST (3 hours before the night check) it asks members, in their channel, to make sure their shield is on before the 00:00 ST reset, take squads off the wall and bring troops home. It names and counts no one and pings nobody. Off until officers turn it on; allowed by default.",
    ],
    prs: [763],
    officer: [
      {
        title: {
          en: "Shield-up reminder post",
          "pt-BR": "Post do lembrete do escudo",
          fr: "Message de rappel du bouclier",
        },
        text: {
          en: "Alliance settings → Posts: every Friday from 20:30 ST, an optional post asks members to put their shield on before the 00:00 ST reset. It names and pings nobody. Off until you turn it on.",
          "pt-BR":
            "Configurações da aliança → Posts: toda sexta a partir das 20:30 ST, um post opcional pede aos membros que ativem o escudo antes do reset das 00:00 ST. Não cita nem menciona ninguém. Desligado até você ligar.",
          fr: "Réglages de l’alliance → Messages : chaque vendredi dès 20:30 ST, un message facultatif demande aux membres de mettre leur bouclier avant le reset de 00:00 ST. Il ne nomme ni ne mentionne personne. Éteint jusqu’à ce que vous l’allumiez.",
        },
        needs: ["post_shield_up"],
      },
    ],
  },
  {
    version: "v5.69.1",
    date: "2026-11-23",
    title: "Optional posts, and a test read on raid night",
    changes: [
      'Alliance settings → Posts: a catalog of posts we write for the alliance, each off until officers turn it on. The first is "This week in the alliance": every Monday, the week\'s calendar entries marked for members, with ST times, to the channel officers pick (no player names, notes or links; nobody pinged). You allow it per alliance on /admin (allowed by default).',
      "One test read at 02:30 ST on Saturday 28 (raid night), about 100 calls, once: it shows how many members the game's map saw after the reset, to decide whether a third Raid Shield read each week is worth it. It never touches Raid prep, the summary or notifications, and it keeps the morning check's calls.",
    ],
    prs: [761, 758],
    officer: [
      {
        title: {
          en: "Posts the tracker writes for you",
          "pt-BR": "Posts que o tracker escreve por você",
          fr: "Des messages que le tracker écrit pour vous",
        },
        text: {
          en: "Alliance settings → Posts: the first optional post, “This week in the alliance”, sends the week’s Calendar entries for members every Monday, with ST times, to the channel you pick. Off until you turn it on.",
          "pt-BR":
            "Configurações da aliança → Posts: o primeiro post opcional, “Esta semana na aliança”, envia toda segunda os itens da Agenda da semana para os membros, com horários em ST, no canal que você escolher. Desligado até você ligar.",
          fr: "Réglages de l’alliance → Messages : le premier message facultatif, « Cette semaine dans l’alliance », envoie chaque lundi les entrées de l’agenda de la semaine pour les membres, avec les heures en ST, dans le salon choisi. Éteint jusqu’à ce que vous l’allumiez.",
        },
        needs: ["post_week"],
      },
    ],
  },
  {
    version: "v5.69.0",
    date: "2026-11-23",
    title: "One more level: a day",
    changes: [
      'Insights: a membership flow day opens where its newcomers came from and where its leavers went (counts only); a pulse day shows "n of N members" for each measure, and a tap opens the names of who did it (for officers, no ranking); a KvK recovery day shows might at Start, at End and that day for the members it counts.',
      'Flow weeks with nothing to compare show "—", never 0, and each start date says which start it is.',
    ],
    prs: [755],
    officer: [
      {
        title: {
          en: "Insights: open a day",
          "pt-BR": "Análises: abrir um dia",
          fr: "Analyses : ouvrir un jour",
        },
        text: {
          en: "A day on Insights opens one level more: where newcomers came from and where leavers went, “n of N members” for each measure, and a tap shows who did it.",
          "pt-BR":
            "Um dia em Análises abre mais um nível: de onde vieram os novos e para onde foram os que saíram, “n de N membros” em cada medida, e um toque mostra quem fez.",
          fr: "Un jour dans Analyses s’ouvre d’un niveau de plus : d’où viennent les arrivants et où vont les partants, « n sur N membres » pour chaque mesure, et un appui montre qui l’a fait.",
        },
        needs: ["insights"],
      },
    ],
  },
  {
    version: "v5.68.0",
    date: "2026-11-23",
    title: "Tap a chart to open the next one",
    changes: [
      'Server pulse and fight clock: a chosen interval opens its kills by alliance ("10:45–11:00 by alliance ›"), with the alliances left out named and a loss counted as 0 and named.',
      'Insights: an earlier week\'s pulse opens its seven days, and a membership flow week opens its days (joined and left counts, "—" where no daily update came). A path with Back sits above each level, and the address reopens it.',
    ],
    prs: [751],
    officer: [
      {
        title: {
          en: "Insights: tap a week to open its days",
          "pt-BR": "Análises: toque numa semana para ver os dias",
          fr: "Analyses : touchez une semaine pour voir ses jours",
        },
        text: {
          en: "An earlier week’s pulse opens its seven days, and a membership flow week opens its joined and left counts by day. Back takes you up one level.",
          "pt-BR":
            "O pulso de uma semana anterior abre os sete dias, e uma semana do fluxo de membros abre as entradas e saídas por dia. Voltar sobe um nível.",
          fr: "Le pouls d’une semaine passée ouvre ses sept jours, et une semaine du flux des membres ouvre ses arrivées et départs par jour. Retour remonte d’un niveau.",
        },
        needs: ["insights"],
      },
    ],
  },
  {
    version: "v5.67.1",
    date: "2026-11-23",
    title: "Monday's thanks cover last week",
    changes: [
      "Members tab thanks: on a Monday the activity and donors lists now show last week, as the weekly thanks should; both lists always cover the same week, even when a day's read is missing.",
    ],
    prs: [748],
    officer: [
      {
        title: {
          en: "Monday’s thanks cover last week",
          "pt-BR": "Os agradecimentos de segunda cobrem a semana passada",
          fr: "Les remerciements du lundi couvrent la semaine passée",
        },
        text: {
          en: "On a Monday, the activity and donors lists in Members show last week, as the weekly thanks should.",
          "pt-BR":
            "Na segunda, as listas de atividade e de doadores em Membros mostram a semana passada, como devem os agradecimentos semanais.",
          fr: "Le lundi, les listes d’activité et de donateurs dans Membres montrent la semaine passée, comme il se doit pour les remerciements de la semaine.",
        },
      },
    ],
  },
  {
    version: "v5.67.0",
    date: "2026-11-23",
    title: "Tap a chart to read it, and see who",
    changes: [
      "Charts answer a tap where you are: a line under the chart names the chosen column, its time and its numbers, with ‹ › to step (server pulse, fight clock, compare, a player's line, Me, the member card's last 7 days).",
      'Insights: a count of members opens its names in place (up to 12), in a sheet on a phone or a side pane on a computer (up to 60), and "Open these n in Members ›" opens the Members list on exactly that set, as one removable chip, in name order.',
      "A War turnout or Kill share row says why you landed on the alliance's member list (sorted by kills gained), with an × back to the usual order.",
      "The feedback sheet keeps a focused field clear of its Send bar on a phone.",
    ],
    prs: [745, 744],
    officer: [
      {
        title: {
          en: "Tap a chart to read it",
          "pt-BR": "Toque num gráfico para ler",
          fr: "Touchez un graphique pour le lire",
        },
        text: {
          en: "Tap a column: a line under the chart gives its time and numbers, with ‹ › to step.",
          "pt-BR":
            "Toque numa coluna: uma linha abaixo do gráfico mostra o horário e os números, com ‹ › para avançar.",
          fr: "Touchez une colonne : une ligne sous le graphique donne son heure et ses chiffres, avec ‹ › pour avancer.",
        },
      },
      {
        title: {
          en: "Insights: see who",
          "pt-BR": "Análises: veja quem",
          fr: "Analyses : voyez qui",
        },
        text: {
          en: "A count of members on Insights opens their names, and “Open these n in Members ›” shows exactly that group in Members.",
          "pt-BR":
            "Uma contagem de membros em Análises abre os nomes, e “Abrir estes n em Membros ›” mostra exatamente esse grupo em Membros.",
          fr: "Un nombre de membres dans Analyses ouvre leurs noms, et « Ouvrir ces n dans Membres › » montre exactement ce groupe dans Membres.",
        },
        needs: ["insights"],
      },
    ],
  },
  {
    version: "v5.66.0",
    date: "2026-11-23",
    title: "Honest charts and right daily quest points",
    changes: [
      "Daily quest points were wrong everywhere: the game sends a running total for the week (it resets on Monday), and we showed it as one day's points. Each day's points are now worked out from two reads, so Last 7 days, Me, Insights, the alliance's week line, the Members list and the thanks, caravan, garrison and Elixir picks show real daily figures. Quest bars are drawn against 240 a day for now; confirm 230 or 240.",
      "Charts tell the truth at a glance: zero draws as zero (no small stub), a player's line joins daily reads only (an event's Start and End are dots in its band), KvK recovery has a 100% line, membership flow and time zones are drawn against all members, the rank sparklines are gone (a moved rank says \"was #6 on Nov 9\"), Kill share vs might share is one bar of the gap, and the KvK matchup is a table on a phone.",
      "Feedback can carry one picture (up to 400 KB). Only you see it on /admin/feedback; it is deleted with the feedback after 180 days.",
    ],
    prs: [740, 738, 734],
    officer: [
      {
        title: {
          en: "Right daily quest points",
          "pt-BR": "Pontos de missão diária corretos",
          fr: "Points de quête quotidienne justes",
        },
        text: {
          en: "Daily quest points were wrong: the game sends a running total for the week. Every page now shows each day’s real points.",
          "pt-BR":
            "Os pontos de missão diária estavam errados: o jogo envia um total acumulado da semana. Agora todas as páginas mostram os pontos reais de cada dia.",
          fr: "Les points de quête quotidienne étaient faux : le jeu envoie un total cumulé de la semaine. Chaque page montre maintenant les vrais points de chaque jour.",
        },
      },
      {
        title: {
          en: "A picture with your feedback",
          "pt-BR": "Uma imagem com o seu feedback",
          fr: "Une image avec votre avis",
        },
        text: {
          en: "Feedback can carry one picture, up to 400 KB. Only the site’s maintainer sees it, and it is deleted with the feedback after 180 days.",
          "pt-BR":
            "O feedback pode levar uma imagem, até 400 KB. Só o responsável pelo site a vê, e ela é apagada com o feedback depois de 180 dias.",
          fr: "Un avis peut porter une image, jusqu’à 400 Ko. Seul le responsable du site la voit, et elle est supprimée avec l’avis après 180 jours.",
        },
      },
    ],
  },
  {
    version: "v5.65.0",
    date: "2026-11-23",
    title: "Raid prep: check by hand only who the maps can't vouch for",
    changes: [
      'Raid prep: "To check by hand: n" lists the members with no shield on a map within 3 h of the reset, with no map that near, or with no reading; each says why, and "Show the n ›" puts them in the grid. Each reading now shows its map\'s day and age against the reset ("map Fri 22:33 ST · 1 h 27 min before reset").',
      'The tracker no longer writes ✓ or ✗ into Raid prep; officers mark, the readings help. "Mark ✓ the n seen with a shield" and "the rest" leave out the members to check by hand, and "Nobody left to mark" waits until an officer has marked.',
      'Feedback: on a computer (1280 px and wider) a small "Feedback" badge sits at the bottom left of the desk, the board and Me.',
      "A one-off test read at 02:30 ST tonight (Mon 23) to see when the game's map is refreshed after the reset; about 100 calls, once.",
    ],
    prs: [731, 730, 732],
  },
  {
    version: "v5.64.0",
    date: "2026-11-22",
    title: "Your own line on our posts, and feedback from officers and members",
    changes: [
      'Alliance settings → "Your line on our posts": officers can add one line of their own (up to 120 characters, never translated) on top of the Raid Shield summary, the weekly thanks and the garrison post. It pings no one and makes no links. Home says who changed it, not what it says. You can turn this off per alliance on /admin.',
      "Send feedback: every desk page, the members' board and Me end with a button to send an idea, a problem or something good. Nothing says who sent it; the text has members' private values removed and is kept 180 days. You read it on /admin/feedback and mark each item read, an issue or dropped.",
    ],
    prs: [721, 723],
  },
  {
    version: "v5.63.0",
    date: "2026-11-22",
    title: "Opponent tags suggested, and the desk at every width",
    changes: [
      "KvK opponent (/admin): saving the opponent's server now reads that server's ranks board once and suggests its 15 largest alliances as ticked tags; untick or add, then save. It spends no tracker calls and stores only tags, names and might.",
      "Officers' Desk on tablets (768–1279 px): every page is in the side rail now, Former members, Insights, Caravans, Notices and Thefts included. The header fits two lines on a phone, Home no longer scrolls inside itself, and long names in Insights wrap between words.",
      "Alliance settings → Discord says where a post's name and picture come from (the webhook's own, set in Discord), and the members' board thank-you card shows the alliance's badge.",
      'Notifications: when the browser\'s push service refuses (Brave turns it off by default) or does not answer, the card now says so and how to fix it, instead of "Not saved".',
      "Brave on iPhone: the site now asks Night Mode not to recolour it; check once with Night Mode on that the light theme stays cream.",
      "Behind the scenes: errors now ping the admin Discord channel only through PostHog, and production refuses to start with the template's placeholder PIN or cron secret.",
    ],
    prs: [717, 722, 714, 716, 719, 715, 718],
  },
  {
    version: "v5.62.0",
    date: "2026-11-22",
    title: "Clearer kills changes and right plurals",
    changes: [
      'Public pages: on an event\'s member list, a member whose kills were not read at the Start or the End now says so beside the "—" ("Start unknown", "End unknown"). While the list is sorted by "± Kills" it adds "counted as 0", which is why that member ranks first or low.',
      'Desk in French and Portuguese: counts of 0 now take the singular, as those languages do ("0 vol enregistré" after a screenshot import).',
      "Behind the scenes: one place for filling in sentences and choosing singular or plural, so a missing value shows as {x} instead of an empty word in Discord or a notification; stricter end-to-end tests (exact counts, a calendar add, delete and Undo flow).",
    ],
    prs: [708, 707, 704, 706, 709],
  },
  {
    version: "v5.61.0",
    date: "2026-11-22",
    title: "Home's counts open their people too",
    changes: [
      'Home: "added 3 new members" in Recent activity opens those names in name order. "4 already noted by officers" is now its own link to Follow-up\'s "Noted this week".',
      'Status bar: the Raid Shield line counts the same members as Raid prep, with members away on the raid\'s Saturday left out and said as "· 3 away", and a "Raid prep ›" button opens that week\'s Raid prep.',
      "Public pages: a browser that asks only for a language the site does not have (Arabic, Persian or Hebrew, for example) gets the English page with English digits and dates, no longer that language's digits or calendar.",
      "Behind the scenes: a wider privacy test (the data export, Alliance settings and the public data answers are checked for every private roster field), the Home badge counted in one place, a shorter architecture guide, and fewer brittle tests.",
    ],
    prs: [697, 700, 699, 701, 698, 695, 696],
  },
  {
    version: "v5.60.0",
    date: "2026-11-22",
    title: "Tap a count to see exactly those people",
    changes: [
      "Insights: a count of members (an effort group, who is left out on a break or with no might, each week's joined and left, tenure from a month with us, a time zone row) opens exactly those members under it, in name order, each opening their card; Back brings the list back. Newcomers, squads and came from / went to stay counts, as decided.",
      'Raid prep: "Show the n ›" beside "To remind" and beside "Mark ✓ the n seen with a shield" puts exactly those members in the grid. On Roll call, a card\'s "Not set", ✗ and ✓ counts open the marking page on that chip; ✗ is never the default.',
      'Public pages: an event ledger row\'s "+3 joined · −2 left" and the split\'s "Came in with / Went with" open the alliance\'s member list filtered to exactly those players, and War turnout and Kill share rows open it sorted by kills gained.',
    ],
    prs: [688, 691, 690],
  },
  {
    version: "v5.59.0",
    date: "2026-11-22",
    title: "Members can tell their officers their own details",
    changes: [
      'A member whose "This is me" link an officer approved can now tell their officers three things from their own page (Me → "Tell your officers"): their Alliance Duel tech %, their time zone (one tap uses the phone\'s) and the languages they read.',
      'Officers see it on that member\'s card under "Sent by the member", beside what the card holds, and answer with "Put on the card" or "Seen, keep the card". Nothing on the card changes until an officer puts it there; Home\'s "To review" lists who sent something.',
      "A member sees only their own sends and whether an officer has seen them, never the card's value or anything about anyone else. Up to 20 sends a day.",
    ],
    prs: [684],
  },
  {
    version: "v5.58.0",
    date: "2026-11-22",
    title: "The KvK opponent, time zones on Insights, and the shield on the member card",
    changes: [
      "KvK matchup (hidden until you turn the kvk-matchup flag on): on /admin you save the opponent's server, up to 15 of its alliance tags, and later the result. At the Start and the End the tracker reads each of those alliances once (at most 30 calls per KvK, and the quota it keeps back applies only when an opponent is saved). The event page then compares both servers' top alliances at the Start and from the Start to the End, and the End picture gets a short block.",
      'Insights ends with a "Time zones" card: the largest group of members and what the 00:00 ST reset is for them, how many have a time zone recorded, and, behind a tap, each group west to east with "Now · Reset · KvK" on its own clock and the hours most members are within their usual day. Counts only.',
      "The member card shows the member's Raid Shield state only from Friday's night check (23:30 ST) until KvK starts: an officer's mark first, otherwise the tracker's checks; a member away on the raid day shows as away.",
    ],
    prs: [679, 680, 681],
  },
  {
    version: "v5.57.0",
    date: "2026-11-22",
    title: "One average rule, and two fixes on the public alliance pages",
    changes: [
      'The member card, Me and Insights now average a member\'s days the same way: a "none" day counts as 0, and the line names those days ("Average 400 · 6 days, of which 2 none"). A week of only "none" days reads "None on all 7 days", never "Average 0". A day with no daily update is never counted.',
      'An alliance\'s "Across events" table no longer shows a change in members against an event whose roster was stale; it shows a dash, as it already did for might and kills.',
      'A name the tracker read wrong once is no longer shown as an alliance\'s former name: YAHO was read once as "PKM / POKEMON" on Nov 7 and as YAHO before and after. Real renames still show.',
      "For whoever builds the site: lint, format and type checks keep a local cache, and the end-of-turn check runs only the tests a change touches, plus every guard test.",
    ],
    prs: [672, 674, 676, 677],
  },
  {
    version: "v5.56.0",
    date: "2026-11-22",
    title: "One word for the daily update, and Follow-up's groups on the first screen",
    changes: [
      'The desk, Me, Insights, the status bar, Alliance settings and the officers\' notification call the end-of-day read the "daily update" (PT "atualização diária", FR "mise à jour quotidienne"), new-member lines included. Shield readings, squad reads and a KvK\'s Start and End reads keep their words.',
      'Follow-up\'s "How this list works" is closed on every visit, so the groups, "After KvK, offer help" included, start on the first phone screen in English. "Tap a name to write down what they said." stays in sight, and your line "These are notes for you. Nothing is sent and nobody is removed from the alliance." is one tap away.',
      '/admin/changes: every step only you can do now sits in the one to-do list at the top; releases no longer carry their own "Needs you" box.',
    ],
    prs: [669, 670],
  },
  {
    version: "v5.55.0",
    date: "2026-11-22",
    title: "Dates and times written one way",
    changes: [
      'On the desk, the board and Me, dates and times are now written one way in English, Portuguese and French: "Fri, Nov 20, 18:54 ST" (PT "sex., 20 de nov. às 18:54 ST", FR "ven. 20 nov. à 18:54 ST"). Every server time ends in "ST"; the full words "server time (ST)" appear only in the legends.',
      'Time zones show as an offset at the moment shown, "UTC−3", so summer time is right, on the board and on /admin (which showed "Etc/GMT+2").',
      'The board\'s week is "Next 7 days", so "This week" always means Monday to Sunday; on Me, the squads line shows your own time first.',
      "Portuguese and French lines that end with a date no longer print a double dot.",
    ],
    prs: [662],
  },
  {
    version: "v5.54.0",
    date: "2026-11-22",
    title: "Two Follow-up fixes",
    changes: [
      "Undo no longer clears another officer's Needs help mark: when an officer saved \"They need help\" on a member a colleague had already marked, and then tapped Undo, the colleague's mark disappeared. It now stays, credited to them.",
      'The Home tab\'s number counts "This is me" claims waiting for an officer on every desk page, as Home already did; it read 0 on the other pages.',
      "For whoever builds the site: Follow-up's group rules and Home's waiting count each come from one place, the Needs help read is lighter, and the batch 3 checks have the tests they lacked.",
    ],
    prs: [664, 661, 659],
  },
  {
    version: "v5.53.0",
    date: "2026-11-22",
    title: "Offer help after a KvK, from Follow-up",
    changes: [
      'Follow-up has a new group, "After KvK, offer help": members who lost over a quarter of their might in the latest KvK and are still below 80% of it, for the week after it (from the night read to Friday). Writing down what they said takes them out. The hint and the ready message offer help ("How did KvK go for you?"); no number is shown beside a name.',
      "Home's and Members' Follow-up numbers count this group, and Insights' KvK help list links to it.",
      "For whoever builds the site: the daily browser checks now also pass on the iPhone's browser engine (WebKit), which never signed in on GitHub's Linux machines before.",
    ],
    prs: [655, 648],
  },
  {
    version: "v5.52.0",
    date: "2026-11-22",
    title: "Home says what needs you first, and Follow-up rows are simpler",
    changes: [
      'Home opens with a Follow-up card near the top: how many members to look at this week and how many officers already noted, as one link. A line under it jumps to "To review" when something waits there.',
      '"Send screenshots" has its own card, a finished calendar entry takes one line ("KvK · Ended"), and Recent activity folds officers finishing the same roll call into one line you can open.',
      'Follow-up: each row has one button, "Talked to them"; tap the name to write a note (the summary says so), and "Card ›" opens the member\'s card. A line every row of a group shares is said once under the title, and the page uses the wide layout on a computer.',
      "Members' first group is now \"Check in or Needs help\" and points to Follow-up for the week's list.",
    ],
    prs: [652, 651],
  },
  {
    version: "v5.51.0",
    date: "2026-11-22",
    title: "Members marked Needs help stay on Follow-up until someone clears it",
    changes: [
      'Follow-up opens with "Needs help": every member an officer marked Needs help, each week, until an officer taps "No longer needs help" in their panel. Each row says since when, who added the mark and their note; an away note pauses it. Before, a member marked Needs help whose activity looked normal again was on no list.',
      'A row shows last week\'s note as context, and the member card says the same under "Needs help".',
      'On release day Home\'s "Follow-up: n to look at" can rise: every Needs help mark that still stands joins the list. Clear the ones that are done.',
    ],
    prs: [646],
  },
  {
    version: "v5.50.0",
    date: "2026-11-22",
    title: "Follow-up says who was already noted, and claims are easier to check",
    changes: [
      'Follow-up opens with the week\'s two numbers, how many to look at and how many others were already noted this week, and a new "Noted this week" card lists who an officer talked to since Monday, with the note. "Check in" is now "Worth a hello".',
      "Home and Members show Follow-up's two numbers by Follow-up's own rule, linked to it, so the three pages no longer disagree.",
      'A "This is me" claim on Home\'s "To review" links the player to their member card and says the day it was asked, so an officer can check who it is first. "Reject" is now "Not them".',
      '/admin\'s "Needs you" shows a nightly clean-up that failed (old member data, deleted workspaces or old app errors) until it next runs fine.',
      "Library updates, among them Next.js 16.4.6.",
    ],
    prs: [640, 643, 642, 618],
  },
  {
    version: "v5.49.0",
    date: "2026-11-22",
    title: "/admin opens with what needs you",
    changes: [
      '/admin opens with "Needs you": only what waits on you, each with a count and a link: a late scheduler, a daily read to retry, access requests, app errors from the last 24 h, workspaces to set up or with a key to fix, deletions asked, a low API reading that morning, and your to-dos. When nothing waits, it says so.',
      "The Alliances table flags a workspace with no member role or no read yet, and Activity shows each workspace's setup steps even without PostHog.",
      "The menu counts app errors from the last 24 hours, /admin/errors shows each error's workspace and can be filtered by it, and a page-error count links straight to its errors.",
      "The API reading above the 1,000 plan no longer says OK, and the last tick says Late by the same rule as the scheduler watch.",
    ],
    prs: [637],
  },
  {
    version: "v5.48.0",
    date: "2026-11-22",
    title: "Talk to a member from their card, and quieter, cheaper reads",
    changes: [
      "Member card: officers can tap \"Talked to them\" and open the ready message to send (in the member's language, for game mail or Discord) without leaving the card. The card says whether this week's follow-up was noted.",
      "The officers' Raid Shield phone notification now leaves away members out of its count, so it gives the same number as the leaders' Discord summary.",
      "The daily read and the squads read do less database work: an index for the 90-day clean-up, no re-queueing of the whole roster after every answer, and one query less on every desk page.",
      "For whoever builds the site: more end-to-end checks (sign-out, Follow-up, member facts, a feature switch), and tests for the Follow-up and feature-switch rules.",
    ],
    prs: [629, 630, 631, 632, 633],
  },
  {
    version: "v5.47.0",
    date: "2026-11-22",
    title: "KvK says Ended on time, Me says what to do, and a clearer Alliance settings",
    changes: [
      'KvK reads "Ended" from its End read (16:15 ST) on the board, Home, Calendar and Me, instead of "Started" all evening.',
      'Me: a Raid prep "No shield" or "On the wall" mark shows the next step from the raid\'s eve (turn the shield on, or take the squads off the wall, before the reset, then before KvK starts at 12:00 ST); once KvK starts only the mark stays. A "no" on other roll calls gets no step: it is the member\'s own answer.',
      "Alliance settings opens with an index of every card and its state, Features save with a Save button (with \"Not saved yet\" until then), the Discord card says one thing when the site's bot is off, and the Raid Shield channel's privacy line is easy to read.",
      "The leaders' Raid Shield summary no longer names away members under \"Not seen yet\"; it shows how many are away instead, like the desk's Copy names.",
      "Error reports from the server can show readable stack traces in PostHog (once the source-map key is set, see the to-do list), and errors the desk used to swallow are now reported, with private fields removed first.",
      "/admin → Runs no longer lists an alliance someone looked up as a stale alliance of the daily read.",
      "For whoever builds the site: agents are blocked from reading local secret files by accident, recording fixtures (which spends quota) is the owner's, and the tests were cleaned of fakes and now pass in any order.",
    ],
    prs: [612, 615, 619, 620, 622, 623, 624],
  },
  {
    version: "v5.46.0",
    date: "2026-11-22",
    title: "Raid prep says which raid it is for, an honest KvK card, and safer, faster checks",
    changes: [
      "Raid prep: the header names the raid it serves (\"KvK Sat, Nov 21 · raid at the reset\"), not the day the roll call was added. The card opens with the answer, how many shields the tracker saw at the last check, and the marks below it add up and change with every tap. Each member's line says the shield time is the map's time.",
      'Raid prep\'s phone bar now counts "6 to mark" in the card\'s own words, the Roll call list names a Raid prep roll call by its KvK Saturday, and "your time" says "the day before" or "the next day" instead of "−1 d" / "+1 d" (on the members\' board it sits on its own line under the time).',
      "Insights → KvK cost and recovery: on KvK day, after the End read, the card says the KvK is recorded and that its numbers show after the 23:30 ST daily read, instead of claiming no KvK was read. When the page's reads start after the last KvK, it says so.",
      'Easier to read: stronger contrast in light mode, visible labels on fields, "Started"/"Ended" words instead of faded items, and larger values on Me, the member card and the board.',
      "Error reports: before any error text leaves the site, one filter removes the private roster fields and member text. Server errors now go to PostHog Error Tracking; /admin → App errors keeps 30 days as a fallback.",
      "Every change to the site's code is now checked in a real browser before it can merge: 28 checks of what the public pages, the desk and the Me page show, including that one alliance never sees another's data. Each release also runs the desk checks in the iPhone browser engine.",
      "Checks run about 3 minutes faster per change, a release no longer runs them twice, and Dependabot waits 7 days before proposing a new version (14 for major ones).",
      "For whoever builds the site: issue and PR templates with testable criteria, a rule to keep the analytics plan current with every change, and rules on what and how to test, so every test checks real behaviour.",
    ],
    prs: [596, 597, 598, 599, 600, 601, 602, 603, 604, 605, 608, 609, 610, 613],
  },
  {
    version: "v5.45.0",
    date: "2026-11-21",
    title: "Raid prep is faster on war day",
    changes: [
      'Fixed: "To mark" counted the optional squads-off-the-wall part, so it showed 98 to mark when only 6 were left. It now counts the shield only.',
      'Raid prep cards are about half as tall; the wall marks show only when "Show squads off the wall" is on or someone already has one. Four columns on a wide screen.',
      '"Copy names" and "Copy one message" give officers the members still to remind, ready to paste into Discord. The page also shows whether the Discord summary was posted, is off, or is not set up.',
      "One set of words everywhere: Raid Shield check, Night check, Morning check, with the same times on every page.",
      "Roll call wording fixes, and an Elixir team member who is away that day is now shown as away.",
      "From the full review of the Officers' Desk (#585), batch 1 of 9.",
    ],
    prs: [590],
  },
  {
    version: "v5.44.0",
    date: "2026-11-21",
    title: "Event kills and might no longer count members who joined mid-event",
    changes: [
      "The tracker sometimes answered a read of one alliance with another alliance's members. Those readings are now refused, so they can no longer put fake spikes in the server pulse or the fight clock. Event 263's four bad readings were removed.",
      "When an alliance gains members during an event, their lifetime kills used to count as event kills (YAHO showed +6.1M; +5.3M came in with 3 members who joined).",
      "The ledger and the alliance page keep the total, with a tappable * when members changed: it opens Total, Came in with the members who joined, Went with those who left, and Without them.",
      "Standings at the last reading, the server pulse, the fight clock, who carried and kill share now count only the members who were there, so alliances compare fairly. Past events show the corrected figures too.",
      "The squads on the member card each sit in their own frame.",
    ],
    prs: [586, 587],
  },
  {
    version: "v5.43.0",
    date: "2026-11-21",
    title: "Insights: Raid Shield history",
    changes: [
      "Insights has a Raid Shield history (when the Raid Shield check is on): for the last 8 Fridays, the share of members seen with a shield at the night check and at the morning check.",
      'Alliance totals only, no names. A week or check with no reading shows "no reading", never 0%; a check still running shows "under way".',
      "The section explains that these are the tracker's map scans, so the night share is usually low: most shields turned on for the raid show only in the morning.",
    ],
    prs: [582],
  },
  {
    version: "v5.42.0",
    date: "2026-11-21",
    title: "Insights: KvK cost and recovery, and squads seen",
    changes: [
      "Insights has a KvK section: how much might the alliance lost in the last KvK and how much is back, day by day, plus up to 3 older KvKs.",
      '"Took a heavy hit — maybe offer help": members who lost more than 25% and are still under 80% of their might before the KvK, names only, never a ranking. Members on a break are left out.',
      "A Squads seen section (when the squads read is on): how many members have 1, 2 or 3+ squads seen, how fresh the sightings are, and the strongest squad's might in four groups. Counts only, no lineups.",
      "Both sections use stored data only, with no extra calls to the tracker.",
    ],
    prs: [579],
  },
  {
    version: "v5.41.0",
    date: "2026-11-21",
    title: "Desk pages read less of the database as data grows",
    changes: [
      "An audit of every read of a table that grows forever, measured on one invented year of data (10 alliances).",
      "The Officers' Desk Home and Members pages now spend about half the database time per view (42.8 → 21.0 ms), and that time no longer grows as members' history grows.",
      "/admin reads each roll call's first mark from a new index instead of reading every mark.",
      "Every number on every page stays the same; an old-versus-new check compared them on the same data.",
    ],
    prs: [576],
  },
  {
    version: "v5.40.0",
    date: "2026-11-21",
    title: "Member cards close and stay closed on a phone",
    changes: [
      'On a phone, closing a member card sometimes flickered, showed "Loading…" and opened the card again. It now closes at once, with no trip to the server, whichever way you close it (X, tapping outside, Escape or the back gesture).',
      "Cause: the page address kept the member after the card closed, and the browser's back step reopened it.",
      "Shared links to a member still open that member's card. The same fix covers Former members and Follow-up.",
    ],
    prs: [573],
  },
  {
    version: "v5.39.0",
    date: "2026-11-21",
    title: "Browser notifications for officers",
    changes: [
      'Officers can get notifications on their phone or computer: Alliance settings → Notifications → "Enable on this device". Each device and each use has its own switch.',
      'Four uses: the Raid Shield count after each shield reading (again only if it changes), a "This is me" claim waiting for approval, Calendar roll call reminders, and a failed night read (off by default).',
      "Notifications show counts and a link only, never a member's name, because they appear on lock screens.",
      "On iPhone and iPad they work only after adding the desk to the Home Screen and opening it from that icon; the card explains how.",
      "Nothing changes until the VAPID keys are set in Vercel: the card stays hidden until then.",
    ],
    prs: [570],
  },
  {
    version: "v5.38.0",
    date: "2026-11-21",
    title: "Raid prep marks itself from the tracker's night and morning checks",
    changes: [
      'Raid prep no longer claims a shield length. The tracker reports the same shield type for an 8 h and a 24 h shield, so a row now says only "shield seen" and when the map was scanned. The "May end before KvK" tag is gone.',
      "After Friday night's shield reading (before the server reset), the tracker marks ✓ for every member it saw with a shield.",
      'After Saturday morning\'s reading, it marks ✓ for members still seen with a shield and ✗ "No shield seen" for the rest. Nothing is erased: each row keeps a small history, for example "Night · 22:33 ST: shield seen" and "Morning · 07:15 ST: no shield seen".',
      'Marks the tracker wrote say "from the tracker". A notice at the top asks an officer to check them; "Checked" hides it. Members with a morning ✗ are listed first, and their ready message asks for the shield.',
      "An officer's own ✓ or ✗ always wins: the tracker never writes over it. Away members are skipped, and nothing is posted to Discord from this step.",
      "If the week's Raid prep roll call doesn't exist yet, the first reading creates it.",
    ],
    prs: [567],
  },
  {
    version: "v5.37.0",
    date: "2026-11-21",
    title: "The Raid Shield summary gets its own channel, and squads show 2 in front and 3 behind",
    changes: [
      'Alliance settings → Discord has a third card, "Raid Shield channel". The Raid Shield summary posts only there. If no Raid Shield channel is set up, no summary is posted; it never goes to the leaders\' channel.',
      "A summary posted before this change is not edited again. The next shield window posts a fresh one in the Raid Shield channel.",
      "Member card squads: the 2 front heroes (the tanks) sit on top and the 3 back heroes below, the same on a phone and on a computer. The old staggered shape is gone.",
    ],
    prs: [563, 564],
  },
  {
    version: "v5.36.0",
    date: "2026-11-21",
    title: "The alliance's week in one line, patch notes, and real setup dates",
    changes: [
      "Officers' Desk: Home and Members show the alliance's week in one line: how many members reached the 1,000 Alliance Help coins, the median of daily quest points, and the week's donations. Alliance totals only, no names (#466).",
      'Days with no read are named ("no read on Tue") and never count as 0.',
      "/admin has this Patch notes page, with your to-do list on top. Every release adds its entry here.",
      '/admin Activity: the setup steps (created, key saved, webhook set, first roll call marked, first notice published) now come from the site\'s own records, so OGs shows its real dates instead of "not yet".',
      '/admin Activity: notices, roll call marks, thanks and screenshots are shown as exact numbers. Officers active and board visitors keep "under 5" for privacy.',
    ],
    prs: [557, 559, 560],
  },
  {
    version: "v5.35.0",
    date: "2026-11-21",
    title: "The Raid Shield summary posts to forum channels",
    changes: [
      "The leaders' Raid Shield summary was not posted on KvK Saturday, 2026-11-21. The leaders' channel is a Discord forum, and Discord refuses a forum post that has no title.",
      'The first post now has the title "Raid Shield check". Later updates edit that same post.',
      "The shield readings were saved correctly the whole time, and the Raid prep page showed them. Only the Discord message was missing.",
    ],
    prs: [555],
  },
  {
    version: "v5.34.0",
    date: "2026-11-21",
    title: "Members' daily figures kept out of session replay",
    changes: [
      "PostHog session replay recorded the height of the day bars on the officers' member card. From those heights someone could work out each member's daily coins and donations (#549).",
      "Every place on the Officers' Desk that shows a member's daily quest points, coins or donations, or sorts members by them, is now blank in replay: the member card's last 7 days, the Members list, the thanks top 3, caravan suggestions and the roll call picker.",
      "Replay records those parts as empty boxes of the same size. Nothing changes for people using the site.",
    ],
    prs: [553],
  },
  {
    version: "v5.33.0",
    date: "2026-11-21",
    title: "Public page fixes from the persona review",
    changes: [
      "Fixes the 6 bugs found by the persona review of the public pages (#473).",
      'Ledger columns line up, so a change no longer runs into the next column. Long names end in "…" instead of breaking in the middle of a word.',
      "When a Start and an End fall on different days, both show their day.",
      "Text on the leader's row is darker and easier to read. A player with no photo shows the drawn placeholder instead of a broken image.",
      "Players search shows might, level and a result count, and puts exact name matches first.",
      'Compare shows the plain difference and "1.1× the first". Standing over time shows ▲ and ▼ and says "stayed" when the rank held.',
      '"São Paulo" keeps its accent, and the header stays deep plum in dark mode.',
    ],
    prs: [551],
  },
  {
    version: "v5.32.0",
    date: "2026-11-21",
    title: "A member's own week on their Me page",
    changes: [
      "A member's own Me page on the members' board has a \"This week\" card: their own daily quest points, Alliance Help coins and donations, Monday to Sunday.",
      "It opens with a thanks line. Under each row is the member's own last week. There is no rank, no alliance average and no above or below wording.",
      'A day with no reading shows "No reading" and never counts against anyone.',
      'Only the member sees it, and only after an officer approved their "This is me" link. Map position, online times and the photo stay hidden, also from the member.',
      "You approved this on 2026-11-21, and the project's privacy rule for member data was changed to allow it.",
    ],
    prs: [548],
  },
  {
    version: "v5.31.0",
    date: "2026-11-21",
    title: "Usage numbers from PostHog on /admin and the desk",
    changes: [
      "/admin has an Activity section: for each alliance, totals for the last 7 days of officers active, board visitors, notices written, roll call marks, thanks shared and screenshots read.",
      "It also shows each alliance's setup steps with their dates: created, key saved, webhook set, first roll call marked, first notice published.",
      'Desk Home shows officers "Board reach": at least how many members opened the members\' board in the last 7 days.',
      "Only totals are shown, never names. A total under 5 is not shown.",
      "The numbers are read from PostHog, so the database gets no new tables.",
    ],
    prs: [546],
  },
  {
    version: "v5.30.0",
    date: "2026-11-21",
    title: "An Alliances table on /admin",
    changes: [
      "/admin has an Alliances table at the top of the workspace sections, one row per alliance.",
      "Each row shows tracker calls today and over 7 days against the key's 1,000 a day, the key's state, writing help and translations against their daily limits, Discord posts and failed posts, page errors in the last 24 hours, when an officer was last on the desk, and features changed from the defaults.",
      "Rows that need a look come first, with the reason on a chip. Tap a row to open that alliance's card further down.",
      "Counts and times only, read from our own tables. On a phone the rows are cards.",
    ],
    prs: [544],
  },
  {
    version: "v5.29.0",
    date: "2026-11-21",
    title: "Onboarding analytics for new alliances",
    changes: [
      "New PostHog events follow a new alliance's setup: the workspace created, the tracker key saved, and feature switches changed on /admin.",
      'The PostHog "Workspaces" dashboard shows requests and invites as weekly counts, and the setup steps per alliance: created, webhook set, first roll call marked, first notice published.',
      "The dashboard has an alert when one alliance's errors spike.",
      "The events carry no names, ids, keys or text.",
      "On /admin, a daily limit's Save and Reset buttons are disabled while a save runs, so a double tap does not save twice.",
    ],
    prs: [542],
  },
  {
    version: "v5.28.0",
    date: "2026-11-21",
    title: "Home and event pages cached",
    changes: [
      "The home page and the event pages reuse their database reads until the next update, like the other public pages since v5.27.0.",
      "In a burst of 96 page views there were 0 errors. Before, there were 14 to 19.",
      "When the database is down, member history still shows the last saved data.",
      "This was the last of the fixes for the Neon quota incident (#521), which is now closed. The fixes: the scheduler's 15-minute check looks at the clock before the database, /admin polls only when a run can start, a heartbeat every 3 hours, the watcher in GitHub Actions, Neon compute capped at 0.5 CU, and the functions in iad1, next to the database.",
    ],
    prs: [540],
  },
  {
    version: "v5.27.0",
    date: "2026-11-21",
    title: "Public pages cached, and a page for when the database is down",
    changes: [
      "Public pages (alliances, players, player search, member history) reuse their database reads until the next update. Repeat views make 0 database queries.",
      "In a burst of 48 views right after an update, page errors fell from 21–24 to 0.",
      'When the database does not answer, the page says "Data temporarily unavailable" in the viewer\'s language, with Try again, instead of an error.',
      "A page waits at most 10 seconds for the database.",
    ],
    prs: [537],
  },
  {
    version: "v5.26.0",
    date: "2026-11-21",
    title: "The member's Me page, and one database connection per page",
    changes: [
      'On the members\' board, a member taps "This is me" on their roster row. An officer approves it on Home\'s "To review" line before it counts.',
      "Every link waits for an officer, because Discord nicknames can change. The officer sees whether the Discord name matches the game name.",
      'One approved link per player, and a false claim cannot lock the real player out. An officer\'s own "This is me" is approved at once.',
      "Each page now opens one database connection pool instead of several. /admin went from 6 pools to 1 and from 74 to 50 database transactions per view.",
      'The "too many clients" database errors under load stopped: 0 in bursts of 39 pages, against up to 9 before.',
    ],
    prs: [534, 535],
  },
  {
    version: "v5.25.0",
    date: "2026-11-21",
    title: "An idle /admin tab stops asking the server",
    changes: [
      "An idle /admin tab no longer asks for updates every 20 seconds. It asks only in the 5 minutes after a scheduled check that can start a run.",
      "Links on /admin no longer load pages before you tap them.",
      "On an idle /admin tab, database transactions fell from 228 a minute to about 2.",
      "A new database index makes the member sightings lookup faster: 5 ms instead of 805 ms.",
      "Part of the fixes for the Neon quota incident (#521).",
    ],
    prs: [532],
  },
  {
    version: "v5.24.0",
    date: "2026-11-21",
    title: "Insights, the Follow-up panel, the roll call grid and fewer database wake-ups",
    changes: [
      "Officers get an Insights page: the week's pulse against the 4 weeks before, effort at every might level, quiet contributors to thank, and who joined and left.",
      'Follow-up names the facts still missing for each new member, opens a panel with a ready message in the member\'s language, and adds "A tip to share" for members below the 1,000 coin cap on most days.',
      'The roll call is a grid of tiles. Members already marked fold under "Marked (n)".',
      "A roster read that lists more members than the alliance's capacity leaves out the extra members with no rank (#481).",
      "The scheduler's 15-minute check looks at the clock before it touches the database, so Neon stays asleep when nothing is due (#521).",
      "A heartbeat runs every 3 hours, and GitHub checks the site and the scheduler right after it. A stopped scheduler is now noticed within about 3 hours.",
      "The site's functions run in iad1 (Virginia), next to the database, instead of São Paulo.",
    ],
    prs: [520, 522, 523, 524, 525, 528, 529, 530],
  },
  {
    version: "v5.23.0",
    date: "2026-11-20",
    title: "Member card tabs, the read status bar and Raid prep",
    changes: [
      "The officers' member card is a short header over four tabs: Overview, Info, Squads and History. Overview shows the last 7 days of quest points, coins and donations.",
      "Squads shows the game's 5-slot lineup for each squad. Troop counts are never shown.",
      "Every desk page shows officers a thin status bar when a tracker read needs attention: the key needs pasting again, a roster read failed or is late, or the squads read is running or stopped.",
      'Raid prep for the night before KvK: the Raid Shield check reads every member on Friday night and again on Saturday. Officers mark "Shield" and "Squads off the wall", and each member gets a ready private message.',
      "An optional summary goes to the leaders' channel only.",
    ],
    prs: [514, 515, 517],
  },
  {
    version: "v5.22.0",
    date: "2026-11-20",
    title: "Sign in, every alliance on the server, and two-layer switches",
    changes: [
      "A \"Sign in\" link on the public site opens /w. One Discord sign-in finds every Officers' Desk or members' board the person belongs to.",
      "The tracker key form says where to get a key, and the link to the key page is fixed.",
      '/alliances lists every alliance on the ranks board. The top 20 by might are read every day, and "Get today\'s details" reads any other alliance once a day, at most 30 a day for the site.',
      "Squads are read as a daily queue on every 15-minute scheduled check, with retries, instead of in one time window. /admin and Alliance settings show today's progress.",
      'Feature switches have two layers: you allow a feature on /admin, and the alliance\'s officers turn it on. /admin has "Defaults for new alliances".',
      'A feature that is turned off is not shown at all. There is no "turned off" message.',
      "A notice's read page shows one language at a time in tabs, each with its character count and state.",
    ],
    prs: [502, 503, 504, 505, 506, 508, 510, 511],
  },
  {
    version: "v5.21.0",
    date: "2026-11-20",
    title: "Alliances set up their own Discord and Desk",
    changes: [
      "Officers add the bot, turn on commands and save their webhooks themselves in Alliance settings → Discord. You no longer send install links or edit Vercel for each alliance.",
      "Each webhook is checked against the alliance's own Discord server, stored encrypted and never shown back.",
      "A new alliance gets its Officers' Desk from a one-time invite link, or by requesting one at /w/request.",
      "/admin → New alliances lists the requests with a roster check, and makes invite links that work for 7 days.",
      "The invite takes 4 steps: sign in with Discord, pick the server, add the bot, then pick or create the roles.",
    ],
    prs: [497, 499],
  },
];
