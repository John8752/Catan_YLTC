import { describe, expect, it } from "vitest";
import {
  createBaseGame,
  executeGameCommand,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  maritimeRatio,
  resourceAmounts,
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

describe("atomic trading", () => {
  it("collects multiple responses and lets the proposer select the partner", () => {
    let game = actionState();
    game = withHands(game, {
      player_1: resourceAmounts({ brick: 2 }),
      player_2: resourceAmounts({ ore: 1 }),
      player_3: resourceAmounts({ ore: 1 }),
    });
    game = accept(executeGameCommand(game, "player_1", {
      type: "OpenTradeOffer",
      offerId: "offer_1",
      give: resourceAmounts({ brick: 2 }),
      receive: resourceAmounts({ ore: 1 }),
    }));
    expect(game.openTrade).toMatchObject({ proposerId: "player_1", offerId: "offer_1" });

    const proposerAccept = executeGameCommand(game, "player_1", {
      type: "AcceptTradeOffer",
      offerId: "offer_1",
    });
    expect(proposerAccept).toMatchObject({ accepted: false, error: { code: "INVALID_TRADE" } });

    game = accept(executeGameCommand(game, "player_2", {
      type: "AcceptTradeOffer",
      offerId: "offer_1",
    }));
    game = accept(executeGameCommand(game, "player_3", {
      type: "AcceptTradeOffer",
      offerId: "offer_1",
    }));
    expect(game.openTrade?.responses).toEqual([
      { playerId: "player_2", response: "accepted" },
      { playerId: "player_3", response: "accepted" },
    ]);
    expect(game.players.find((player) => player.id === "player_1")?.resources).toMatchObject({ brick: 2, ore: 0 });

    game = accept(executeGameCommand(game, "player_1", {
      type: "CompleteTradeOffer",
      offerId: "offer_1",
      partnerId: "player_3",
    }));
    expect(game.openTrade).toBeNull();
    expect(game.players.find((player) => player.id === "player_1")?.resources).toMatchObject({ brick: 0, ore: 1 });
    expect(game.players.find((player) => player.id === "player_2")?.resources).toMatchObject({ brick: 0, ore: 1 });
    expect(game.players.find((player) => player.id === "player_3")?.resources).toMatchObject({ brick: 2, ore: 0 });
  });

  it("records declines and rejects an unaccepted partner", () => {
    let game = withHands(actionState(), {
      player_1: resourceAmounts({ brick: 1 }),
      player_2: resourceAmounts({ ore: 1 }),
    });
    game = accept(executeGameCommand(game, "player_1", {
      type: "OpenTradeOffer",
      offerId: "offer_declined",
      give: resourceAmounts({ brick: 1 }),
      receive: resourceAmounts({ ore: 1 }),
    }));
    game = accept(executeGameCommand(game, "player_2", {
      type: "DeclineTradeOffer",
      offerId: "offer_declined",
    }));
    expect(game.openTrade?.responses).toContainEqual({ playerId: "player_2", response: "declined" });
    expect(executeGameCommand(game, "player_1", {
      type: "CompleteTradeOffer",
      offerId: "offer_declined",
      partnerId: "player_2",
    })).toMatchObject({ accepted: false, error: { code: "INVALID_TRADE" } });
  });

  it("derives a resource-port ratio and trades atomically with the bank", () => {
    let game = actionState();
    const port = game.map.ports.find((candidate) => candidate.kind === "resource");
    if (port === undefined) throw new Error("Missing resource port");
    const portVertexId = port.vertexIds[0];
    game = {
      ...game,
      buildings: [
        ...game.buildings.filter((building) => building.vertexId !== portVertexId),
        { ownerId: "player_1", vertexId: portVertexId, kind: "settlement" },
      ],
    };
    game = withHands(game, { player_1: resourceAmounts({ [port.resource]: 2 }) });

    expect(maritimeRatio(game, "player_1", port.resource)).toBe(2);
    game = accept(executeGameCommand(game, "player_1", {
      type: "MaritimeTrade",
      give: port.resource,
      receive: port.resource === "ore" ? "grain" : "ore",
    }));
    const hand = game.players.find((player) => player.id === "player_1")?.resources;
    expect(hand?.[port.resource]).toBe(0);
    expect(hand?.[port.resource === "ore" ? "grain" : "ore"]).toBe(1);
  });
});

function actionState(): GameState {
  let game = createBaseGame({ id: "game_trade", seed: 505, players });
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
