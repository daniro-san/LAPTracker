// The two typefaces of docs/DESIGN.md, self-hosted by next/font (CSP font-src 'self'). Both are OFL.
// `fontVariables` goes on the element whose subtree uses the font-display / font-body utilities.
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
  variable: "--font-cormorant",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-source-sans",
});

export const fontVariables = `${cormorant.variable} ${sourceSans.variable}`;
