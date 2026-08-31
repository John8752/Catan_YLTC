import { createBaseGame } from "@catan/game-core";
import { expect, it } from "vitest";
import { projectGameForPlayer } from "./views.js";

it("redacts live bank stock for every seat without changing authoritative supplies", () => {
  const state = createBaseGame({ id: "hidden-bank", seed: 42, players: [
    { id: "p1", name: "甲", color: "terracotta" },
    { id: "p2", name: "乙", color: "ocean" },
    { id: "p3", name: "丙", color: "pine" },
  ] });
  for (const player of state.players) {
    expect(projectGameForPlayer(state, player.id).bankResources).toEqual(state.bank);
    const hidden = projectGameForPlayer(state, player.id, [], null, { bankCountsPublic: false });
    expect(hidden.bankResources).toBeNull();
    expect(JSON.parse(JSON.stringify(hidden)).bankResources).toBeNull();
    expect(hidden.you.resources).toEqual(player.resources);
  }
  expect(state.bank.brick).toBe(19);
});
