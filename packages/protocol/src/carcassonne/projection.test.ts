import { describe, expect, it } from "vitest";
import { createCarcassonne } from "@catan/game-core/carcassonne";
import { projectCarcassonne } from "./index.js";
const state = createCarcassonne("match", [{ id: "a", name: "甲", color: "pine" }, { id: "b", name: "乙", color: "ocean" }], 42);
describe("carcassonne player projection", () => {
  it("hides the deck/seed and only projects the actor's authoritative choices", () => {
    const active = projectCarcassonne(state, "a"), waiting = projectCarcassonne(state, "b");
    expect(active.placements.length).toBeGreaterThan(0);
    expect(waiting.placements).toEqual([]);
    expect(active).not.toHaveProperty("deck"); expect(active).not.toHaveProperty("seed");
    expect(JSON.stringify(active)).not.toContain("seatToken");
    expect(active.remainingTiles).toBe(71);
    expect(() => projectCarcassonne(state, "stranger")).toThrow();
  });
  it("returns serializable independent board and player values", () => {
    const view = projectCarcassonne(state, "a");
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
    expect(view.board).not.toBe(state.board);
    expect(view.players[0]).not.toBe(state.players[0]);
  });
  it("keeps cached public derivations independent of caller mutations and other viewers", () => {
    const fresh = createCarcassonne("cached", state.players, 918), first = projectCarcassonne(fresh, "a");
    (first.regions[0]!.refs as string[]).push("injected");
    (first.placements[0]!.meepleOptions as string[]).push("injected");
    expect(JSON.stringify(projectCarcassonne(fresh, "a"))).not.toContain("injected");
    expect(projectCarcassonne(fresh, "b").placements).toEqual([]);
  });
});
