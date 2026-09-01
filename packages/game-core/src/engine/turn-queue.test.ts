import { describe, expect, it } from "vitest";
import { createGame } from "./create-game.js";
import type { GameState, PlayerSeed } from "./state.js";
import { turnOpportunityQueue } from "./turn-queue.js";

const players: readonly PlayerSeed[] = [
  { id: "p1", name: "一", color: "terracotta" },
  { id: "p2", name: "二", color: "ocean" },
  { id: "p3", name: "三", color: "pine" },
  { id: "p4", name: "四", color: "wheat" },
  { id: "p5", name: "五", color: "plum" },
  { id: "p6", name: "六", color: "charcoal" },
];

describe("turn opportunity queue", () => {
  it("follows ordinary primary turns in seat order", () => {
    const base = createGame({ id: "base_queue", seed: 42, players: players.slice(0, 4), ruleProfile: "base-3-4" });
    const state: GameState = {
      ...base,
      phase: { kind: "turn", activePlayerId: "p2", step: "action", turnNumber: 7 },
    };

    expect(turnOpportunityQueue(state, 4)).toEqual([
      { playerId: "p2", kind: "primary", turnNumber: 7 },
      { playerId: "p3", kind: "primary", turnNumber: 8 },
      { playerId: "p4", kind: "primary", turnNumber: 9 },
      { playerId: "p1", kind: "primary", turnNumber: 10 },
    ]);
  });

  it("interleaves primary and third-left paired opportunities", () => {
    const base = createGame({ id: "extended_queue", seed: 42, players, ruleProfile: "extended-5-6" });
    const state: GameState = {
      ...base,
      phase: { kind: "turn", activePlayerId: "p1", step: "action", turnNumber: 4 },
    };

    expect(turnOpportunityQueue(state, 7)).toEqual([
      { playerId: "p1", kind: "primary", turnNumber: 4 },
      { playerId: "p4", kind: "paired", turnNumber: 4 },
      { playerId: "p2", kind: "primary", turnNumber: 5 },
      { playerId: "p5", kind: "paired", turnNumber: 5 },
      { playerId: "p3", kind: "primary", turnNumber: 6 },
      { playerId: "p6", kind: "paired", turnNumber: 6 },
      { playerId: "p4", kind: "primary", turnNumber: 7 },
    ]);
  });

  it("continues from a paired player's mandatory sub-step", () => {
    const base = createGame({ id: "paired_queue", seed: 42, players, ruleProfile: "extended-5-6" });
    const state: GameState = {
      ...base,
      phase: { kind: "turn", activePlayerId: "p4", primaryPlayerId: "p1", step: "free-road", turnNumber: 4 },
    };

    expect(turnOpportunityQueue(state, 3)).toEqual([
      { playerId: "p4", kind: "paired", turnNumber: 4 },
      { playerId: "p2", kind: "primary", turnNumber: 5 },
      { playerId: "p5", kind: "paired", turnNumber: 5 },
    ]);
  });
});
