import { describe, expect, it } from "vitest";
import {
  createBaseGame,
  executeGameCommand,
  legalCityVertices,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  legalRoadEdges,
  legalSettlementVertices,
  type GameCommandResult,
  type GameState,
  type PlayerSeed,
  type ResourceHand,
} from "../index.js";

const players: readonly PlayerSeed[] = [
  { id: "player_1", name: "林", color: "terracotta" },
  { id: "player_2", name: "周", color: "ocean" },
  { id: "player_3", name: "陈", color: "pine" },
];

describe("paid building", () => {
  it("builds connected roads, a distant settlement and a city with atomic costs", () => {
    let game = actionState();
    const richHand: ResourceHand = { brick: 5, lumber: 5, wool: 3, grain: 5, ore: 5 };
    game = withHand(game, "player_1", richHand);

    const firstEdgeId = legalRoadEdges(game, "player_1")[0];
    if (firstEdgeId === undefined) throw new Error("Missing first legal road");
    game = accept(executeGameCommand(game, "player_1", { type: "BuildRoad", edgeId: firstEdgeId }));
    const firstEdge = game.map.edges.find((edge) => edge.id === firstEdgeId);
    const secondEdgeId = legalRoadEdges(game, "player_1").find((edgeId) => {
      const edge = game.map.edges.find((candidate) => candidate.id === edgeId);
      if (edge === undefined || firstEdge === undefined) return false;
      if (!edge.vertexIds.some((vertexId) => firstEdge.vertexIds.includes(vertexId))) return false;
      return legalSettlementVertices(
        { ...game, roads: [...game.roads, { ownerId: "player_1", edgeId }] },
        "player_1",
      ).length > 0;
    });
    if (secondEdgeId === undefined) throw new Error("Missing extending legal road");
    game = accept(executeGameCommand(game, "player_1", { type: "BuildRoad", edgeId: secondEdgeId }));
    expect(game.players.find((player) => player.id === "player_1")?.resources).toMatchObject({
      brick: 3,
      lumber: 3,
    });

    const vertexId = legalSettlementVertices(game, "player_1")[0];
    if (vertexId === undefined) throw new Error("Missing legal settlement");
    game = accept(executeGameCommand(game, "player_1", { type: "BuildSettlement", vertexId }));
    expect(game.players.find((player) => player.id === "player_1")?.visibleVictoryPoints).toBe(3);

    expect(legalCityVertices(game, "player_1")).toContain(vertexId);
    game = accept(executeGameCommand(game, "player_1", { type: "BuildCity", vertexId }));
    expect(game.buildings.find((building) => building.vertexId === vertexId)?.kind).toBe("city");
    expect(game.players.find((player) => player.id === "player_1")?.visibleVictoryPoints).toBe(4);
    expect(game.players.find((player) => player.id === "player_1")?.pieces).toMatchObject({
      roads: 11,
      settlements: 3,
      cities: 3,
    });
  });

  it("rejects an unaffordable build without changing the state", () => {
    const game = withHand(actionState(), "player_1", {
      brick: 0,
      lumber: 0,
      wool: 0,
      grain: 0,
      ore: 0,
    });
    const edgeId = legalRoadEdges(game, "player_1")[0];
    if (edgeId === undefined) throw new Error("Missing legal road");
    const result = executeGameCommand(game, "player_1", { type: "BuildRoad", edgeId });

    expect(result).toMatchObject({ accepted: false, error: { code: "INSUFFICIENT_RESOURCES" } });
    expect(result.state).toBe(game);
  });
});

function actionState(): GameState {
  let game = createBaseGame({ id: "game_build", seed: 404, players });
  while (game.phase.kind === "setup") {
    const actorId = game.phase.placementOrder[game.phase.placementIndex];
    if (actorId === undefined) throw new Error("Missing actor");
    if (game.phase.step === "settlement") {
      const vertexId = legalInitialSettlementVertices(game, actorId)[0];
      if (vertexId === undefined) throw new Error("Missing vertex");
      game = accept(executeGameCommand(game, actorId, { type: "PlaceInitialSettlement", vertexId }));
    } else {
      const edgeId = legalInitialRoadEdges(game, actorId)[0];
      if (edgeId === undefined) throw new Error("Missing edge");
      game = accept(executeGameCommand(game, actorId, { type: "PlaceInitialRoad", edgeId }));
    }
  }
  if (game.phase.kind !== "turn") throw new Error("Setup did not enter a turn");
  return {
    ...game,
    phase: { ...game.phase, step: "action" },
  };
}

function withHand(game: GameState, playerId: string, resources: ResourceHand): GameState {
  return {
    ...game,
    players: game.players.map((player) => player.id === playerId ? { ...player, resources } : player),
  };
}

function accept(result: GameCommandResult): GameState {
  if (!result.accepted) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}
