import type { BuildingState, RoadState } from "../buildables/index.js";
import { finalizeAcceptedTransition } from "./finalize.js";
import {
  createSeededRandom,
  type EdgeId,
  type HexId,
  type PlayerId,
  type RandomSource,
  type VertexId,
} from "../primitives/index.js";
import {
  calculateProductionClaims,
  resolveProductionClaims,
  RESOURCE_TYPES,
  type ResourceHand,
  type ResourceType,
} from "../resources/index.js";
import { assertGameInvariant } from "./create-game.js";
import { executeBuildCommand } from "./build-command.js";
import { executeTradeCommand } from "./trade-command.js";
import { executeDevelopmentCommand } from "./development-command.js";
import type { GameCommand, GameCommandErrorCode, GameCommandResult, GameEvent, ResourceGrantSource } from "./commands.js";
import type { GamePhase, GameState, PlayerState } from "./state.js";

export function executeGameCommand(
  state: GameState,
  actorId: PlayerId,
  command: GameCommand,
  random: RandomSource = createSeededRandom(state.seed ^ state.revision),
): GameCommandResult {
  return finalizeAcceptedTransition(dispatchGameCommand(state, actorId, command, random));
}

function dispatchGameCommand(
  state: GameState,
  actorId: PlayerId,
  command: GameCommand,
  random: RandomSource,
): GameCommandResult {
  switch (command.type) {
    case "PlaceInitialSettlement":
      return placeInitialSettlement(state, actorId, command.vertexId);
    case "PlaceInitialRoad":
      return placeInitialRoad(state, actorId, command.edgeId);
    case "RollDice":
      return rollDice(state, actorId, random);
    case "DiscardResources":
      return discardResources(state, actorId, command.resources);
    case "MoveRobber":
      return moveRobber(state, actorId, command.hexId, command.victimId, random);
    case "BuildRoad":
    case "BuildSettlement":
    case "BuildCity":
      return executeBuildCommand(state, actorId, command);
    case "OpenTradeOffer":
    case "AcceptTradeOffer":
    case "DeclineTradeOffer":
    case "CompleteTradeOffer":
    case "CancelTradeOffer":
    case "MaritimeTrade":
      return executeTradeCommand(state, actorId, command);
    case "BuyDevelopmentCard":
    case "PlayKnight":
    case "PlayRoadBuilding":
    case "BuildFreeRoad":
    case "PlayMonopoly":
    case "PlayResourceChoice":
      return executeDevelopmentCommand(state, actorId, command);
    case "EndTurn":
      return endTurn(state, actorId);
  }
}

export interface RobberTarget {
  readonly hexId: HexId;
  readonly victimIds: readonly PlayerId[];
}

