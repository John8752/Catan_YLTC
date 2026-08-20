import { createBaseGame, resourceAmounts, type GameEventRecord } from "@catan/game-core";
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

  it("projects only build actions the player can currently afford", () => {
    const game = createBaseGame({
      id: "game_affordances",
      seed: 11,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const actionGame = {
      ...game,
      phase: { kind: "turn" as const, activePlayerId: "player_1", step: "action" as const, turnNumber: 1 },
      buildings: [{ ownerId: "player_1", vertexId: game.map.vertices[0]?.id ?? "", kind: "settlement" as const }],
      players: game.players.map((player) => player.id === "player_1"
        ? { ...player, resources: resourceAmounts({ brick: 1 }) }
        : player),
    };

    const interaction = projectGameForPlayer(actionGame, "player_1").interaction;
    expect(interaction).toMatchObject({
      kind: "turn-action",
      roadEdgeIds: [],
      settlementVertexIds: [],
      cityVertexIds: [],
    });
  });

  it("expands production into exact public grants for every player", () => {
    const game = createBaseGame({
      id: "game_production_history",
      seed: 12,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const records = [{
      revision: 8,
      event: {
        type: "resources_produced",
        total: 6,
        grants: [
          { playerId: "player_1", resources: resourceAmounts({ brick: 1, lumber: 1 }) },
          { playerId: "player_3", resources: resourceAmounts({ ore: 2 }) },
        ],
      },
    }] satisfies GameEventRecord[];

    expect(projectGameForPlayer(game, "player_2", records).history.map((entry) => entry.message)).toEqual([
      "林 获得 1 砖、1 木",
      "陈 获得 2 矿",
    ]);
  });

  it("keeps trade responses and the chosen final exchange publicly auditable", () => {
    const game = createBaseGame({
      id: "game_trade_history",
      seed: 13,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const records = [
      { revision: 5, event: { type: "trade_response_recorded", offerId: "offer_1", playerId: "player_2", response: "accepted" } },
      {
        revision: 6,
        event: {
          type: "player_trade_completed",
          offerId: "offer_1",
          proposerId: "player_1",
          accepterId: "player_2",
          give: resourceAmounts({ brick: 2 }),
          receive: resourceAmounts({ grain: 1 }),
        },
      },
    ] satisfies GameEventRecord[];

    expect(projectGameForPlayer(game, "player_3", records).history.map((entry) => entry.message)).toEqual([
      "周 同意了交易报价",
      "林 给 周 2 砖，获得 1 麦",
    ]);
  });
});
