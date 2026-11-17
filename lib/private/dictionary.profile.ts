// The officer's settings sheet's words in English (D87), split from dictionary.ts for its size (the English
// source stays under 300 lines by spreading blocks in, as D88 does for the public copy); the pt-BR and fr
// dictionaries hold these keys inline.
export const profileEn = {
  "profile.title": "Your settings",
  "profile.name": "Your name",
  "profile.nameHelp": "Shown at the top of the desk (up to 32 characters).",
  "profile.save": "Save",
  "profile.saved": "Saved.",
  "profile.invalid": "Write 1 to 32 characters.",
  "profile.failed": "Could not save. Try again.",
  "profile.loadFailed": "Could not load this. Close and try again.",
  "profile.me": "This is me",
  "profile.me.lead": "Optional: tell the desk which player in the alliance is you.",
  "profile.me.loading": "Looking for your name in the alliance…",
  "profile.me.linked": "In the game, you are {name}.",
  "profile.me.gone": "Your player is no longer in the alliance.",
  "profile.me.unlink": "This isn’t me",
  "profile.me.undo": "You can remove this link any time.",
  "profile.me.ask": "Is this you?",
  "profile.me.confirm": "That’s me",
  "profile.me.none": "No one in the alliance has a name like yours. Search for your name below.",
  "profile.me.find": "Search the alliance",
  "profile.me.noResult": "No one in the alliance has a name like that.",
  "profile.theme": "Theme",
  "profile.theme.light": "Light",
  "profile.theme.dark": "Dark",
  "profile.theme.system": "Same as this device",
} as const;
