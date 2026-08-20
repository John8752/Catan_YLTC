import {
  BUILD_COSTS,
  findLegalCityVertices,
  findLegalRoadEdges,
  findLegalSettlementVertices,
  type BuildingState,
  type RoadState,
} from "../buildables/index.js";
import type { EdgeId, PlayerId, VertexId } from "../primitives/index.js";
import {
  addResourceHands,
  hasResources,
  subtractResourceHands,
  type ResourceHand,
} from "../resources/index.js";
import type { GameCommand, GameCommandResult, GameEvent } from "./commands.js";
import { assertGameInvariant } from "./create-game.js";
import type { GameState, PlayerState } from "./state.js";

type BuildCommand = Extract<GameCommand, { type: "BuildRoad" | "BuildSettlement" | "BuildCity" }>;

export function executeBuildCommand(
  state: GameState,
  actorId: PlayerId,
  command: BuildCommand,
): GameCommandResult {
  if (state.phase.kind !== "turn" || state.phase.step !== "action") {
    return reject(state, "WRONG_PHASE", "Building is only allowed during the action stage");
  }
  if (state.phase.activePlayerId !== actorId) {
    return reject(state, "NOT_YOUR_TURN", "Only the active player can build");
  }

  switch (command.type) {
    case "BuildRoad":
      return buildRoad(state, actorId, command.edgeId);
    case "BuildSettlement":
      return buildSettlement(state, actorId, command.vertexId);
    case "BuildCity":
      return buildCity(state, actorId, command.vertexId);
  }
}

export function legalRoadEdges(state: GameState, actorId: PlayerId): readonly EdgeId[] {
  if (!canAct(state, actorId)) return [];
  return findLegalRoadEdges(state.map, state.buildings, state.roads, actorId);
}

export function legalSettlementVertices(state: GameState, actorId: PlayerId): readonly VertexId[] {
  if (!canAct(state, actorId)) return [];
  return findLegalSettlementVertices(state.map, state.buildings, state.roads, actorId);
}

export function legalCityVertices(state: GameState, actorId: PlayerId): readonly VertexId[] {
  if (!canAct(state, actorId)) return [];
  return findLegalCityVertices(state.buildings, actorId);
}

function buildRoad(state: GameState, actorId: PlayerId, edgeId: EdgeId): GameCommandResult {
  const player = requirePlayer(state, actorId);
  if (player.pieces.roads < 1) return reject(state, "NO_PIECES_LEFT", "No road pieces remain");
  if (!hasResources(player.resources, BUILD_COSTS.road)) return unaffordable(state);
  if (!legalRoadEdges(state, actorId).includes(edgeId)) {
    return reject(state, "ILLEGAL_PLACEMENT", "The road must connect to your unblocked network");
  }

  const road: RoadState = { ownerId: actorId, edgeId };
  return paidBuild(
    state,
    actorId,
    BUILD_COSTS.road,
    (candidate) => ({
      ...candidate,
      pieces: { ...candidate.pieces, roads: candidate.pieces.roads - 1 },
    }),
    { ...state, roads: [...state.roads, road] },
    { type: "piece_built", playerId: actorId, piece: "road", locationId: edgeId },
  );
}

function buildSettlement(state: GameState, actorId: PlayerId, vertexId: VertexId): GameCommandResult {
  const player = requirePlayer(state, actorId);
  if (player.pieces.settlements < 1) return reject(state, "NO_PIECES_LEFT", "No settlement pieces remain");
  if (!hasResources(player.resources, BUILD_COSTS.settlement)) return unaffordable(state);
  if (!legalSettlementVertices(state, actorId).includes(vertexId)) {
    return reject(state, "ILLEGAL_PLACEMENT", "The settlement must connect and obey the distance rule");
  }

  const building: BuildingState = { ownerId: actorId, vertexId, kind: "settlement" };
  return paidBuild(
    state,
    actorId,
    BUILD_COSTS.settlement,
    (candidate) => ({
      ...candidate,
      visibleVictoryPoints: candidate.visibleVictoryPoints + 1,
      pieces: { ...candidate.pieces, settlements: candidate.pieces.settlements - 1 },
    }),
    { ...state, buildings: [...state.buildings, building] },
    { type: "piece_built", playerId: actorId, piece: "settlement", locationId: vertexId },
  );
}

function buildCity(state: GameState, actorId: PlayerId, vertexId: VertexId): GameCommandResult {
  const player = requirePlayer(state, actorId);
  if (player.pieces.cities < 1) return reject(state, "NO_PIECES_LEFT", "No city pieces remain");
  if (!hasResources(player.resources, BUILD_COSTS.city)) return unaffordable(state);
  if (!legalCityVertices(state, actorId).includes(vertexId)) {
    return reject(state, "ILLEGAL_PLACEMENT", "A city must upgrade your settlement");
  }

  return paidBuild(
    state,
    actorId,
    BUILD_COSTS.city,
    (candidate) => ({
      ...candidate,
      visibleVictoryPoints: candidate.visibleVictoryPoints + 1,
      pieces: {
        ...candidate.pieces,
        settlements: candidate.pieces.settlements + 1,
        cities: candidate.pieces.cities - 1,
      },
    }),
    {
      ...state,
      buildings: state.buildings.map((building) =>
        building.vertexId === vertexId ? { ...building, kind: "city" } : building,
      ),
    },
    { type: "piece_built", playerId: actorId, piece: "city", locationId: vertexId },
  );
}

function paidBuild(
  original: GameState,
  actorId: PlayerId,
  cost: ResourceHand,
  update: (player: PlayerState) => PlayerState,
  changed: GameState,
  event: GameEvent,
): GameCommandResult {
  const state: GameState = {
    ...changed,
    revision: original.revision + 1,
    bank: addResourceHands(original.bank, cost),
    players: original.players.map((player) =>
      player.id === actorId
        ? update({ ...player, resources: subtractResourceHands(player.resources, cost) })
        : player,
    ),
  };
  assertGameInvariant(state);
  return { accepted: true, state, events: [event] };
}

function canAct(state: GameState, actorId: PlayerId): boolean {
  return state.phase.kind === "turn" && state.phase.step === "action" && state.phase.activePlayerId === actorId;
}

function requirePlayer(state: GameState, actorId: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === actorId);
  if (player === undefined) throw new Error(`Unknown player ${actorId}`);
  return player;
}

function unaffordable(state: GameState): GameCommandResult {
  return reject(state, "INSUFFICIENT_RESOURCES", "The player cannot afford this build");
}

function reject(
  state: GameState,
  code: "WRONG_PHASE" | "NOT_YOUR_TURN" | "NO_PIECES_LEFT" | "INSUFFICIENT_RESOURCES" | "ILLEGAL_PLACEMENT",
  message: string,
): GameCommandResult {
  return { accepted: false, state, events: [], error: { code, message } };
}
