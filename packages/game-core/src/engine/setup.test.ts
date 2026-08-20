import { describe, expect, it } from "vitest";
import {
  createBaseGame,
  executeGameCommand,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  type GameState,
  type PlayerSeed,
} from "../index.js";

const players: readonly PlayerSeed[] = [
  { id: "player_1", name: "林", color: "terracotta" },
  { id: "player_2", name: "周", color: "ocean" },
  { id: "player_3", name: "陈", color: "pine" },
];

describe("initial placement commands", () => {
  it("rejects the wrong actor without changing state", () => {
    const game = createBaseGame({ id: "game_1", seed: 42, players });
    const vertexId = game.map.vertices[0]?.id;
    if (vertexId === undefined) throw new Error("Missing test vertex");

    const result = executeGameCommand(game, "player_2", {
      type: "PlaceInitialSettlement",
      vertexId,
    });

    expect(result).toMatchObject({ accepted: false, error: { code: "NOT_YOUR_TURN" } });
    expect(result.state).toBe(game);
    expect(game.revision).toBe(1);
  });

  it("requires a settlement and then an adjacent road", () => {
    const game = createBaseGame({ id: "game_1", seed: 42, players });
    const vertexId = legalInitialSettlementVertices(game, "player_1")[0];
    if (vertexId === undefined) throw new Error("Missing legal settlement vertex");

    const settlement = executeGameCommand(game, "player_1", {
      type: "PlaceInitialSettlement",
      vertexId,
    });
    expect(settlement.accepted).toBe(true);
    expect(settlement.state.phase).toMatchObject({ kind: "setup", step: "road" });
    expect(settlement.state.buildings).toContainEqual({
      ownerId: "player_1",
      vertexId,
      kind: "settlement",
    });

    const legalEdges = legalInitialRoadEdges(settlement.state, "player_1");
    expect(legalEdges.length).toBeGreaterThan(0);
    const unrelatedEdge = settlement.state.map.edges.find(
      (edge) => !edge.vertexIds.includes(vertexId),
    );
    if (unrelatedEdge === undefined || legalEdges[0] === undefined) throw new Error("Missing test edge");

    const invalid = executeGameCommand(settlement.state, "player_1", {
      type: "PlaceInitialRoad",
      edgeId: unrelatedEdge.id,
    });
    expect(invalid).toMatchObject({ accepted: false, error: { code: "ROAD_NOT_ADJACENT" } });

    const road = executeGameCommand(settlement.state, "player_1", {
      type: "PlaceInitialRoad",
      edgeId: legalEdges[0],
    });
    expect(road.accepted).toBe(true);
    expect(road.state.phase).toMatchObject({
      kind: "setup",
      step: "settlement",
      placementIndex: 1,
    });
  });

  it("enforces distance and completes snake-order setup with starting resources", () => {
    let game = createBaseGame({ id: "game_1", seed: 73, players });

    while (game.phase.kind === "setup") {
      const actorId = game.phase.placementOrder[game.phase.placementIndex];
      if (actorId === undefined) throw new Error("Missing setup actor");

      if (game.phase.step === "settlement") {
        const vertexId = legalInitialSettlementVertices(game, actorId)[0];
        if (vertexId === undefined) throw new Error("No legal settlement");
        game = accept(executeGameCommand(game, actorId, { type: "PlaceInitialSettlement", vertexId }));
      } else {
        const edgeId = legalInitialRoadEdges(game, actorId)[0];
        if (edgeId === undefined) throw new Error("No legal road");
        game = accept(executeGameCommand(game, actorId, { type: "PlaceInitialRoad", edgeId }));
      }
    }

    expect(game.phase).toEqual({
      kind: "turn",
      activePlayerId: "player_1",
      step: "roll",
      turnNumber: 1,
    });
    expect(game.buildings).toHaveLength(6);
    expect(game.roads).toHaveLength(6);
    expect(game.players.every((player) => player.visibleVictoryPoints === 2)).toBe(true);
    expect(game.players.some((player) => Object.values(player.resources).some((count) => count > 0))).toBe(true);
  });
});

function accept(result: ReturnType<typeof executeGameCommand>): GameState {
  if (!result.accepted) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}
