import { describe, expect, it } from "vitest";
import {
  createGame,
  executeGameCommand,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  resourceAmounts,
  assertGameInvariant,
  type GameCommandResult,
  type GameState,
  type PlayerSeed,
  type PlayableRuleProfile,
} from "../catan.js";

const players: readonly PlayerSeed[] = [
  { id: "player_1", name: "一", color: "terracotta" },
  { id: "player_2", name: "二", color: "ocean" },
  { id: "player_3", name: "三", color: "pine" },
  { id: "player_4", name: "四", color: "wheat" },
  { id: "player_5", name: "五", color: "plum" },
];

describe.each(["extended-5-6", "large-5-6"] as const)("%s profile", (ruleProfile) => {
  it("uses the expanded supplies and setup order", () => {
    const game = createGame({ id: "extended", seed: 42, players, ruleProfile });

    expect(game.map.hexes).toHaveLength(ruleProfile === "large-5-6" ? 37 : 30);
    expect(game.bank).toEqual(resourceAmounts({ brick: 24, lumber: 24, wool: 24, grain: 24, ore: 24 }));
    expect(game.developmentDeck).toHaveLength(34);
    expect(game.phase.kind === "setup" ? game.phase.placementOrder : []).toEqual([
      "player_1", "player_2", "player_3", "player_4", "player_5",
      "player_5", "player_4", "player_3", "player_2", "player_1",
    ]);
  });

  it("hands primary action to the paired player, who may trade only with the bank", () => {
    let game = completeSetup(ruleProfile);
    game = accept(executeGameCommand(game, "player_1", { type: "RollDice" }, { next: () => 0 }));
    game = accept(executeGameCommand(game, "player_1", { type: "EndTurn" }));

    expect(game.phase).toMatchObject({
      kind: "turn",
      activePlayerId: "player_4",
      primaryPlayerId: "player_1",
      step: "paired-action",
      turnNumber: 1,
    });

    game = {
      ...game,
      players: game.players.map((player) => player.id === "player_4"
        ? { ...player, resources: resourceAmounts({ brick: 4 }) }
        : player),
    };
    const playerTrade = executeGameCommand(game, "player_4", {
      type: "OpenTradeOffer",
      offerId: "not-allowed",
      give: resourceAmounts({ brick: 1 }),
      receive: resourceAmounts({ ore: 1 }),
    });
    expect(playerTrade.accepted).toBe(false);
    if (!playerTrade.accepted) expect(playerTrade.error.code).toBe("INVALID_TRADE");

    game = accept(executeGameCommand(game, "player_4", { type: "MaritimeTrade", give: "brick", receive: "ore" }));
    game = accept(executeGameCommand(game, "player_4", { type: "EndTurn" }));
    expect(game.phase).toEqual({ kind: "turn", activePlayerId: "player_2", step: "roll", turnNumber: 2 });
  });

  it("completes six-seat setup and buys a development card with conserved supplies", () => {
    const six = [...players, { id: "player_6", name: "六", color: "charcoal" as const }];
    let game = completeSetup(ruleProfile, six);
    expect(game.buildings).toHaveLength(12);
    expect(game.roads).toHaveLength(12);
    expect(game.victoryPointsToWin).toBe(10);
    assertGameInvariant(game);
    const resources = resourceAmounts({ ore: 1, wool: 1, grain: 1 });
    // Move one card of each cost from the bank to the active player.
    game = { ...game, phase: { kind: "turn", activePlayerId: "player_1", step: "action", turnNumber: 1 },
      bank: { ...game.bank, ore: game.bank.ore - 1, wool: game.bank.wool - 1, grain: game.bank.grain - 1 },
      players: game.players.map((player) => player.id !== "player_1" ? player : { ...player,
        resources: { ...player.resources, ore: player.resources.ore + resources.ore,
          wool: player.resources.wool + resources.wool, grain: player.resources.grain + resources.grain },
      }),
    };
    game = accept(executeGameCommand(game, "player_1", { type: "BuyDevelopmentCard" }));
    expect(game.players[0]!.developmentCards[0]!.id).toBe("development_0");
    expect(game.developmentDeck).toHaveLength(33);
    assertGameInvariant(game);
  });
});

function completeSetup(ruleProfile: PlayableRuleProfile, seats: readonly PlayerSeed[] = players): GameState {
  let game = createGame({ id: "extended", seed: 42, players: seats, ruleProfile });
  while (game.phase.kind === "setup") {
    const actorId = game.phase.placementOrder[game.phase.placementIndex];
    if (actorId === undefined) throw new Error("Missing setup actor");
    if (game.phase.step === "settlement") {
      const vertexId = legalInitialSettlementVertices(game, actorId)[0];
      if (vertexId === undefined) throw new Error("Missing legal settlement");
      game = accept(executeGameCommand(game, actorId, { type: "PlaceInitialSettlement", vertexId }));
    } else {
      const edgeId = legalInitialRoadEdges(game, actorId)[0];
      if (edgeId === undefined) throw new Error("Missing legal road");
      game = accept(executeGameCommand(game, actorId, { type: "PlaceInitialRoad", edgeId }));
    }
  }
  return game;
}

function accept(result: GameCommandResult): GameState {
  if (!result.accepted) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}
