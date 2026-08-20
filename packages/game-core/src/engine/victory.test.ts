import { describe, expect, it } from "vitest";
import {
  createBaseGame,
  executeGameCommand,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  resourceAmounts,
  type GameCommandResult,
  type GameState,
  type PlayerSeed,
} from "../index.js";

const players: readonly PlayerSeed[] = [
  { id: "player_1", name: "林", color: "terracotta" },
  { id: "player_2", name: "周", color: "ocean" },
  { id: "player_3", name: "陈", color: "pine" },
];

describe("victory calculation", () => {
  it("ends immediately when a city upgrade plus hidden point reaches ten", () => {
    let game = actionState();
    const vertices = game.map.vertices.slice(0, 5).map((vertex) => vertex.id);
    const cityTarget = vertices[4];
    if (cityTarget === undefined) throw new Error("Missing city target");
    game = {
      ...game,
      buildings: vertices.map((vertexId, index) => ({
        ownerId: "player_1",
        vertexId,
        kind: index < 3 ? "city" as const : "settlement" as const,
      })),
      players: game.players.map((player) => player.id === "player_1"
        ? {
            ...player,
            resources: resourceAmounts({ grain: 2, ore: 3 }),
            developmentCards: [{ id: "hidden_point", type: "victory-point", acquiredTurn: 0 }],
          }
        : player),
    };

    game = accept(executeGameCommand(game, "player_1", { type: "BuildCity", vertexId: cityTarget }));
    expect(game.phase).toEqual({ kind: "finished", winnerId: "player_1" });
    expect(game.players.find((player) => player.id === "player_1")?.visibleVictoryPoints).toBe(10 - 1);
    expect(executeGameCommand(game, "player_1", { type: "EndTurn" })).toMatchObject({
      accepted: false,
      error: { code: "WRONG_PHASE" },
    });
  });
});

function actionState(): GameState {
  let game = createBaseGame({ id: "game_win", seed: 707, players });
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
  if (game.phase.kind !== "turn") throw new Error("Setup did not complete");
  return { ...game, phase: { ...game.phase, step: "action" } };
}

function accept(result: GameCommandResult): GameState {
  if (!result.accepted) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}
