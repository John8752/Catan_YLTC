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

  it("reveals development card identities only to their owner", () => {
    const game = createBaseGame({
      id: "game_cards",
      seed: 7,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const withPrivateCard = {
      ...game,
      players: game.players.map((player) => player.id === "player_2"
        ? {
            ...player,
            developmentCards: [{ id: "secret_card", type: "victory-point" as const, acquiredTurn: 1 }],
          }
        : player),
    };

    const opponentView = projectGameForPlayer(withPrivateCard, "player_1");
    const ownerView = projectGameForPlayer(withPrivateCard, "player_2");

    expect(opponentView.players.find((player) => player.id === "player_2")?.developmentCardCount).toBe(1);
    expect(JSON.stringify(opponentView.players)).not.toContain("victory-point");
    expect(ownerView.you.developmentCards).toContainEqual(expect.objectContaining({ id: "secret_card" }));
  });

  it("redacts private event details from public history", () => {
    const game = createBaseGame({
      id: "game_history",
      seed: 9,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const records = [{
      revision: 2,
      event: {
        type: "development_card_bought" as const,
        playerId: "player_2",
        cardId: "secret_card",
        cardType: "victory-point",
      },
    }];

    expect(projectGameForPlayer(game, "player_1", records).history[0]?.privateDetail).toBeNull();
    expect(projectGameForPlayer(game, "player_2", records).history[0]?.privateDetail).toContain("victory-point");
  });
});
