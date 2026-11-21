// The card a Follow-up panel holds (issue 460, D140): after a facts save the panel reads the card again and
// shows nothing older meanwhile, so a second edit starts from the new versions; a failed or signed-out read
// says so instead of "No notes yet".
import { describe, expect, it } from "vitest";

import type { CardData } from "@/lib/private/member-card";

import { panelCard } from "./follow-up-card";
import { SIGNED_OUT } from "./SignedOut";

const card = { uid: 7, stored: { timeZone: { version: 1 } } } as unknown as CardData;

describe("the Follow-up panel's card (D140)", () => {
  it("drops the card read before a save until the next read is in", () => {
    const first = { uid: 7, attempt: 0, answer: card };
    expect(panelCard(first, 7, 0)).toEqual({ status: "ok", data: card });
    // The editor saved and closed: read number 1 is under way, so the old versions are not offered.
    expect(panelCard(first, 7, 1)).toEqual({ status: "loading", data: null });
    const newer = { ...card, stored: { timeZone: { version: 2 } } } as unknown as CardData;
    expect(panelCard({ uid: 7, attempt: 1, answer: newer }, 7, 1).data).toBe(newer);
  });

  it("tells a failed read and a signed-out one apart from a card with no notes", () => {
    expect(panelCard({ uid: 7, attempt: 0, answer: null }, 7, 0).status).toBe("failed");
    expect(panelCard({ uid: 7, attempt: 0, answer: SIGNED_OUT }, 7, 0).status).toBe("signed_out");
    expect(panelCard({ uid: 8, attempt: 0, answer: card }, 7, 0).status).toBe("loading");
  });
});
