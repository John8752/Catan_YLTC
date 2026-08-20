import type { BuildingState, RoadState } from "../buildables/index.js";
import type { EdgeId, PlayerId, VertexId } from "../primitives/index.js";
import { RESOURCE_TYPES, type ResourceHand, type ResourceType } from "../resources/index.js";
import { assertGameInvariant } from "./create-game.js";
import type { GameCommand, GameCommandErrorCode, GameCommandResult, GameEvent } from "./commands.js";
import type { GamePhase, GameState, PlayerState } from "./state.js";

export function executeGameCommand(
  state: GameState,
  actorId: PlayerId,
  command: GameCommand,
): GameCommandResult {
  switch (command.type) {
    case "PlaceInitialSettlement":
      return placeInitialSettlement(state, actorId, command.vertexId);
    case "PlaceInitialRoad":
      return placeInitialRoad(state, actorId, command.edgeId);
  }
}

export function legalInitialSettlementVertices(
  state: GameState,
  actorId: PlayerId,
): readonly VertexId[] {
  if (state.phase.kind !== "setup" || state.phase.step !== "settlement") return [];
  if (currentSetupPlayer(state.phase) !== actorId) return [];
  const occupied = new Set(state.buildings.map((building) => building.vertexId));

  return state.map.vertices
    .filter(
      (vertex) =>
        !occupied.has(vertex.id) &&
        vertex.adjacentVertexIds.every((adjacentId) => !occupied.has(adjacentId)),
    )
    .map((vertex) => vertex.id);
}

export function legalInitialRoadEdges(state: GameState, actorId: PlayerId): readonly EdgeId[] {
  if (state.phase.kind !== "setup" || state.phase.step !== "road") return [];
  if (currentSetupPlayer(state.phase) !== actorId) return [];
  const occupied = new Set(state.roads.map((road) => road.edgeId));
  const settlementVertexId = state.phase.settlementVertexId;
  return state.map.edges
    .filter(
      (edge) => !occupied.has(edge.id) && edge.vertexIds.includes(settlementVertexId),
    )
    .map((edge) => edge.id);
}

function placeInitialSettlement(
  state: GameState,
  actorId: PlayerId,
  vertexId: VertexId,
): GameCommandResult {
  if (state.phase.kind !== "setup" || state.phase.step !== "settlement") {
    return reject(state, "WRONG_PHASE", "An initial settlement is not expected now");
  }
  if (currentSetupPlayer(state.phase) !== actorId) {
    return reject(state, "NOT_YOUR_TURN", "Another player must place now");
  }
  if (!state.map.vertices.some((vertex) => vertex.id === vertexId)) {
    return reject(state, "INVALID_LOCATION", "The settlement vertex does not exist");
  }
  if (!legalInitialSettlementVertices(state, actorId).includes(vertexId)) {
    return reject(state, "DISTANCE_RULE", "The settlement violates the distance rule");
  }

  const building: BuildingState = { ownerId: actorId, vertexId, kind: "settlement" };
  const placementCount = state.buildings.filter((candidate) => candidate.ownerId === actorId).length + 1;
  let bank = state.bank;
  let players = updatePlayer(state.players, actorId, (player) => ({
    ...player,
    pieces: { ...player.pieces, settlements: player.pieces.settlements - 1 },
    visibleVictoryPoints: player.visibleVictoryPoints + 1,
  }));
  const events: GameEvent[] = [{ type: "initial_settlement_placed", playerId: actorId, vertexId }];

  if (placementCount === 2) {
    const grant = startingResourceGrant(state, vertexId);
    bank = subtractHand(bank, grant);
    players = updatePlayer(players, actorId, (player) => ({
      ...player,
      resources: addHand(player.resources, grant),
    }));
    events.push({
      type: "starting_resources_granted",
      playerId: actorId,
      total: totalHand(grant),
    });
  }

  return accept(
    {
      ...state,
      revision: state.revision + 1,
      bank,
      buildings: [...state.buildings, building],
      players,
      phase: { ...state.phase, step: "road", settlementVertexId: vertexId },
    },
    events,
  );
}

