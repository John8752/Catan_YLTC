import { createBaseGame, resourceAmounts, type GameEventRecord, type GameState } from "@catan/game-core";
import { describe, expect, it } from "vitest";
import { projectGameSummary } from "./game-summary.js";

const PLAYERS = [
  { id: "player_1", name: "林", color: "terracotta" as const },
  { id: "player_2", name: "周", color: "ocean" as const },
  { id: "player_3", name: "陈", color: "pine" as const },
];

describe("finished game summary projection", () => {
  it("aggregates public dice, resource-card, resource and activity statistics", () => {
    const base = createBaseGame({ id: "game_summary", seed: 81, players: PLAYERS });
    const state: GameState = {
      ...base,
      phase: { kind: "finished", winnerId: "player_1" },
      buildings: [
        { ownerId: "player_1", vertexId: base.map.vertices[0]?.id ?? "vertex_0", kind: "city" },
        { ownerId: "player_1", vertexId: base.map.vertices[1]?.id ?? "vertex_1", kind: "settlement" },
      ],
      awards: {
        longestRoad: { holderId: "player_1", value: 6 },
        largestArmy: { holderId: "player_2", value: 3 },
      },
      players: base.players.map((player) => player.id === "player_1"
        ? { ...player, visibleVictoryPoints: 5, resources: resourceAmounts({ ore: 2 }) }
        : player),
    };
    const records = [
      { revision: 1, event: { type: "starting_resources_granted", playerId: "player_1", total: 2, resources: resourceAmounts({ brick: 1, grain: 1 }), sources: [] } },
      { revision: 2, event: { type: "dice_rolled", playerId: "player_1", dice: [3, 4] } },
      { revision: 3, event: { type: "resources_produced", total: 3, grants: [{ playerId: "player_1", resources: resourceAmounts({ grain: 2, ore: 1 }) }], sources: [], triggeredHexIds: [] } },
      { revision: 4, event: { type: "piece_built", playerId: "player_1", piece: "city", locationId: "vertex_0" } },
      { revision: 5, event: { type: "development_card_bought", playerId: "player_1", cardId: "private", cardType: "victory-point" } },
      { revision: 6, event: { type: "maritime_trade_completed", playerId: "player_1", give: "brick", receive: "ore", ratio: 3 } },
      { revision: 7, event: { type: "robber_moved", playerId: "player_1", fromHexId: "hex_0", hexId: "hex_1", victimId: "player_2", stolenResource: "wool" } },
      { revision: 8, event: { type: "resources_discarded", playerId: "player_1", total: 2 } },
    ] satisfies GameEventRecord[];

    const summary = projectGameSummary(state, records);
    const winner = summary?.players.find((player) => player.playerId === "player_1");

    expect(summary).toMatchObject({ totalRolls: 1 });
    expect(summary?.diceTotals.find((entry) => entry.total === 7)?.count).toBe(1);
    expect(winner).toMatchObject({
      visibleVictoryPoints: 5,
      score: { settlements: 1, cities: 1, longestRoad: true, largestArmy: false },
      resourceCards: {
        starting: 2,
        produced: 3,
        maritimeReceived: 1,
        stolen: 1,
        spent: 8,
        tradedAway: 3,
        discarded: 2,
        finalHand: 2,
      },
      productionByResource: resourceAmounts({ grain: 2, ore: 1 }),
      activity: { rolls: 1, citiesBuilt: 1, developmentCardsBought: 1, maritimeTrades: 1, robberMoves: 1 },
    });
    expect(JSON.stringify(summary)).not.toContain("victory-point");
    expect(JSON.stringify(summary)).not.toContain("private");
  });

  it("stays absent until the game is finished", () => {
    const state = createBaseGame({ id: "game_live_summary", seed: 82, players: PLAYERS });
    expect(projectGameSummary(state, [])).toBeNull();
  });
});
