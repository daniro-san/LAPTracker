// The three typefaces of docs/DESIGN.md (owner, brand review H2, 2026-11-10): Alegreya for page titles, Alegreya
// Sans for section and card titles, Source Sans 3 for body and numbers; self-hosted by next/font (CSP font-src 'self'), all OFL.
// `fontVariables` goes on the element whose subtree uses the font-display / font-body utilities.
import { Alegreya, Alegreya_Sans, Source_Sans_3 } from "next/font/google";

const alegreya = Alegreya({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "vietnamese", "greek"],
  weight: "400",
  display: "swap",
  variable: "--font-alegreya",
});

const alegreyaSans = Alegreya_Sans({
  subsets: ["latin"],
  weight: "700",
  display: "swap",
  variable: "--font-alegreya-sans",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-source-sans",
});

export const fontVariables = `${alegreya.variable} ${alegreyaSans.variable} ${sourceSans.variable}`;
