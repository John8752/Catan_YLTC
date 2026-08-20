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
  it("draws normal server rolls from the shared balanced bag", () => {
    const game = completeSetup();
    const expectedDice = game.diceBag.rolls[game.diceBag.cursor];
    const rolled = accept(executeGameCommand(game, "player_1", { type: "RollDice" }));

    expect(rolled.lastRoll).toEqual(expectedDice);
    expect(rolled.diceBag.cursor).toBe(game.diceBag.cursor + 1);
  });

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
    const rollResult = executeGameCommand(setup, "player_1", { type: "RollDice" }, sequenceRandom(dice));
    const rolled = accept(rollResult);

    if (rolled.lastRoll === null) throw new Error("Roll result was not recorded");
    expect(rolled.lastRoll[0] + rolled.lastRoll[1]).toBe(producingHex.numberToken);
    expect(rolled.phase).toMatchObject({ kind: "turn", step: "action", activePlayerId: "player_1" });
    expect(
      rolled.players.reduce((total, player) => total + resourceCardCount(player.resources), 0),
    ).toBeGreaterThan(beforeCards);
    if (!rollResult.accepted) throw new Error("Expected accepted roll");
    const productionEvent = rollResult.events.find((event) => event.type === "resources_produced");
    expect(productionEvent).toEqual(expect.objectContaining({
      triggeredHexIds: expect.arrayContaining([producingHex.id]),
      sources: expect.arrayContaining([
        expect.objectContaining({ hexId: producingHex.id, resource: producingHex.terrain }),
      ]),
    }));

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

  it("records every unblocked matching hex even when no building receives a resource", () => {
    const base = createBaseGame({ id: "game_unclaimed_production", seed: 303, players });
    const producingHex = base.map.hexes.find((hex) => hex.numberToken !== null);
    if (producingHex?.numberToken === null || producingHex === undefined) throw new Error("Missing numbered hex");
    const game: GameState = {
      ...base,
      phase: { kind: "turn", activePlayerId: "player_1", step: "roll", turnNumber: 1 },
    };
    const result = executeGameCommand(game, "player_1", { type: "RollDice" }, sequenceRandom(diceForTotal(producingHex.numberToken)));
    if (!result.accepted) throw new Error(`${result.error.code}: ${result.error.message}`);
    const production = result.events.find((event) => event.type === "resources_produced");

    expect(production).toEqual(expect.objectContaining({
      grants: [],
      sources: [],
      triggeredHexIds: expect.arrayContaining([producingHex.id]),
    }));
  });

  it("keeps a matching hex triggered when the bank withholds its resource", () => {
    const setup = completeSetup();
    const producingHex = setup.map.hexes.find(
      (hex) => hex.numberToken !== null && setup.buildings.some((building) =>
        setup.map.vertices.find((vertex) => vertex.id === building.vertexId)?.adjacentHexIds.includes(hex.id)),
    );
    if (producingHex?.numberToken === null || producingHex === undefined || producingHex.terrain === "desert") {
      throw new Error("Missing producing hex");
    }
    const resource = producingHex.terrain;
    const game: GameState = { ...setup, bank: { ...setup.bank, [resource]: 0 } };
    const result = executeGameCommand(game, "player_1", { type: "RollDice" }, sequenceRandom(diceForTotal(producingHex.numberToken)));
    if (!result.accepted) throw new Error(`${result.error.code}: ${result.error.message}`);
    const production = result.events.find((event) => event.type === "resources_produced");
    if (production?.type !== "resources_produced") throw new Error("Missing production event");

    expect(production.triggeredHexIds).toContain(producingHex.id);
    expect(production.sources.some((source) => source.hexId === producingHex.id)).toBe(false);
    expect(production.grants.every((grant) => grant.resources[resource] === 0)).toBe(true);
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
