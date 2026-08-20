import { createBaseGame } from "@catan/game-core";
import { describe, expect, it } from "vitest";
import { projectGameForPlayer } from "./views.js";

describe("player-safe game projections", () => {
  it("exposes the viewer hand and redacts every opponent hand", () => {
    const game = createBaseGame({
      id: "game_1",
      seed: 42,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const gameWithCards = {
      ...game,
      players: game.players.map((player) =>
        player.id === "player_2"
          ? { ...player, resources: { ...player.resources, ore: 3, grain: 2 } }
          : player,
      ),
    };

    const view = projectGameForPlayer(gameWithCards, "player_1");
    const serialized = JSON.stringify(view.players);

    expect(view.you.resources).toEqual({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 });
    expect(view.players.find((player) => player.id === "player_2")?.resourceCardCount).toBe(5);
    expect(serialized).not.toContain('"resources"');
  });
});
