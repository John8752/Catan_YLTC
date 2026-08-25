import { describe, expect, it } from "vitest";
import {
  createBaseGame,
  executeGameCommand,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  legalRobberTargets,
  type GameCommandResult,
  type GameState,
  type PlayerSeed,
  type RandomSource,
  type ResourceHand,
} from "../index.js";

const players: readonly PlayerSeed[] = [
  { id: "player_1", name: "林", color: "terracotta" },
  { id: "player_2", name: "周", color: "ocean" },
  { id: "player_3", name: "陈", color: "pine" },
];

describe("seven and robber resolution", () => {
  it("waits for every required discard, moves the robber and steals an injected card", () => {
    let game = completeSetup();
    game = withHands(game, {
      player_1: { brick: 4, lumber: 4, wool: 0, grain: 0, ore: 0 },
      player_2: { brick: 0, lumber: 0, wool: 8, grain: 1, ore: 0 },
      player_3: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
    });
    game = accept(executeGameCommand(game, "player_1", { type: "RollDice" }, sequenceRandom([0, 0.99])));

    expect(game.lastRoll).toEqual([1, 6]);
    expect(game.phase).toMatchObject({ kind: "turn", step: "discard" });
    expect(game.pendingDiscards).toEqual([
      { playerId: "player_1", count: 4 },
      { playerId: "player_2", count: 4 },
    ]);

    const earlyMove = executeGameCommand(game, "player_1", {
      type: "MoveRobber",
      hexId: game.map.hexes.find((hex) => hex.id !== game.map.robberHexId)?.id ?? "missing",
      victimId: null,
    });
    expect(earlyMove).toMatchObject({ accepted: false, error: { code: "WRONG_PHASE" } });

    game = accept(executeGameCommand(game, "player_2", {
      type: "DiscardResources",
      resources: { brick: 0, lumber: 0, wool: 4, grain: 0, ore: 0 },
    }));
    expect(game.phase).toMatchObject({ step: "discard" });
    game = accept(executeGameCommand(game, "player_1", {
      type: "DiscardResources",
      resources: { brick: 2, lumber: 2, wool: 0, grain: 0, ore: 0 },
    }));
    expect(game.phase).toMatchObject({ step: "robber" });

    const target = legalRobberTargets(game, "player_1").find((candidate) =>
      candidate.victimIds.includes("player_2"),
    );
    if (target === undefined) throw new Error("No robber target adjacent to player 2");
    const beforeWool = game.players.find((player) => player.id === "player_1")?.resources.wool ?? 0;
    const robberMove = executeGameCommand(game, "player_1", {
      type: "MoveRobber",
      hexId: target.hexId,
      victimId: "player_2",
    }, sequenceRandom([0]));
    expect(robberMove).toMatchObject({
      accepted: true,
      events: [expect.objectContaining({
        type: "robber_moved",
        fromHexId: game.map.robberHexId,
        hexId: target.hexId,
      })],
    });
    game = accept(robberMove);

    expect(game.map.robberHexId).toBe(target.hexId);
    expect(game.phase).toMatchObject({ kind: "turn", step: "action" });
    expect(game.players.find((player) => player.id === "player_1")?.resources.wool).toBe(beforeWool + 1);
    expect(game.pendingDiscards).toEqual([]);
  });

  it("rejects an incorrect discard atomically", () => {
    let game = withHands(completeSetup(), {
      player_1: { brick: 8, lumber: 0, wool: 0, grain: 0, ore: 0 },
    });
    game = accept(executeGameCommand(game, "player_1", { type: "RollDice" }, sequenceRandom([0, 0.99])));
    const rejected = executeGameCommand(game, "player_1", {
      type: "DiscardResources",
      resources: { brick: 3, lumber: 0, wool: 0, grain: 0, ore: 0 },
    });

    expect(rejected).toMatchObject({ accepted: false, error: { code: "INVALID_DISCARD" } });
    expect(rejected.state).toBe(game);
  });
});

function completeSetup(): GameState {
  let game = createBaseGame({ id: "game_robber", seed: 303, players });
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
  return game;
}

function withHands(game: GameState, hands: Readonly<Record<string, ResourceHand>>): GameState {
  return {
    ...game,
    players: game.players.map((player) => ({
      ...player,
      resources: hands[player.id] ?? player.resources,
    })),
  };
}

function accept(result: GameCommandResult): GameState {
  if (!result.accepted) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function sequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;
  return { next: () => values[index++] ?? 0 };
}