export function legalRobberTargets(state: GameState, actorId: PlayerId): readonly RobberTarget[] {
  if (
    state.phase.kind !== "turn" ||
    state.phase.step !== "robber" ||
    state.phase.activePlayerId !== actorId
  ) {
    return [];
  }
  const buildingByVertex = new Map(state.buildings.map((building) => [building.vertexId, building]));

  return state.map.hexes
    .filter((hex) => hex.id !== state.map.robberHexId)
    .map((hex) => {
      const victimIds = new Set<PlayerId>();
      for (const vertexId of hex.vertexIds) {
        const building = buildingByVertex.get(vertexId);
        if (building === undefined || building.ownerId === actorId) continue;
        const victim = state.players.find((player) => player.id === building.ownerId);
        if (victim !== undefined && totalHand(victim.resources) > 0) victimIds.add(victim.id);
      }
      return { hexId: hex.id, victimIds: [...victimIds].sort() };
    });
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
    const sources = startingResourceSources(state, actorId, vertexId);
    const grant = sources.reduce((resources, source) => {
      resources[source.resource] += source.amount;
      return resources;
    }, emptyAmounts());
    bank = subtractHand(bank, grant);
    players = updatePlayer(players, actorId, (player) => ({
      ...player,
      resources: addHand(player.resources, grant),
    }));
    events.push({
      type: "starting_resources_granted",
      playerId: actorId,
      total: totalHand(grant),
      resources: grant,
      sources,
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

function rollDice(state: GameState, actorId: PlayerId, random: RandomSource): GameCommandResult {
  if (state.phase.kind !== "turn" || state.phase.step !== "roll") {
    return reject(state, "WRONG_PHASE", "Dice can only be rolled at the start of a turn");
  }
  if (state.phase.activePlayerId !== actorId) {
    return reject(state, "NOT_YOUR_TURN", "Only the active player can roll");
  }

  const dice: readonly [number, number] = [die(random), die(random)];
  const total = dice[0] + dice[1];
  if (total === 7) {
    const pendingDiscards = state.players
      .map((player) => ({ playerId: player.id, count: Math.floor(totalHand(player.resources) / 2) }))
      .filter(({ count }) => count > 3);
    return accept(
      {
        ...state,
        revision: state.revision + 1,
        lastRoll: dice,
        pendingDiscards,
        phase: { ...state.phase, step: pendingDiscards.length > 0 ? "discard" : "robber" },
      },
      [{ type: "dice_rolled", playerId: actorId, dice }],
    );
  }

  const claims = calculateProductionClaims(state.map, state.buildings, total);
  const triggeredHexIds = state.map.hexes
    .filter((hex) => hex.numberToken === total && hex.id !== state.map.robberHexId && hex.terrain !== "desert")
    .map((hex) => hex.id);
  const production = resolveProductionClaims(state.bank, claims);
  const grants = state.players.flatMap((player) => {
    const resources = production.grants.get(player.id);
    return resources === undefined || totalHand(resources) === 0 ? [] : [{ playerId: player.id, resources }];
  });
  const sources = claims.filter((claim) => (production.grants.get(claim.playerId)?.[claim.resource] ?? 0) > 0);
  const players = state.players.map((player) => {
    const grant = production.grants.get(player.id);
    return grant === undefined
      ? player
      : { ...player, resources: addHand(player.resources, grant) };
  });

  return accept(
    {
      ...state,
      revision: state.revision + 1,
      bank: production.bank,
      players,
      lastRoll: dice,
      phase: { ...state.phase, step: "action" },
    },
    [
      { type: "dice_rolled", playerId: actorId, dice },
      {
        type: "resources_produced",
        total: grants.reduce((sum, grant) => sum + totalHand(grant.resources), 0),
        grants,
        sources,
        triggeredHexIds,
      },
    ],
  );
}

function discardResources(
  state: GameState,
  actorId: PlayerId,
  resources: ResourceHand,
): GameCommandResult {
  if (state.phase.kind !== "turn" || state.phase.step !== "discard") {
    return reject(state, "WRONG_PHASE", "Resources are not being discarded now");
  }
  const requirement = state.pendingDiscards.find((pending) => pending.playerId === actorId);
  const player = state.players.find((candidate) => candidate.id === actorId);
  if (requirement === undefined || player === undefined) {
    return reject(state, "NOT_YOUR_TURN", "This player does not need to discard");
  }
  if (
    totalHand(resources) !== requirement.count ||
    RESOURCE_TYPES.some((resource) => resources[resource] < 0 || resources[resource] > player.resources[resource])
  ) {
    return reject(state, "INVALID_DISCARD", `Exactly ${requirement.count} held cards must be discarded`);
  }

  const pendingDiscards = state.pendingDiscards.filter((pending) => pending.playerId !== actorId);
  return accept(
    {
      ...state,
      revision: state.revision + 1,
      bank: addHand(state.bank, resources),
      players: updatePlayer(state.players, actorId, (candidate) => ({
        ...candidate,
        resources: subtractHand(candidate.resources, resources),
      })),
      pendingDiscards,
      phase: pendingDiscards.length === 0 ? { ...state.phase, step: "robber" } : state.phase,
    },
    [{ type: "resources_discarded", playerId: actorId, total: requirement.count }],
  );
}

function moveRobber(
  state: GameState,
  actorId: PlayerId,
  hexId: HexId,
  victimId: PlayerId | null,
  random: RandomSource,
): GameCommandResult {
  if (state.phase.kind !== "turn" || state.phase.step !== "robber") {
    return reject(state, "WRONG_PHASE", "The robber cannot move now");
  }
  if (state.phase.activePlayerId !== actorId) {
    return reject(state, "NOT_YOUR_TURN", "Only the active player moves the robber");
  }
  if (hexId === state.map.robberHexId) {
    return reject(state, "ROBBER_MUST_MOVE", "The robber must move to a different hex");
  }
  const target = legalRobberTargets(state, actorId).find((candidate) => candidate.hexId === hexId);
  if (target === undefined) return reject(state, "INVALID_LOCATION", "The robber hex does not exist");
  if (
    (target.victimIds.length > 0 && (victimId === null || !target.victimIds.includes(victimId))) ||
    (target.victimIds.length === 0 && victimId !== null)
  ) {
    return reject(state, "INVALID_VICTIM", "Choose an eligible adjacent player");
  }

  let players = state.players;
  let stolenResource: ResourceType | null = null;
  if (victimId !== null) {
    const victim = state.players.find((player) => player.id === victimId);
    if (victim === undefined) return reject(state, "INVALID_VICTIM", "The victim does not exist");
    stolenResource = randomResourceFromHand(victim.resources, random);
    if (stolenResource !== null) {
      const transfer = { ...emptyAmounts(), [stolenResource]: 1 };
      players = updatePlayer(players, victimId, (player) => ({
        ...player,
        resources: subtractHand(player.resources, transfer),
      }));
      players = updatePlayer(players, actorId, (player) => ({
        ...player,
        resources: addHand(player.resources, transfer),
      }));
    }
  }

  return accept(
    {
      ...state,
      revision: state.revision + 1,
      map: { ...state.map, robberHexId: hexId },
      players,
      pendingDiscards: [],
      phase: { ...state.phase, step: state.robberResumeStep ?? "action" },
      robberResumeStep: null,
    },
    [{ type: "robber_moved", playerId: actorId, hexId, victimId, stolenResource }],
  );
}

function endTurn(state: GameState, actorId: PlayerId): GameCommandResult {
  if (state.phase.kind !== "turn" || state.phase.step !== "action") {
    return reject(state, "WRONG_PHASE", "The turn cannot end during a mandatory resolution");
  }
  if (state.phase.activePlayerId !== actorId) {
    return reject(state, "NOT_YOUR_TURN", "Only the active player can end the turn");
  }

  const currentIndex = state.players.findIndex((player) => player.id === actorId);
  if (currentIndex < 0) throw new Error(`Unknown active player ${actorId}`);
  const nextPlayer = state.players[(currentIndex + 1) % state.players.length];
  if (nextPlayer === undefined) throw new Error("Game has no next player");
  const turnNumber = state.phase.turnNumber + 1;

  return accept(
    {
      ...state,
      revision: state.revision + 1,
      lastRoll: null,
      openTrade: null,
      developmentCardPlayedThisTurn: false,
      phase: {
        kind: "turn",
        activePlayerId: nextPlayer.id,
        step: "roll",
        turnNumber,
      },
    },
    [{ type: "turn_ended", playerId: actorId, nextPlayerId: nextPlayer.id, turnNumber }],
  );
}

function die(random: RandomSource): number {
  return Math.floor(random.next() * 6) + 1;
}

function randomResourceFromHand(hand: ResourceHand, random: RandomSource): ResourceType | null {
  const total = totalHand(hand);
  if (total === 0) return null;
  let target = Math.floor(random.next() * total);
  for (const resource of RESOURCE_TYPES) {
    if (target < hand[resource]) return resource;
    target -= hand[resource];
  }
  throw new Error("Random resource selection escaped the hand");
}

function startingResourceSources(
  state: GameState,
  playerId: PlayerId,
  vertexId: VertexId,
): readonly ResourceGrantSource[] {
  const vertex = state.map.vertices.find((candidate) => candidate.id === vertexId);
  if (vertex === undefined) throw new Error(`Missing vertex ${vertexId}`);
  const sources: ResourceGrantSource[] = [];

  for (const adjacentHexId of vertex.adjacentHexIds) {
    const hex = state.map.hexes.find((candidate) => candidate.id === adjacentHexId);
    if (hex !== undefined && hex.terrain !== "desert") {
      sources.push({ playerId, resource: hex.terrain, amount: 1, hexId: hex.id, vertexId });
    }
  }

  return sources;
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
