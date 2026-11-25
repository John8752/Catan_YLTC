import { describe, expect, it } from "vitest";
import { createPoker, DEFAULT_POKER_SETTINGS, freshDeck, actPoker } from "@catan/game-core/texas-holdem";
import { projectPoker } from "./index.js";
describe("texas-holdem privacy", () => {
  it("whitelists each player's cards and never exposes deck, burn or future board", () => {
    const s = createPoker("m", ["a", "b", "c"].map((id) => ({ id, name: id })), DEFAULT_POKER_SETTINGS, freshDeck());
    for (const id of ["a", "b", "c", "stranger"]) {
      const v = projectPoker(s, id);
      expect(v).not.toHaveProperty("deck"); expect(v).not.toHaveProperty("cursor");
      for (const p of v.players) expect(p.hole).toEqual(p.id === id ? s.players.find((q) => q.id === id)!.hole : null);
      expect(v.board).toEqual([]); expect(v.result).toBeNull();
      expect(JSON.stringify(v.effects)).not.toMatch(/hole|deck|cursor|burn/);
      expect(v.effects.every((e) => e.id.startsWith(`${s.id}:${s.revision}:`))).toBe(true);
    }
  });
  it("projects accepted actions, collections, public reveals and awards with stable unique IDs", () => {
    let s = createPoker("m", ["a", "b"].map((id) => ({ id, name: id })), DEFAULT_POKER_SETTINGS, freshDeck());
    s = actPoker(s, "a", { type: "all-in" });
    expect(projectPoker(s, "b").effects).toContainEqual({ id: "m:2:0", kind: "action", playerId: "a", action: "all-in", paid: 990, total: 1000 });
    s = actPoker(s, "b", { type: "call" }); const v = projectPoker(s, "a");
    expect(v.effects.map((e) => e.kind)).toEqual(expect.arrayContaining(["action", "collect", "board", "award"]));
    expect(new Set(v.effects.map((e) => e.id)).size).toBe(v.effects.length);
    expect(projectPoker(s, "a").effects).toEqual(v.effects);
    expect(JSON.stringify(v.effects)).not.toMatch(/hole|deck|burn|cards/);
  });
  it("keeps folded and uncontested winner cards private after a fold win", () => {
    const s = createPoker("m", ["a", "b"].map((id) => ({ id, name: id })), DEFAULT_POKER_SETTINGS, freshDeck());
    const next = actPoker(s, "a", { type: "fold" }), v = projectPoker(next, "a");
    expect(v.players[1]!.hole).toBeNull(); expect(v.result!.shown).toEqual([]);
    expect(v.players[0]!.hole).toEqual(s.players[0]!.hole);
  });
  it("reveals contenders at showdown and owns its projection copies", () => {
    let s = createPoker("m", ["a", "b"].map((id) => ({ id, name: id })), DEFAULT_POKER_SETTINGS, freshDeck());
    s = actPoker(s, "a", { type: "all-in" }); s = actPoker(s, "b", { type: "call" });
    const v = projectPoker(s, "stranger");
    expect(v.result!.shown).toHaveLength(2); expect(v.players.every((p) => p.hole?.length === 2)).toBe(true);
    v.players[0]!.hole!.pop(); v.result!.shown[0]!.hole.pop(); v.board.pop();
    expect(s.players[0]!.hole).toHaveLength(2); expect(s.result!.shown[0]!.hole).toHaveLength(2); expect(s.board).toHaveLength(5);
  });
});
