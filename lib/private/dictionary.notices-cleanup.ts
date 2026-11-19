// The weekly cleanup of notice pictures (D119, owner 2026-11-18) in English, Brazilian Portuguese and French:
// Home's warning card, the review list with Keep, Download and "Use in another notice", and the editor's
// "Kept" mark. Spread into the notices' words by dictionary.notices.ts. Portuguese says "imagem"; French
// puts a no-break space before : ; ! and ? and inside « ».
export const noticesCleanupEn = {
  "notices.picture.kept": "Kept",
  "notices.picture.keptBy": "{name} kept it on {date}. The weekly cleanup never deletes it.",
  "notices.picture.someone": "An officer",
  "notices.picture.unkeep": "Stop keeping",
  "notices.picture.keepFailed": "That did not change. Try again.",
  "notices.pictures.title": "Pictures to be deleted",
  "notices.pictures.lead":
    "The weekly cleanup deletes a notice’s picture 90 days after the notice ends. The notice and its text stay. Keep the pictures you still need, save them, or use them in another notice.",
  "notices.pictures.cardTitle": "Pictures to be deleted soon",
  "notices.pictures.one": "The picture of {title} will be deleted after {date}.",
  "notices.pictures.many": "The pictures of {n} notices will be deleted after {date}: {titles}.",
  "notices.pictures.more": "and {n} more",
  "notices.pictures.review": "Review them",
  "notices.pictures.after": "Deleted after {date}",
  "notices.pictures.keep": "Keep",
  "notices.pictures.keptDone": "Kept. The weekly cleanup will never delete it.",
  "notices.pictures.download": "Download",
  "notices.pictures.reuse": "Use in another notice",
  "notices.pictures.reuseTo": "Copy it to",
  "notices.pictures.reuseHelp":
    "That notice gets its own copy. If it already has a picture, this one replaces it.",
  "notices.pictures.copy": "Copy",
  "notices.pictures.reused": "Copied to “{title}”.",
  "notices.pictures.failed": "That did not work. Try again.",
  "notices.pictures.none": "No picture is due for the cleanup.",
} as const;

export const noticesCleanupPt: Record<keyof typeof noticesCleanupEn, string> = {
  "notices.picture.kept": "Mantida",
  "notices.picture.keptBy": "{name} manteve em {date}. A limpeza semanal nunca a apaga.",
  "notices.picture.someone": "Um oficial",
  "notices.picture.unkeep": "Deixar de manter",
  "notices.picture.keepFailed": "Não mudou. Tente de novo.",
  "notices.pictures.title": "Imagens que serão apagadas",
  "notices.pictures.lead":
    "A limpeza semanal apaga a imagem de um aviso 90 dias depois que o aviso termina. O aviso e o texto ficam. Mantenha as imagens que ainda precisa, baixe ou use em outro aviso.",
  "notices.pictures.cardTitle": "Imagens que serão apagadas em breve",
  "notices.pictures.one": "A imagem de {title} será apagada depois de {date}.",
  "notices.pictures.many": "As imagens de {n} avisos serão apagadas depois de {date}: {titles}.",
  "notices.pictures.more": "e mais {n}",
  "notices.pictures.review": "Revisar",
  "notices.pictures.after": "Apagada depois de {date}",
  "notices.pictures.keep": "Manter",
  "notices.pictures.keptDone": "Mantida. A limpeza semanal nunca vai apagá-la.",
  "notices.pictures.download": "Baixar",
  "notices.pictures.reuse": "Usar em outro aviso",
  "notices.pictures.reuseTo": "Copiar para",
  "notices.pictures.reuseHelp":
    "Esse aviso recebe a própria cópia. Se ele já tem uma imagem, esta a substitui.",
  "notices.pictures.copy": "Copiar",
  "notices.pictures.reused": "Copiada para “{title}”.",
  "notices.pictures.failed": "Não deu certo. Tente de novo.",
  "notices.pictures.none": "Nenhuma imagem está na vez da limpeza.",
};

export const noticesCleanupFr: Record<keyof typeof noticesCleanupEn, string> = {
  "notices.picture.kept": "Conservée",
  "notices.picture.keptBy":
    "{name} l’a conservée le {date}. Le nettoyage hebdomadaire ne la supprime jamais.",
  "notices.picture.someone": "Un officier",
  "notices.picture.unkeep": "Ne plus conserver",
  "notices.picture.keepFailed": "Rien n’a changé. Réessayez.",
  "notices.pictures.title": "Images bientôt supprimées",
  "notices.pictures.lead":
    "Le nettoyage hebdomadaire supprime l’image d’une annonce 90 jours après la fin de l’annonce. L’annonce et son texte restent. Conservez les images dont vous avez encore besoin, téléchargez-les ou utilisez-les dans une autre annonce.",
  "notices.pictures.cardTitle": "Images bientôt supprimées",
  "notices.pictures.one": "L’image de {title} sera supprimée après le {date}.",
  "notices.pictures.many":
    "Les images de {n} annonces seront supprimées après le {date} : {titles}.",
  "notices.pictures.more": "et {n} autres",
  "notices.pictures.review": "Les passer en revue",
  "notices.pictures.after": "Supprimée après le {date}",
  "notices.pictures.keep": "Conserver",
  "notices.pictures.keptDone": "Conservée. Le nettoyage hebdomadaire ne la supprimera jamais.",
  "notices.pictures.download": "Télécharger",
  "notices.pictures.reuse": "Utiliser dans une autre annonce",
  "notices.pictures.reuseTo": "La copier dans",
  "notices.pictures.reuseHelp":
    "Cette annonce reçoit sa propre copie. Si elle a déjà une image, celle-ci la remplace.",
  "notices.pictures.copy": "Copier",
  "notices.pictures.reused": "Copiée dans « {title} ».",
  "notices.pictures.failed": "Cela n’a pas marché. Réessayez.",
  "notices.pictures.none": "Aucune image n’est concernée par le nettoyage.",
};