function placeInitialRoad(
  state: GameState,
  actorId: PlayerId,
  edgeId: EdgeId,
): GameCommandResult {
  if (state.phase.kind !== "setup" || state.phase.step !== "road") {
    return reject(state, "WRONG_PHASE", "An initial road is not expected now");
  }
  if (currentSetupPlayer(state.phase) !== actorId) {
    return reject(state, "NOT_YOUR_TURN", "Another player must place now");
  }
  if (!state.map.edges.some((edge) => edge.id === edgeId)) {
    return reject(state, "INVALID_LOCATION", "The road edge does not exist");
  }
  if (!legalInitialRoadEdges(state, actorId).includes(edgeId)) {
    return reject(state, "ROAD_NOT_ADJACENT", "The road must touch the settlement just placed");
  }

  const road: RoadState = { ownerId: actorId, edgeId };
  const nextIndex = state.phase.placementIndex + 1;
  const firstPlayerId = state.phase.placementOrder[0];
  if (firstPlayerId === undefined) throw new Error("Setup order has no first player");
  const setupComplete = nextIndex >= state.phase.placementOrder.length;
  const phase: GamePhase = setupComplete
    ? { kind: "turn", activePlayerId: firstPlayerId, step: "roll", turnNumber: 1 }
    : {
        kind: "setup",
        step: "settlement",
        placementOrder: state.phase.placementOrder,
        placementIndex: nextIndex,
      };
  const events: GameEvent[] = [{ type: "initial_road_placed", playerId: actorId, edgeId }];
  if (setupComplete) events.push({ type: "setup_completed", firstPlayerId });

  return accept(
    {
      ...state,
      revision: state.revision + 1,
      roads: [...state.roads, road],
      players: updatePlayer(state.players, actorId, (player) => ({
        ...player,
        pieces: { ...player.pieces, roads: player.pieces.roads - 1 },
      })),
      phase,
    },
    events,
  );
}

function startingResourceGrant(state: GameState, vertexId: VertexId): ResourceHand {
  const vertex = state.map.vertices.find((candidate) => candidate.id === vertexId);
  if (vertex === undefined) throw new Error(`Missing vertex ${vertexId}`);
  const grant = emptyAmounts();

  for (const adjacentHexId of vertex.adjacentHexIds) {
    const terrain = state.map.hexes.find((hex) => hex.id === adjacentHexId)?.terrain;
    if (terrain !== undefined && terrain !== "desert") grant[terrain] += 1;
  }

  return grant;
}

function currentSetupPlayer(phase: Extract<GamePhase, { kind: "setup" }>): PlayerId | undefined {
  return phase.placementOrder[phase.placementIndex];
}

function updatePlayer(
  players: readonly PlayerState[],
  playerId: PlayerId,
  update: (player: PlayerState) => PlayerState,
): readonly PlayerState[] {
  let found = false;
  const next = players.map((player) => {
    if (player.id !== playerId) return player;
    found = true;
    return update(player);
  });
  if (!found) throw new Error(`Unknown player ${playerId}`);
  return next;
}

function emptyAmounts(): ResourceHand {
  return { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };
}

function addHand(first: ResourceHand, second: ResourceHand): ResourceHand {
  return mapHand((resource) => first[resource] + second[resource]);
}

function subtractHand(first: ResourceHand, second: ResourceHand): ResourceHand {
  return mapHand((resource) => first[resource] - second[resource]);
}

function mapHand(value: (resource: ResourceType) => number): ResourceHand {
  return Object.fromEntries(RESOURCE_TYPES.map((resource) => [resource, value(resource)])) as ResourceHand;
}

function totalHand(hand: ResourceHand): number {
  return RESOURCE_TYPES.reduce((total, resource) => total + hand[resource], 0);
}

function accept(state: GameState, events: readonly GameEvent[]): GameCommandResult {
  assertGameInvariant(state);
  return { accepted: true, state, events };
}

function reject(
  state: GameState,
  code: GameCommandErrorCode,
  message: string,
): GameCommandResult {
  return { accepted: false, state, events: [], error: { code, message } };
}
