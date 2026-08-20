import { describe, expect, it } from "vitest";
import {
  createBaseGame,
  executeGameCommand,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  resourceCardCount,
  type GameCommandResult,
  type GameState,
  type PlayerSeed,
  type RandomSource,
} from "../index.js";

const players: readonly PlayerSeed[] = [
  { id: "player_1", name: "林", color: "terracotta" },
  { id: "player_2", name: "周", color: "ocean" },
  { id: "player_3", name: "陈", color: "pine" },
];

describe("normal turn commands", () => {
  it("rolls injected dice, produces once and advances to the next player", () => {
    const setup = completeSetup();
    const producingHex = setup.map.hexes.find(
      (hex) =>
        hex.numberToken !== null &&
        setup.buildings.some((building) =>
          setup.map.vertices
            .find((vertex) => vertex.id === building.vertexId)
            ?.adjacentHexIds.includes(hex.id),
        ),
    );
    if (producingHex?.numberToken === null || producingHex === undefined) {
      throw new Error("Setup produced no testable hex");
    }
    const beforeCards = setup.players.reduce(
      (total, player) => total + resourceCardCount(player.resources),
      0,
    );
    const dice = diceForTotal(producingHex.numberToken);
    const rolled = accept(
      executeGameCommand(setup, "player_1", { type: "RollDice" }, sequenceRandom(dice)),
    );

    if (rolled.lastRoll === null) throw new Error("Roll result was not recorded");
    expect(rolled.lastRoll[0] + rolled.lastRoll[1]).toBe(producingHex.numberToken);
    expect(rolled.phase).toMatchObject({ kind: "turn", step: "action", activePlayerId: "player_1" });
    expect(
      rolled.players.reduce((total, player) => total + resourceCardCount(player.resources), 0),
    ).toBeGreaterThan(beforeCards);

    const repeated = executeGameCommand(rolled, "player_1", { type: "RollDice" }, sequenceRandom(dice));
    expect(repeated).toMatchObject({ accepted: false, error: { code: "WRONG_PHASE" } });

    const ended = accept(executeGameCommand(rolled, "player_1", { type: "EndTurn" }));
    expect(ended.phase).toEqual({
      kind: "turn",
      activePlayerId: "player_2",
      step: "roll",
      turnNumber: 2,
    });
    expect(ended.lastRoll).toBeNull();
  });

  it("rejects a roll from a non-active player without mutation", () => {
    const game = completeSetup();
    const result = executeGameCommand(game, "player_2", { type: "RollDice" }, sequenceRandom([0, 0]));

    expect(result).toMatchObject({ accepted: false, error: { code: "NOT_YOUR_TURN" } });
    expect(result.state).toBe(game);
  });
});

function completeSetup(): GameState {
  let game = createBaseGame({ id: "game_turn", seed: 101, players });

  while (game.phase.kind === "setup") {
    const actorId = game.phase.placementOrder[game.phase.placementIndex];
    if (actorId === undefined) throw new Error("Missing setup actor");
    if (game.phase.step === "settlement") {
      const vertexId = legalInitialSettlementVertices(game, actorId)[0];
      if (vertexId === undefined) throw new Error("Missing setup vertex");
      game = accept(executeGameCommand(game, actorId, { type: "PlaceInitialSettlement", vertexId }));
    } else {
      const edgeId = legalInitialRoadEdges(game, actorId)[0];
      if (edgeId === undefined) throw new Error("Missing setup edge");
      game = accept(executeGameCommand(game, actorId, { type: "PlaceInitialRoad", edgeId }));
    }
  }

  return game;
}

function accept(result: GameCommandResult): GameState {
  if (!result.accepted) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function diceForTotal(total: number): readonly [number, number] {
  const first = Math.max(1, Math.min(6, total - 1));
  const second = total - first;
  return [(first - 0.5) / 6, (second - 0.5) / 6];
}

function sequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;
  return { next: () => values[index++] ?? 0 };
}
