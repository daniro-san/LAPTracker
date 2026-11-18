// A notice's picture (D119) in English, Brazilian Portuguese and French, apart from dictionary.notices.ts for
// its size; that module spreads these into the notices' words. Portuguese says "imagem" (a "print" is a
// screenshot read for data, D110). French puts a no-break space before : ; ! and ? and inside « ».
export const noticesPictureEn = {
  "notices.picture": "Picture",
  "notices.picture.help":
    "One picture for every language. It shows on this notice, on the members’ board when members can see the notice, and with the Discord post. It is made smaller and its location data removed before it is sent.",
  "notices.picture.add": "Add a picture",
  "notices.picture.replace": "Replace",
  "notices.picture.remove": "Remove",
  "notices.picture.undo": "Undo",
  "notices.picture.preparing": "Preparing the picture…",
  "notices.picture.unusable": "This picture could not be used. Try another one.",
  "notices.picture.new": "New picture. It is saved when you press Save.",
  "notices.picture.removing": "The picture is removed when you press Save.",
  "notices.picture.failed":
    "The picture was not saved, and nothing else was. Press Save to try again.",
  "notices.picture.notSent":
    "The notice is saved, but its picture is not. Press Save again to send the picture.",
  "notices.picture.alt": "Picture for “{title}”",
} as const;

export const noticesPicturePt: Record<keyof typeof noticesPictureEn, string> = {
  "notices.picture": "Imagem",
  "notices.picture.help":
    "Uma imagem para todos os idiomas. Ela aparece neste aviso, no mural dos membros quando os membros podem ver o aviso, e junto da publicação no Discord. Ela é reduzida e os dados de localização são removidos antes do envio.",
  "notices.picture.add": "Adicionar imagem",
  "notices.picture.replace": "Trocar",
  "notices.picture.remove": "Remover",
  "notices.picture.undo": "Desfazer",
  "notices.picture.preparing": "Preparando a imagem…",
  "notices.picture.unusable": "Não foi possível usar esta imagem. Tente outra.",
  "notices.picture.new": "Imagem nova. Ela é salva quando você tocar em Salvar.",
  "notices.picture.removing": "A imagem é removida quando você tocar em Salvar.",
  "notices.picture.failed":
    "A imagem não foi salva, nem o resto. Toque em Salvar para tentar de novo.",
  "notices.picture.notSent":
    "O aviso foi salvo, mas a imagem não. Toque em Salvar de novo para enviar a imagem.",
  "notices.picture.alt": "Imagem de “{title}”",
};

export const noticesPictureFr: Record<keyof typeof noticesPictureEn, string> = {
  "notices.picture": "Image",
  "notices.picture.help":
    "Une image pour toutes les langues. Elle s’affiche sur cette annonce, sur le tableau des membres quand les membres peuvent voir l’annonce, et avec la publication Discord. Elle est réduite et ses données de localisation sont retirées avant l’envoi.",
  "notices.picture.add": "Ajouter une image",
  "notices.picture.replace": "Remplacer",
  "notices.picture.remove": "Retirer",
  "notices.picture.undo": "Annuler",
  "notices.picture.preparing": "Préparation de l’image…",
  "notices.picture.unusable": "Impossible d’utiliser cette image. Essayez-en une autre.",
  "notices.picture.new": "Nouvelle image. Elle est enregistrée quand vous appuyez sur Enregistrer.",
  "notices.picture.removing": "L’image est retirée quand vous appuyez sur Enregistrer.",
  "notices.picture.failed":
    "L’image n’a pas été enregistrée, ni le reste. Appuyez sur Enregistrer pour réessayer.",
  "notices.picture.notSent":
    "L’annonce est enregistrée, mais pas son image. Appuyez de nouveau sur Enregistrer pour envoyer l’image.",
  "notices.picture.alt": "Image de l’annonce « {title} »",
};
