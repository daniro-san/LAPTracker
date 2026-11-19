import { describe, expect, it } from "vitest";

import { theftWarnings } from "./theft-warning";

describe("the warning to paste in game mail (issue 321)", () => {
  it("says what was reported, when, and that we share a server, in English, Portuguese and French", () => {
    const input = {
      name: "Pebblewick",
      tag: "OGs",
      server: 325,
      count: 3,
      // 01:30 UTC is still Nov 15 on the server's clock (UTC-2).
      lastAt: new Date("2026-11-16T01:30:00Z"),
      zone: "Etc/GMT+2",
    };
    expect(theftWarnings(input)).toEqual({
      en: "Hello Pebblewick, this is the leadership of [OGs]. Our members reported 3 thefts by you. The last one was on November 15 (server time). We are on the same server, #325. Please take from the enemy server in KvK, not from players of your own server. Thank you.",
      "pt-BR":
        "Olá, Pebblewick. Aqui é a liderança da [OGs]. Nossos membros relataram 3 roubos seus. O último foi em 15 de novembro (horário do servidor). Estamos no mesmo servidor, #325. Por favor, roube do servidor inimigo no KvK, não de jogadores do seu próprio servidor. Obrigado.",
      fr: "Bonjour Pebblewick, ici la direction de [OGs]. Nos membres ont signalé 3 vols de votre part. Le dernier date du 15 novembre (heure du serveur). Nous sommes sur le même serveur, le #325. Merci de prendre au serveur ennemi en KvK, pas aux joueurs de votre propre serveur. Bonne journée.",
    });
    // One theft whose time was not read: the singular, and no day.
    expect(theftWarnings({ ...input, count: 1, lastAt: null }).en).toBe(
      "Hello Pebblewick, this is the leadership of [OGs]. One of our members reported a theft by you. We are on the same server, #325. Please take from the enemy server in KvK, not from players of your own server. Thank you.",
    );
  });
});
