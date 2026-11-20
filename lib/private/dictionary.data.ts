// "Download our data" and "Delete this workspace" (D125, issue 441) in English, Brazilian Portuguese and
// French: Alliance settings, the banner of the 14 days, Home's lines and the download's README. French puts
// a no-break space before : ? and !.
export const dataEn = {
  "data.head": "Your alliance’s data",
  "data.lead":
    "Everything your officers saved here belongs to your alliance. Download a copy, or delete this workspace.",
  "data.download": "Download our data",
  "data.downloading": "Preparing the file…",
  "data.downloadHelp":
    "A ZIP of spreadsheet files (CSV) and a README that names each file. Map positions, online status, photos and the tracker key are left out. Up to 3 downloads in 24 hours.",
  "data.downloaded": "Downloaded. Look in your downloads.",
  "data.rateLimited":
    "Your alliance has downloaded its data 3 times in the last 24 hours. You can download again 24 hours after the first of them.",
  "data.tooLarge": "The data is too large for one file. Ask the site’s owner.",
  "data.failed": "Could not download. Try again.",
  "delete.head": "Delete this workspace",
  "delete.lead":
    "Everything officers saved here is deleted 14 days after you ask. Until then everyone keeps access, and any officer can cancel.",
  "delete.button": "Delete this workspace",
  "delete.ask": "Delete this workspace?",
  "delete.what":
    "After {date}, everything saved in this desk is deleted for good: member notes, the Calendar, notices and their pictures, roll calls, follow-ups, thefts, garrison plans, the thanks, the activity, the tracker key and everyone’s access.",
  "delete.stays":
    "Public data stays: the Event Ledger and your alliance’s public pages are not part of this workspace.",
  "delete.first": "Download your data first if you want a copy.",
  "delete.type": "To confirm, type the workspace address: {address}",
  "delete.yes": "Delete in 14 days",
  "delete.no": "Keep the workspace",
  "delete.mismatch": "The address does not match. Type {address}.",
  "delete.failed": "Could not save. Try again.",
  "delete.asked": "This workspace will be deleted after {date}. Any officer can cancel until then.",
  "deletion.banner": "This workspace will be deleted after {date}.",
  "deletion.more": "Download your data before then in Alliance settings.",
  "deletion.board":
    "This board closes after {date}. Ask an officer if you think this is a mistake.",
  "deletion.cancel": "Cancel the deletion",
  "deletion.cancelled": "Deletion cancelled. Nothing will be deleted.",
  "deletion.failed": "Could not cancel. Try again.",
  "activity.data.download": "{who} downloaded the alliance’s data",
  "activity.data.delete_asked": "{who} asked to delete this workspace",
  "activity.data.delete_cancelled": "{who} cancelled the deletion of this workspace",
  "readme.title": "{alliance}: data from the Officers’ Desk",
  "readme.made": "Downloaded on {date} (UTC) by {who}.",
  "readme.open":
    "Each .csv file opens in a spreadsheet (UTF-8, comma-separated, as Excel in English expects). If Excel puts everything in one column, use Data > From Text/CSV.",
  "readme.times":
    "Times are in UTC (ISO 8601). Columns that say who did something (created_by, written_by, deleted_by…) hold the person’s name.",
  "readme.deleted":
    "Files ending in -deleted hold records an officer deleted, with when (deleted_at) and who (deleted_by).",
  "readme.left":
    "Left out on purpose: map positions, online status, last time online, join date, photos, the tracker key, sign-in sessions and Discord ids.",
  "readme.pictures":
    "Folder pictures: each notice’s picture, named notice-<id> (the id is in notices.csv).",
  "readme.picturesLeft":
    "{n} notice pictures were left out to keep this file under 4.5 MB. The newest are included; the others stay on their notices.",
  "readme.files": "Files",
  "readme.columns": "Columns",
  "readme.rows": "rows: {n}",
  "data.file.people": "Everyone who signed in to the desk or the members’ board.",
  "data.file.member-facts":
    "What officers recorded about each member: every saved version of each field.",
  "data.file.former-members":
    "Members an earlier roster listed and the newest does not, as last seen.",
  "data.file.new-members": "New members added by hand before the roster listed them.",
  "data.file.name-aliases": "Spreadsheet names matched to members.",
  "data.file.calendar-entries": "Calendar entries.",
  "data.file.calendar-weeks":
    "Weeks of a Calendar entry that differ from the plan: moved, cancelled, caravan picks.",
  "data.file.garrison-plans": "Undead Siege garrison plans.",
  "data.file.notices": "Notices: who wrote them and when.",
  "data.file.notice-texts": "Every saved title and text of each notice, in every language.",
  "data.file.notice-posts": "Notices posted to Discord.",
  "data.file.notice-reviews": "Review requests on notices.",
  "data.file.notice-review-outcomes": "How each review request ended.",
  "data.file.notice-pictures": "Each notice’s picture; the files are in the pictures folder.",
  "data.file.roll-calls": "Roll calls.",
  "data.file.roll-call-marks": "Every mark of every roll call.",
  "data.file.roll-call-teams": "Elixir Scramble teams.",
  "data.file.follow-ups": "Follow-up records: talked, on a break, needs help, all fine.",
  "data.file.thefts": "The thefts log.",
  "data.file.theft-steps": "Steps taken on each attacker.",
  "data.file.theft-attackers": "Each attacker’s server, as officers set it.",
  "data.file.thanks": "The weekly thanks, as shared.",
  "data.file.thanks-taken-down": "Thanks taken down from the members’ board.",
  "data.file.start-here": "Start here, in each language.",
  "data.file.screenshot-drafts": "Screenshot imports: the text read and the rows found.",
  "data.file.alliance-duel-points": "Alliance Duel points saved from screenshots.",
  "data.file.screenshot-checks": "Rankings checked against the tracker: counts only.",
  "data.file.squads": "Squads read from the tracker.",
  "data.file.player-reads":
    "Each read of a member on the tracker: shield, map time, might, kills, language, server and VIP.",
  "data.file.player-history":
    "Each member’s might, kills and alliance over time, as the tracker keeps them.",
  "data.file.tracker-key-changes": "Who saved or removed the tracker key (never the key).",
  "data.file.data-requests": "Downloads of this data, and deletions asked or cancelled.",
  "data.file.activity": "Home’s recent activity of the last two weeks, as Home says it.",
  "data.deletedFile": "{what} Deleted records.",
};

