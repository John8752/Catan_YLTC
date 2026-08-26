import { createBaseGame, resourceAmounts, type GameEventRecord } from "@catan/game-core";
import { describe, expect, it } from "vitest";
import { MAX_PROJECTED_EVENT_RECORDS, projectGameForPlayer } from "./views.js";

describe("player-safe game projections", () => {
  it("carries the server phase deadline without making the client authoritative", () => {
    const game = createBaseGame({
      id: "game_timer_projection",
      seed: 41,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const timer = {
      playerId: "player_1",
      kind: "roll" as const,
      durationMs: 5_000,
      deadlineAt: 105_000,
      serverNow: 100_000,
    };

    expect(projectGameForPlayer(game, "player_1", [], timer).turnTimer).toEqual(timer);
    expect(projectGameForPlayer(game, "player_1").turnTimer).toBeNull();
  });

  it("carries only the most recent event records, keeping the newest", () => {
    const game = createBaseGame({
      id: "game_capped",
      seed: 42,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const overflow = MAX_PROJECTED_EVENT_RECORDS + 50;
    const hexId = game.map.hexes[0]?.id ?? "hex_0_0";
    const vertexId = game.map.vertices[0]?.id ?? "vertex_00";
    // Production events, so the cap is exercised on effects as well as the log.
    const records: GameEventRecord[] = Array.from({ length: overflow }, (_, index) => ({
      revision: index + 1,
      event: {
        type: "resources_produced",
        total: 1,
        grants: [{ playerId: "player_1", resources: resourceAmounts({ grain: 1 }) }],
        sources: [{ playerId: "player_1", resource: "grain", amount: 1, hexId, vertexId }],
        triggeredHexIds: [hexId],
      },
    }));

    const view = projectGameForPlayer(game, "player_1", records);
    const oldestKept = overflow - MAX_PROJECTED_EVENT_RECORDS + 1;

    expect(view.history).toHaveLength(MAX_PROJECTED_EVENT_RECORDS);
    // The tail is what players and the effect queue need; the oldest entries go.
    expect(view.history.at(-1)?.revision).toBe(overflow);
    expect(view.history.at(0)?.revision).toBe(oldestKept);
    expect(view.effects).toHaveLength(MAX_PROJECTED_EVENT_RECORDS);
    expect(view.effects.at(0)?.revision).toBe(oldestKept);
  });

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

  it("projects public bank supply, remaining pieces and road achievements", () => {
    const game = createBaseGame({
      id: "game_public_supplies",
      seed: 43,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const [firstEdge, secondEdge] = game.map.edges;
    if (firstEdge === undefined || secondEdge === undefined) throw new Error("Map needs test edges");
    const publicState = {
      ...game,
      bank: resourceAmounts({ brick: 17, lumber: 16, wool: 15, grain: 14, ore: 13 }),
      roads: [
        { ownerId: "player_2", edgeId: firstEdge.id },
        { ownerId: "player_2", edgeId: secondEdge.id },
      ],
      players: game.players.map((player) => player.id === "player_2"
        ? {
            ...player,
            pieces: { roads: 13, settlements: 3, cities: 4 },
            playedKnights: 2,
          }
        : player),
    };

    const view = projectGameForPlayer(publicState, "player_1");
    const opponent = view.players.find((player) => player.id === "player_2");

    expect(view.bankResources).toEqual(resourceAmounts({ brick: 17, lumber: 16, wool: 15, grain: 14, ore: 13 }));
    expect(opponent).toMatchObject({
      remainingPieces: { roads: 13, settlements: 3, cities: 4 },
      playedKnights: 2,
      longestRoadLength: 2,
    });
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
        sources: [
          { playerId: "player_1", resource: "brick", amount: 1, hexId: "hex_brick", vertexId: "vertex_1" },
          { playerId: "player_1", resource: "lumber", amount: 1, hexId: "hex_lumber", vertexId: "vertex_1" },
          { playerId: "player_3", resource: "ore", amount: 2, hexId: "hex_ore", vertexId: "vertex_3" },
        ],
        triggeredHexIds: ["hex_brick", "hex_lumber", "hex_ore", "hex_unclaimed"],
      },
    }] satisfies GameEventRecord[];

    expect(projectGameForPlayer(game, "player_2", records).history.map((entry) => entry.message)).toEqual([
      "林 获得 1 砖、1 木",
      "陈 获得 2 矿",
    ]);
    expect(projectGameForPlayer(game, "player_2", records).effects).toContainEqual(expect.objectContaining({
      id: "8:resources-produced",
      reason: "production",
      sources: expect.arrayContaining([expect.objectContaining({ hexId: "hex_ore", amount: 2 })]),
      triggeredHexIds: expect.arrayContaining(["hex_unclaimed"]),
    }));
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
      { revision: 6, event: { type: "trade_response_recorded", offerId: "offer_1", playerId: "player_3", response: "countered" } },
      {
        revision: 7,
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
      "陈 提出了反报价",
      "林 给 周 2 砖，获得 1 麦",
    ]);
    expect(projectGameForPlayer(game, "player_3", records).effects).toContainEqual(expect.objectContaining({
      reason: "player-trade",
      grants: [
        expect.objectContaining({ playerId: "player_1", resources: resourceAmounts({ grain: 1 }), origin: { kind: "player", playerId: "player_2" } }),
        expect.objectContaining({ playerId: "player_2", resources: resourceAmounts({ brick: 2 }), origin: { kind: "player", playerId: "player_1" } }),
      ],
    }));
  });

  it("projects bank gains and redacts a robbed resource from uninvolved players", () => {
    const game = createBaseGame({
      id: "game_transfer_effects",
      seed: 15,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const records = [
      { revision: 10, event: { type: "maritime_trade_completed", playerId: "player_1", give: "brick", receive: "ore", ratio: 4 } },
      { revision: 11, event: { type: "robber_moved", playerId: "player_1", fromHexId: "hex_0", hexId: "hex_1", victimId: "player_2", stolenResource: "grain" } },
    ] satisfies GameEventRecord[];

    expect(projectGameForPlayer(game, "player_1", records).effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "maritime-trade", grants: [expect.objectContaining({ resources: resourceAmounts({ ore: 1 }), origin: { kind: "bank" } })] }),
      expect.objectContaining({ kind: "robber-move", fromHexId: "hex_0", toHexId: "hex_1" }),
      expect.objectContaining({ kind: "resource-transfer", transfers: [expect.objectContaining({ resource: "grain" })] }),
    ]));
    expect(projectGameForPlayer(game, "player_3", records).effects).toContainEqual(expect.objectContaining({
      kind: "resource-transfer",
      transfers: [expect.objectContaining({ resource: null, sourcePlayerId: "player_2", playerId: "player_1" })],
    }));
  });

  it("projects public spend and post-setup score effects without revealing a rival victory card", () => {
    const game = createBaseGame({
      id: "game_spend_effects",
      seed: 16,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const records = [
      { revision: 19, event: { type: "initial_settlement_placed", playerId: "player_1", vertexId: "vertex_setup" } },
      { revision: 20, event: { type: "piece_built", playerId: "player_1", piece: "settlement", locationId: "vertex_8" } },
      { revision: 21, event: { type: "development_card_bought", playerId: "player_2", cardId: "secret_vp", cardType: "victory-point" } },
      { revision: 22, event: { type: "award_changed", award: "longest-road", holderId: "player_1" } },
    ] satisfies GameEventRecord[];

    const rivalView = projectGameForPlayer(game, "player_1", records);
    const ownerView = projectGameForPlayer(game, "player_2", records);

    expect(rivalView.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "resource-spend",
        playerId: "player_1",
        resources: resourceAmounts({ brick: 1, lumber: 1, wool: 1, grain: 1 }),
        destination: { kind: "build", piece: "settlement", locationId: "vertex_8" },
      }),
      expect.objectContaining({ kind: "score-change", playerId: "player_1", delta: 1, reason: "settlement" }),
      expect.objectContaining({ kind: "resource-spend", playerId: "player_2", destination: { kind: "development" } }),
      expect.objectContaining({ kind: "score-change", playerId: "player_1", delta: 2, reason: "longest-road" }),
    ]));
    expect(rivalView.effects).not.toContainEqual(expect.objectContaining({ reason: "victory-point" }));
    expect(rivalView.effects.find((effect) => effect.revision === 19)).toBeUndefined();
    expect(JSON.stringify(rivalView.effects)).not.toContain("secret_vp");
    expect(ownerView.effects).toContainEqual(expect.objectContaining({
      kind: "score-change",
      playerId: "player_2",
      reason: "victory-point",
    }));
  });

  it("projects a matching-hex effect when production grants nobody resources", () => {
    const game = createBaseGame({
      id: "game_empty_production_effect",
      seed: 14,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const records = [{
      revision: 9,
      event: {
        type: "resources_produced",
        total: 0,
        grants: [],
        sources: [],
        triggeredHexIds: ["hex_unclaimed"],
      },
    }] satisfies GameEventRecord[];

    expect(projectGameForPlayer(game, "player_1", records).effects).toEqual([
      expect.objectContaining({ triggeredHexIds: ["hex_unclaimed"], grants: [] }),
    ]);
  });
});
