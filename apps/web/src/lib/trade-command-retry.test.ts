import { resourceAmounts } from "@catan/game-core";
import type { GameCommand, GameView } from "@catan/protocol";
import { describe, expect, it } from "vitest";
import { canRetryStaleTradeCommand } from "./trade-command-retry.js";

type OpenTrade = NonNullable<GameView["openTrade"]>;

const offer: OpenTrade = {
  offerId: "offer_1",
  proposerId: "player_1",
  give: resourceAmounts({ brick: 1 }),
  receive: resourceAmounts({ ore: 1 }),
  responses: [{ playerId: "player_2", response: "accepted" }],
};

describe("stale trade command retry", () => {
  it("retries responses and cancellation when only unrelated responses changed", () => {
    const updated: OpenTrade = {
      ...offer,
      responses: [...offer.responses, { playerId: "player_3", response: "declined" }],
    };

    expect(retry({ type: "AcceptTradeOffer", offerId: offer.offerId }, offer, updated, "player_2")).toBe(true);
    expect(retry({ type: "DeclineTradeOffer", offerId: offer.offerId }, offer, updated, "player_2")).toBe(true);
    expect(retry({ type: "CancelTradeOffer", offerId: offer.offerId }, offer, updated, "player_1")).toBe(true);
  });

  it("retries completion only while the selected response terms are unchanged", () => {
    const command: GameCommand = { type: "CompleteTradeOffer", offerId: offer.offerId, partnerId: "player_2" };
    const unrelatedResponse: OpenTrade = {
      ...offer,
      responses: [...offer.responses, { playerId: "player_3", response: "declined" }],
    };
    const changedTerms: OpenTrade = {
      ...offer,
      responses: [{
        playerId: "player_2",
        response: "countered",
        proposerGives: resourceAmounts({ lumber: 1 }),
        proposerReceives: resourceAmounts({ grain: 1 }),
      }],
    };

    expect(retry(command, offer, unrelatedResponse, "player_1")).toBe(true);
    expect(retry(command, offer, changedTerms, "player_1")).toBe(false);
  });

  it("does not retry against a replaced offer or for non-trade commands", () => {
    expect(retry(
      { type: "AcceptTradeOffer", offerId: offer.offerId },
      offer,
      { ...offer, offerId: "offer_2" },
      "player_2",
    )).toBe(false);
    expect(retry({ type: "EndTurn" }, offer, offer, "player_1")).toBe(false);
  });
});

function retry(command: GameCommand, before: OpenTrade, after: OpenTrade, actorId: string): boolean {
  return canRetryStaleTradeCommand(command, before, after, actorId);
}