export const dataPt: typeof dataEn = {
  "data.head": "Os dados da sua aliança",
  "data.lead":
    "Tudo o que seus oficiais salvaram aqui é da sua aliança. Baixe uma cópia ou exclua este espaço de trabalho.",
  "data.download": "Baixar nossos dados",
  "data.downloading": "Preparando o arquivo…",
  "data.downloadHelp":
    "Um ZIP com arquivos de planilha (CSV) e um LEIAME que explica cada arquivo. Posições no mapa, status online, fotos e a chave do tracker ficam de fora. Até 3 downloads em 24 horas.",
  "data.downloaded": "Baixado. Veja nos seus downloads.",
  "data.rateLimited":
    "Sua aliança já baixou os dados 3 vezes nas últimas 24 horas. Dá para baixar de novo 24 horas depois do primeiro desses downloads.",
  "data.tooLarge": "Os dados são grandes demais para um arquivo. Fale com o dono do site.",
  "data.failed": "Não foi possível baixar. Tente de novo.",
  "delete.head": "Excluir este espaço de trabalho",
  "delete.lead":
    "Tudo o que os oficiais salvaram aqui é excluído 14 dias depois do pedido. Até lá todos continuam com acesso, e qualquer oficial pode cancelar.",
  "delete.button": "Excluir este espaço de trabalho",
  "delete.ask": "Excluir este espaço de trabalho?",
  "delete.what":
    "Depois de {date}, tudo o que foi salvo nesta mesa é excluído para sempre: notas dos membros, o Calendário, os avisos e suas imagens, as chamadas, os acompanhamentos, os roubos, os planos de guarnição, os agradecimentos, a atividade, a chave do tracker e o acesso de todos.",
  "delete.stays":
    "Os dados públicos ficam: o Event Ledger e as páginas públicas da sua aliança não fazem parte deste espaço de trabalho.",
  "delete.first": "Baixe seus dados antes, se quiser uma cópia.",
  "delete.type": "Para confirmar, digite o endereço do espaço de trabalho: {address}",
  "delete.yes": "Excluir em 14 dias",
  "delete.no": "Manter o espaço de trabalho",
  "delete.mismatch": "O endereço não confere. Digite {address}.",
  "delete.failed": "Não foi possível salvar. Tente de novo.",
  "delete.asked":
    "Este espaço de trabalho será excluído depois de {date}. Até lá qualquer oficial pode cancelar.",
  "deletion.banner": "Este espaço de trabalho será excluído depois de {date}.",
  "deletion.more": "Antes disso, baixe seus dados em Configurações da aliança.",
  "deletion.board":
    "Este mural fecha depois de {date}. Fale com um oficial se achar que é um engano.",
  "deletion.cancel": "Cancelar a exclusão",
  "deletion.cancelled": "Exclusão cancelada. Nada será excluído.",
  "deletion.failed": "Não foi possível cancelar. Tente de novo.",
  "activity.data.download": "{who} baixou os dados da aliança",
  "activity.data.delete_asked": "{who} pediu para excluir este espaço de trabalho",
  "activity.data.delete_cancelled": "{who} cancelou a exclusão deste espaço de trabalho",
  "readme.title": "{alliance}: dados da Mesa dos oficiais",
  "readme.made": "Baixado em {date} (UTC) por {who}.",
  "readme.open":
    "Cada arquivo .csv abre numa planilha (UTF-8, separado por ponto e vírgula, como o Excel em português espera). Se tudo ficar numa coluna, use Dados > De Texto/CSV e escolha ponto e vírgula.",
  "readme.times":
    "Os horários estão em UTC (ISO 8601). As colunas que dizem quem fez algo (created_by, written_by, deleted_by…) trazem o nome da pessoa.",
  "readme.deleted":
    "Os arquivos que terminam em -deleted têm registros que um oficial excluiu, com quando (deleted_at) e quem (deleted_by).",
  "readme.left":
    "Deixados de fora de propósito: posições no mapa, status online, última vez online, data de entrada, fotos, a chave do tracker, as sessões de login e os ids do Discord.",
  "readme.pictures":
    "Pasta pictures: a imagem de cada aviso, com o nome notice-<id> (o id está em notices.csv).",
  "readme.picturesLeft":
    "{n} imagens de avisos ficaram de fora para manter este arquivo abaixo de 4,5 MB. As mais novas estão incluídas; as outras continuam nos seus avisos.",
  "readme.files": "Arquivos",
  "readme.columns": "Colunas",
  "readme.rows": "linhas: {n}",
  "data.file.people": "Todos que entraram na mesa ou no mural dos membros.",
  "data.file.member-facts":
    "O que os oficiais registraram sobre cada membro: cada versão salva de cada campo.",
  "data.file.former-members":
    "Membros que uma lista anterior trazia e a mais nova não traz, como vistos pela última vez.",
  "data.file.new-members": "Membros novos adicionados à mão antes de aparecerem na lista.",
  "data.file.name-aliases": "Nomes da planilha ligados a membros.",
  "data.file.calendar-entries": "Itens do Calendário.",
  "data.file.calendar-weeks":
    "Semanas de um item do Calendário diferentes do plano: movidas, canceladas, escolhas da caravana.",
  "data.file.garrison-plans": "Planos de guarnição do Undead Siege.",
  "data.file.notices": "Avisos: quem escreveu e quando.",
  "data.file.notice-texts": "Cada título e texto salvo de cada aviso, em todos os idiomas.",
  "data.file.notice-posts": "Avisos publicados no Discord.",
  "data.file.notice-reviews": "Pedidos de revisão dos avisos.",
  "data.file.notice-review-outcomes": "Como cada pedido de revisão terminou.",
  "data.file.notice-pictures": "A imagem de cada aviso; os arquivos estão na pasta pictures.",
  "data.file.roll-calls": "Chamadas.",
  "data.file.roll-call-marks": "Cada marcação de cada chamada.",
  "data.file.roll-call-teams": "Equipes do Elixir Scramble.",
  "data.file.follow-ups": "Acompanhamentos: conversou, de pausa, precisa de ajuda, tudo certo.",
  "data.file.thefts": "O registro de roubos.",
  "data.file.theft-steps": "Passos tomados com cada atacante.",
  "data.file.theft-attackers": "O servidor de cada atacante, como os oficiais definiram.",
  "data.file.thanks": "Os agradecimentos da semana, como foram compartilhados.",
  "data.file.thanks-taken-down": "Agradecimentos retirados do mural dos membros.",
  "data.file.start-here": "Comece aqui, em cada idioma.",
  "data.file.screenshot-drafts": "Importações de prints: o texto lido e as linhas encontradas.",
  "data.file.alliance-duel-points": "Pontos do Alliance Duel salvos de prints.",
  "data.file.screenshot-checks": "Rankings conferidos com o tracker: só contagens.",
  "data.file.squads": "Esquadrões lidos do tracker.",
  "data.file.player-reads":
    "Cada leitura de um membro no tracker: escudo, hora do mapa, poder, abates, idioma, servidor e VIP.",
  "data.file.player-history":
    "Poder, abates e aliança de cada membro ao longo do tempo, como o tracker guarda.",
  "data.file.tracker-key-changes": "Quem salvou ou removeu a chave do tracker (nunca a chave).",
  "data.file.data-requests": "Downloads destes dados e exclusões pedidas ou canceladas.",
  "data.file.activity":
    "A atividade recente da Início nas duas últimas semanas, como a Início diz.",
  "data.deletedFile": "{what} Registros excluídos.",
};

