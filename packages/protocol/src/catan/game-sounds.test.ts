import { createBaseGame, type GameEventRecord } from "@catan/game-core/catan";
import { expect, it } from "vitest";
import { projectPlayerSafeEffect } from "./game-effects.js";
import { projectGameForPlayer } from "./views.js";

it.each([[1, 1], [3, 4], [6, 6]] as const)("projects an audible roll even for seven or no production: %s + %s", (a, b) => {
  const record: GameEventRecord = { revision: 9, event: { type: "dice_rolled", playerId: "p1", dice: [a, b] } };
  for (const viewer of ["p1", "p2"]) {
    expect(projectPlayerSafeEffect(record, viewer)).toEqual([{ kind: "dice-roll", id: "9:dice-roll", revision: 9, playerId: "p1" }]);
  }
});

it("marks only the viewer's turn opportunities for the chime", () => {
  const base = createBaseGame({ id: "sounds", seed: 42, players: [
    { id: "p1", name: "甲", color: "terracotta" }, { id: "p2", name: "乙", color: "ocean" },
  ] });
  for (const step of ["roll", "action", "robber", "free-road", "discard"] as const) {
    const state = { ...base, phase: { kind: "turn" as const, step, turnNumber: 1, activePlayerId: "p1" } };
    const sounds = (viewer: string) => projectGameForPlayer(state, viewer).effects.filter((e) => e.kind === "action-attention" && e.sound);
    expect(sounds("p1")).toHaveLength(step === "roll" || step === "action" ? 1 : 0);
    expect(sounds("p2")).toEqual([]);
  }
});
