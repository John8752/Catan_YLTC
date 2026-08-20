import { describe, expect, it } from "vitest";
import { initialResourceBank } from "./types.js";
import { resolveProductionClaims } from "./production.js";

describe("finite bank production", () => {
  it("withholds one resource from everyone when the bank cannot satisfy all claims", () => {
    const bank = { ...initialResourceBank(), ore: 2 };
    const result = resolveProductionClaims(bank, [
      { playerId: "player_1", resource: "ore", amount: 2 },
      { playerId: "player_2", resource: "ore", amount: 1 },
      { playerId: "player_2", resource: "grain", amount: 1 },
    ]);

    expect(result.bank.ore).toBe(2);
    expect(result.grants.get("player_1")?.ore).toBe(0);
    expect(result.grants.get("player_2")?.ore).toBe(0);
    expect(result.grants.get("player_2")?.grain).toBe(1);
  });
});