export const dataFr: typeof dataEn = {
  "data.head": "Les données de votre alliance",
  "data.lead":
    "Tout ce que vos officiers ont enregistré ici appartient à votre alliance. Téléchargez-en une copie, ou supprimez cet espace de travail.",
  "data.download": "Télécharger nos données",
  "data.downloading": "Préparation du fichier…",
  "data.downloadHelp":
    "Un ZIP de fichiers de tableur (CSV) et un LISEZMOI qui présente chaque fichier. Les positions sur la carte, le statut en ligne, les photos et la clé du tracker sont exclus. Jusqu’à 3 téléchargements en 24 heures.",
  "data.downloaded": "Téléchargé. Regardez dans vos téléchargements.",
  "data.rateLimited":
    "Votre alliance a déjà téléchargé ses données 3 fois ces dernières 24 heures. Vous pourrez télécharger à nouveau 24 heures après le premier de ces téléchargements.",
  "data.tooLarge":
    "Les données sont trop lourdes pour un seul fichier. Demandez au propriétaire du site.",
  "data.failed": "Téléchargement impossible. Réessayez.",
  "delete.head": "Supprimer cet espace de travail",
  "delete.lead":
    "Tout ce que les officiers ont enregistré ici est supprimé 14 jours après la demande. D’ici là, tout le monde garde l’accès et n’importe quel officier peut annuler.",
  "delete.button": "Supprimer cet espace de travail",
  "delete.ask": "Supprimer cet espace de travail ?",
  "delete.what":
    "Après le {date}, tout ce qui est enregistré dans ce bureau est supprimé pour de bon : notes sur les membres, le Calendrier, les annonces et leurs images, les appels, les suivis, les vols, les plans de garnison, les remerciements, l’activité, la clé du tracker et l’accès de chacun.",
  "delete.stays":
    "Les données publiques restent : l’Event Ledger et les pages publiques de votre alliance ne font pas partie de cet espace de travail.",
  "delete.first": "Téléchargez d’abord vos données si vous voulez une copie.",
  "delete.type": "Pour confirmer, tapez l’adresse de l’espace de travail : {address}",
  "delete.yes": "Supprimer dans 14 jours",
  "delete.no": "Garder l’espace de travail",
  "delete.mismatch": "L’adresse ne correspond pas. Tapez {address}.",
  "delete.failed": "Enregistrement impossible. Réessayez.",
  "delete.asked":
    "Cet espace de travail sera supprimé après le {date}. D’ici là, n’importe quel officier peut annuler.",
  "deletion.banner": "Cet espace de travail sera supprimé après le {date}.",
  "deletion.more": "Téléchargez vos données avant cette date dans Réglages de l’alliance.",
  "deletion.board":
    "Ce tableau ferme après le {date}. Parlez à un officier si vous pensez que c’est une erreur.",
  "deletion.cancel": "Annuler la suppression",
  "deletion.cancelled": "Suppression annulée. Rien ne sera supprimé.",
  "deletion.failed": "Annulation impossible. Réessayez.",
  "activity.data.download": "{who} a téléchargé les données de l’alliance",
  "activity.data.delete_asked": "{who} a demandé la suppression de cet espace de travail",
  "activity.data.delete_cancelled": "{who} a annulé la suppression de cet espace de travail",
  "readme.title": "{alliance} : données du Bureau des officiers",
  "readme.made": "Téléchargé le {date} (UTC) par {who}.",
  "readme.open":
    "Chaque fichier .csv s’ouvre dans un tableur (UTF-8, séparé par des points-virgules, comme Excel en français l’attend). Si tout se met dans une colonne, utilisez Données > À partir d’un fichier texte/CSV et choisissez le point-virgule.",
  "readme.times":
    "Les heures sont en UTC (ISO 8601). Les colonnes qui disent qui a fait quelque chose (created_by, written_by, deleted_by…) donnent le nom de la personne.",
  "readme.deleted":
    "Les fichiers qui finissent par -deleted contiennent les éléments qu’un officier a supprimés, avec quand (deleted_at) et qui (deleted_by).",
  "readme.left":
    "Exclus exprès : positions sur la carte, statut en ligne, dernière connexion, date d’arrivée, photos, la clé du tracker, les sessions de connexion et les identifiants Discord.",
  "readme.pictures":
    "Dossier pictures : l’image de chaque annonce, nommée notice-<id> (l’id est dans notices.csv).",
  "readme.picturesLeft":
    "{n} images d’annonces ont été laissées de côté pour garder ce fichier sous 4,5 Mo. Les plus récentes sont incluses ; les autres restent sur leurs annonces.",
  "readme.files": "Fichiers",
  "readme.columns": "Colonnes",
  "readme.rows": "lignes : {n}",
  "data.file.people":
    "Toutes les personnes qui se sont connectées au bureau ou au tableau des membres.",
  "data.file.member-facts":
    "Ce que les officiers ont noté sur chaque membre : chaque version enregistrée de chaque champ.",
  "data.file.former-members":
    "Les membres qu’une liste précédente comptait et que la plus récente ne compte plus, tels que vus en dernier.",
  "data.file.new-members": "Les nouveaux membres ajoutés à la main avant que la liste les compte.",
  "data.file.name-aliases": "Les noms du tableur reliés aux membres.",
  "data.file.calendar-entries": "Les éléments du Calendrier.",
  "data.file.calendar-weeks":
    "Les semaines d’un élément du Calendrier qui diffèrent du plan : déplacées, annulées, choix de la caravane.",
  "data.file.garrison-plans": "Les plans de garnison de l’Undead Siege.",
  "data.file.notices": "Les annonces : qui les a écrites et quand.",
  "data.file.notice-texts":
    "Chaque titre et texte enregistré de chaque annonce, dans toutes les langues.",
  "data.file.notice-posts": "Les annonces publiées sur Discord.",
  "data.file.notice-reviews": "Les demandes de relecture des annonces.",
  "data.file.notice-review-outcomes": "Comment chaque demande de relecture s’est terminée.",
  "data.file.notice-pictures":
    "L’image de chaque annonce ; les fichiers sont dans le dossier pictures.",
  "data.file.roll-calls": "Les appels.",
  "data.file.roll-call-marks": "Chaque marque de chaque appel.",
  "data.file.roll-call-teams": "Les équipes de l’Elixir Scramble.",
  "data.file.follow-ups": "Les suivis : discuté, en pause, a besoin d’aide, tout va bien.",
  "data.file.thefts": "Le journal des vols.",
  "data.file.theft-steps": "Les étapes prises pour chaque attaquant.",
  "data.file.theft-attackers":
    "Le serveur de chaque attaquant, tel que les officiers l’ont indiqué.",
  "data.file.thanks": "Les remerciements de la semaine, tels que partagés.",
  "data.file.thanks-taken-down": "Les remerciements retirés du tableau des membres.",
  "data.file.start-here": "Commencer ici, dans chaque langue.",
  "data.file.screenshot-drafts": "Les imports de captures : le texte lu et les lignes trouvées.",
  "data.file.alliance-duel-points":
    "Les points de l’Alliance Duel enregistrés depuis des captures.",
  "data.file.screenshot-checks": "Les classements comparés au tracker : des nombres seulement.",
  "data.file.squads": "Les escouades lues sur le tracker.",
  "data.file.player-reads":
    "Chaque lecture d’un membre sur le tracker : bouclier, heure de la carte, puissance, éliminations, langue, serveur et VIP.",
  "data.file.player-history":
    "Puissance, éliminations et alliance de chaque membre au fil du temps, comme le tracker les garde.",
  "data.file.tracker-key-changes": "Qui a enregistré ou retiré la clé du tracker (jamais la clé).",
  "data.file.data-requests":
    "Les téléchargements de ces données, et les suppressions demandées ou annulées.",
  "data.file.activity":
    "L’activité récente de l’Accueil des deux dernières semaines, telle que l’Accueil la présente.",
  "data.deletedFile": "{what} Éléments supprimés.",
};
