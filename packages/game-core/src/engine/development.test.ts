import { describe, expect, it } from "vitest";
import {
  createBaseGame,
  executeGameCommand,
  legalFreeRoadEdges,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  resourceAmounts,
  type DevelopmentCardState,
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

describe("development card commands", () => {
  it("buys the deterministic top card privately and charges its cost", () => {
    let game = withHand(actionState(), "player_1", resourceAmounts({ wool: 1, grain: 1, ore: 1 }));
    const expectedType = game.developmentDeck[0];
    game = accept(executeGameCommand(game, "player_1", { type: "BuyDevelopmentCard" }));
    const player = game.players.find((candidate) => candidate.id === "player_1");

    expect(player?.developmentCards).toContainEqual(expect.objectContaining({ type: expectedType, acquiredTurn: 1 }));
    expect(player?.resources).toEqual(resourceAmounts({}));
    expect(game.developmentDeck).toHaveLength(24);
  });

  it("resolves monopoly and resource choice while enforcing one card per turn", () => {
    let game = withCards(actionState(), "player_1", [card("monopoly"), card("resource-choice", "card_choice")]);
    game = withHands(game, {
      player_2: resourceAmounts({ ore: 3 }),
      player_3: resourceAmounts({ ore: 2 }),
    });
    const monopoly = executeGameCommand(game, "player_1", {
      type: "PlayMonopoly",
      cardId: "card_test",
      resource: "ore",
    });
    expect(monopoly).toMatchObject({
      accepted: true,
      events: [{
        type: "development_card_played",
        cardType: "monopoly",
        resource: "ore",
        total: 5,
        transfers: [
          { playerId: "player_2", amount: 3 },
          { playerId: "player_3", amount: 2 },
        ],
      }],
    });
    game = accept(monopoly);
    expect(game.players.find((player) => player.id === "player_1")?.resources.ore).toBe(5);

    const second = executeGameCommand(game, "player_1", {
      type: "PlayResourceChoice",
      cardId: "card_choice",
      resources: ["grain", "grain"],
    });
    expect(second).toMatchObject({ accepted: false, error: { code: "DEVELOPMENT_CARD_ALREADY_PLAYED" } });
  });

  it("records the publicly selected resources for a resource-choice result", () => {
    const game = withCards(actionState(), "player_1", [card("resource-choice")]);
    const result = executeGameCommand(game, "player_1", {
      type: "PlayResourceChoice",
      cardId: "card_test",
      resources: ["grain", "ore"],
    });

    expect(result).toMatchObject({
      accepted: true,
      events: [{
        type: "development_card_played",
        cardType: "resource-choice",
        resources: resourceAmounts({ grain: 1, ore: 1 }),
      }],
    });
  });

  it("plays a knight before rolling and resumes the roll after moving the robber", () => {
    let game = withCards(turnState(), "player_1", [card("knight")]);
    game = accept(executeGameCommand(game, "player_1", { type: "PlayKnight", cardId: "card_test" }));
    expect(game.phase).toMatchObject({ kind: "turn", step: "robber" });
    expect(game.players.find((player) => player.id === "player_1")?.playedKnights).toBe(1);
    const target = game.map.hexes
      .filter((hex) => hex.id !== game.map.robberHexId)
      .map((hex) => ({
        hex,
        victims: game.buildings
          .filter((building) => hex.vertexIds.includes(building.vertexId) && building.ownerId !== "player_1")
          .map((building) => building.ownerId),
      }))[0];
    if (target === undefined) throw new Error("Missing robber destination");
    game = accept(executeGameCommand(game, "player_1", {
      type: "MoveRobber",
      hexId: target.hex.id,
      victimId: target.victims[0] ?? null,
    }));
    expect(game.phase).toMatchObject({ kind: "turn", step: "roll" });
  });

  it("places two free roads through a mandatory subphase", () => {
    let game = withCards(actionState(), "player_1", [card("road-building")]);
    game = accept(executeGameCommand(game, "player_1", { type: "PlayRoadBuilding", cardId: "card_test" }));
    expect(game.phase).toMatchObject({ kind: "turn", step: "free-road" });
    for (let remaining = 2; remaining > 0; remaining -= 1) {
      const edgeId = legalFreeRoadEdges(game, "player_1")[0];
      if (edgeId === undefined) throw new Error("Missing free road edge");
      const result = executeGameCommand(game, "player_1", { type: "BuildFreeRoad", edgeId });
      expect(result).toMatchObject({
        accepted: true,
        events: [{
          type: "free_road_built",
          placed: 3 - remaining,
          total: 2,
          completed: remaining === 1,
        }],
      });
      game = accept(result);
    }
    expect(game.phase).toMatchObject({ kind: "turn", step: "action" });
    expect(game).toMatchObject({ freeRoadsRemaining: 0, freeRoadsGranted: 0 });
  });
});

function card(type: DevelopmentCardState["type"], id = "card_test"): DevelopmentCardState {
  return { id, type, acquiredTurn: 0 };
}

function turnState(): GameState {
  return completedSetup();
}

function actionState(): GameState {
  const game = completedSetup();
  if (game.phase.kind !== "turn") throw new Error("Setup did not complete");
  return { ...game, phase: { ...game.phase, step: "action" } };
}

function completedSetup(): GameState {
  let game = createBaseGame({ id: "game_dev", seed: 606, players });
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

function withCards(game: GameState, playerId: string, developmentCards: readonly DevelopmentCardState[]): GameState {
  return {
    ...game,
    players: game.players.map((player) => player.id === playerId ? { ...player, developmentCards } : player),
  };
}

function withHand(game: GameState, playerId: string, resources: ResourceHand): GameState {
  return withHands(game, { [playerId]: resources });
}

function withHands(game: GameState, hands: Readonly<Record<string, ResourceHand>>): GameState {
  return {
    ...game,
    players: game.players.map((player) => ({ ...player, resources: hands[player.id] ?? player.resources })),
  };
}

function accept(result: GameCommandResult): GameState {
  if (!result.accepted) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}
