// The /brand guidelines page's text (app/(pages)/brand/*), re-exported as `copy.brand` from lib/copy.ts
// so every string still has one import path.
import { brandComponentsCopy } from "./copy-brand-components";

export const brandCopy = {
  title: "Brand guidelines",
  intro:
    "How the Event Ledger looks, draws and speaks. Every piece on this page is the one the site uses.",
  unit: "px",
  do: "Do",
  dont: "Don't",
  nav: {
    label: "Sections",
    logo: "Logo",
    colour: "Colour",
    type: "Type",
    drawing: "Drawing",
    components: "Components",
    voice: "Voice",
  },
  logo: {
    title: "Logo",
    lede: "A plague doctor in profile under a wide brim, a ball of yarn and two needles in the hatband. One colour, three cuts.",
    line: {
      name: "Line mark",
      use: "The drawing itself: the seal button, app icons, the link preview.",
    },
    waxed: {
      name: "Waxed mark",
      use: "The mark pressed into wax. Ivory in the header, with the solid cut; red and gold are spare.",
    },
    tones: { paper: "Ivory", seal: "Red", yarn: "Gold" },
    solid: {
      name: "Solid mark",
      use: "The cut for small sizes: the favicon and the header seal. Line detail blurs there, so this one is filled.",
    },
    clearTitle: "Clear space",
    clear:
      "Keep a quarter of the mark's width empty on every side. In wax, the seal is the clear space.",
    clearLabel: "¼",
    minTitle: "Minimum sizes",
    minLine:
      "Line mark: 96 px and up. The one exception is the seal button, where the line mark is pressed into red wax at 24 px.",
    minSolid: "Solid mark: 16 to 32 px, and only there.",
    useTitle: "Correct and incorrect use",
    dos: ["Plum on paper", "Paper on plum", "Ivory wax on the header"],
    donts: ["Stretched", "Rotated", "In a colour that means something", "Line mark below 96 px"],
  },
  colour: {
    title: "Colour",
    lede: "Paper and ink carry the page. Plum, seal and yarn each mean one thing; nothing decorative uses them. Dark mode is the same ledger by lamplight: the values swap, the roles do not.",
    light: "Light",
    dark: "Dark",
    names: {
      paper: "Paper",
      ink: "Ink",
      plum: "Plum",
      seal: "Seal",
      yarn: "Yarn",
      sage: "Sage",
      rule: "Rule",
    },
    roles: {
      paper: "The page",
      ink: "All text; muted text is ink at 70 %",
      plum: "Header, links, primary actions, focus rings",
      seal: "Losses, errors, stale, the seal button",
      yarn: "Gains, highlights",
      sage: "Neutral badges: test, source, manual",
      rule: "Borders and table rules",
    },
    rules: [
      "Deltas are coloured by sign only: yarn up, seal down.",
      "Colour never works alone: every state also has an arrow or icon and a word.",
      "Text contrast 4.5:1 or more, large numerals 3:1, in both modes.",
      "No gradients, glow or blur. The bottom sheet's shadow is the only shadow.",
    ],
  },
  type: {
    title: "Type",
    lede: "Three families, each with one job. No fourth, no italics in headings, no all-caps display.",
    specimen: "Aa",
    faces: {
      display: {
        name: "Young Serif",
        role: "Primary display: page titles, the wordmark, error lines. One weight, never below 20 px.",
      },
      subhead: {
        name: "Alegreya Sans 700",
        role: "Secondary display: section and card titles, the empty-state line.",
      },
      body: {
        name: "Source Sans 3",
        role: "Text, controls, labels and every number. Numerals are tabular and right-aligned.",
      },
    },
    scaleTitle: "Scale",
    scale: {
      displayXl: {
        sample: "Grandma wandered off.",
        spec: "48 / 1.05 · Young Serif",
        use: "Error-page line",
      },
      displayLg: { sample: "Event Ledger", spec: "32 / 1.1 · Young Serif", use: "Page title" },
      displayMd: {
        sample: "Grandma noticed",
        spec: "24 / 1.15 · Alegreya Sans 700",
        use: "Section and header title",
      },
      displaySm: {
        sample: "The kettle is on.",
        spec: "20 / 1.2 · Alegreya Sans 700",
        use: "Card title, empty-state line",
      },
      body: {
        sample: "Might, kills and members, before and after.",
        spec: "16 / 1.5 · Source Sans 3",
        use: "Copy, buttons, inputs",
      },
      bodySm: {
        sample: "Updated 16:01 server time.",
        spec: "14 / 1.45 · Source Sans 3",
        use: "Timeline lines, help text",
      },
      numeral: {
        sample: "3,941,203,118",
        spec: "16 / 1.3 · Source Sans 3 500, tabular",
        use: "Every number in tables and cards",
      },
      label: {
        sample: "Members",
        spec: "12 / 1.3 · Source Sans 3 600, tracked",
        use: "Column headers, badges",
      },
    },
  },
  drawing: {
    title: "Drawing style",
    lede: "The confident nib. Everything drawn for the brand is drawn in one hand, so a new drawing sits in the same family. The full method is docs/brand/DRAWING.md.",
    rules: [
      "Lines are filled shapes that swell in the middle and taper to a point at both ends, like a dip pen.",
      "Two weights: heavy outer contours, inner details about half as heavy.",
      "Curves wobble slightly and leave a gap where the pen would lift. No perfect circles.",
      "Texture is hatching: a few short tapered strokes, never a fill or a tone.",
      "Small solid accents only: pupils, rivets, knobs. Large solid areas belong to the small mark cut.",
      "One colour, no gradients, masks or text, under 4 KB per drawing.",
      "Below 32 px the hand disappears: use a filled shape or a crisp geometric icon.",
    ],
    vignettes: "Vignettes",
    yarn: "Yarn left behind · 404",
    bottle: "Bottle broken in two · 500",
    teacup: "Teacup · spare",
    mascot: "The Granny Doctor",
    mascotNote: "A supporting detail, never the focus.",
    standing: "Standing · footer of error and player pages",
    tea: "Tea · empty state",
    ornaments: "Ornaments",
    wax: "Wax · seals and the header mark",
    hourglass: "Hourglass · running",
    crown: "Crown · alliance leader (R5)",
    titles: "Dove, horn, crossed swords, eye · Diplomat, Recruiter, God of War, Goddess (R4)",
    officer: "Stitch star · officer with any other title (R4)",
    candle: "Chamberstick · admin live indicator",
  },
  components: brandComponentsCopy,
  voice: {
    title: "Voice",
    lede: "Short, dry, grandmotherly: written in English, read in 18 languages. The ledger belongs to the server and is kept by the Old Grandmas; another alliance reading it should feel invited, not visiting.",
    rules: [
      "Title and byline: Server 325 · Event Ledger, kept by the Old Grandmas.",
      "Labels are the game's own words: Might, Kills, Members.",
      "Sentences live in the margins: empty states, error pages, section titles, admin. Status is chips.",
      "No exclamation marks, no emoji, no Oops, no Awesome.",
    ],
    samplesTitle: "In the ledger's words",
    quota: "The ledger is closed for today (quota exhausted).",
    pairs: [
      { do: "Nothing recorded yet. The kettle is on.", dont: "Oops! No data yet!" },
      { do: "Something cracked.", dont: "Awesome, an error occurred!" },
    ],
  },
} as const;
