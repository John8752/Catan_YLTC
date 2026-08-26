import { BUILD_COSTS, findLegalRoadEdges, type RoadState } from "../buildables/index.js";
import type { DevelopmentCardState, DevelopmentCardType } from "../development/index.js";
import type { EdgeId, PlayerId } from "../primitives/index.js";
import {
  addResourceHands,
  hasResources,
  resourceAmounts,
  subtractResourceHands,
  type ResourceType,
} from "../resources/index.js";
import type { GameCommand, GameCommandErrorCode, GameCommandResult, GameEvent } from "./commands.js";
import { assertGameInvariant } from "./create-game.js";
import type { GameState, PlayerState } from "./state.js";
import { getRuleProfileDefinition } from "../rulesets/index.js";

type DevelopmentCommand = Extract<
  GameCommand,
  {
    type:
      | "BuyDevelopmentCard"
      | "PlayKnight"
      | "PlayRoadBuilding"
      | "BuildFreeRoad"
      | "PlayMonopoly"
      | "PlayResourceChoice";
  }
>;

export function executeDevelopmentCommand(
  state: GameState,
  actorId: PlayerId,
  command: DevelopmentCommand,
): GameCommandResult {
  switch (command.type) {
    case "BuyDevelopmentCard":
      return buyCard(state, actorId);
    case "PlayKnight":
      return playKnight(state, actorId, command.cardId);
    case "PlayRoadBuilding":
      return playRoadBuilding(state, actorId, command.cardId);
    case "BuildFreeRoad":
      return buildFreeRoad(state, actorId, command.edgeId);
    case "PlayMonopoly":
      return playMonopoly(state, actorId, command.cardId, command.resource);
    case "PlayResourceChoice":
      return playResourceChoice(state, actorId, command.cardId, command.resources);
  }
}

export function legalFreeRoadEdges(state: GameState, actorId: PlayerId): readonly EdgeId[] {
  if (
    state.phase.kind !== "turn" ||
    state.phase.step !== "free-road" ||
    state.phase.activePlayerId !== actorId
  ) return [];
  return findLegalRoadEdges(state.map, state.buildings, state.roads, actorId);
}

function buyCard(state: GameState, actorId: PlayerId): GameCommandResult {
  if (!isAction(state, actorId)) return actionError(state, actorId, "buy a development card");
  const player = requirePlayer(state, actorId);
  if (!hasResources(player.resources, BUILD_COSTS.development)) return insufficient(state);
  const cardType = state.developmentDeck[0];
  if (cardType === undefined) return reject(state, "DEVELOPMENT_DECK_EMPTY", "The development deck is empty");
  const card: DevelopmentCardState = {
    id: `development_${getRuleProfileDefinition(requirePlayableProfile(state)).developmentDeckSize - state.developmentDeck.length}`,
    type: cardType,
    acquiredTurn: turnNumber(state),
  };
  return accepted(
    {
      ...state,
      revision: state.revision + 1,
      bank: addResourceHands(state.bank, BUILD_COSTS.development),
      developmentDeck: state.developmentDeck.slice(1),
      players: updatePlayer(state.players, actorId, (candidate) => ({
        ...candidate,
        resources: subtractResourceHands(candidate.resources, BUILD_COSTS.development),
        developmentCards: [...candidate.developmentCards, card],
      })),
    },
    { type: "development_card_bought", playerId: actorId, cardId: card.id, cardType },
  );
}

function playKnight(state: GameState, actorId: PlayerId, cardId: string): GameCommandResult {
  const card = playableCard(state, actorId, cardId, "knight");
  if (!card.accepted) return card.result;
  const resume = currentPlayableStep(state);
  return accepted(
    consumeCard(
      {
        ...state,
        revision: state.revision + 1,
        robberResumeStep: resume,
        phase: { ...requireTurnPhase(state), step: "robber" },
        players: updatePlayer(state.players, actorId, (player) => ({
          ...player,
          playedKnights: player.playedKnights + 1,
        })),
      },
      actorId,
      cardId,
    ),
    { type: "development_card_played", playerId: actorId, cardId: card.card.id, cardType: "knight" },
  );
}

function playRoadBuilding(state: GameState, actorId: PlayerId, cardId: string): GameCommandResult {
  const card = playableCard(state, actorId, cardId, "road-building");
  if (!card.accepted) return card.result;
  const resume = currentPlayableStep(state);
  const player = requirePlayer(state, actorId);
  if (player.pieces.roads < 1 || findLegalRoadEdges(state.map, state.buildings, state.roads, actorId).length === 0) {
    return reject(state, "NO_PIECES_LEFT", "No legal free road can be placed");
  }
  const roadsGranted = Math.min(2, player.pieces.roads);
  return accepted(
    consumeCard(
      {
        ...state,
        revision: state.revision + 1,
        developmentResumeStep: resume,
        freeRoadsRemaining: roadsGranted,
        freeRoadsGranted: roadsGranted,
        phase: { ...requireTurnPhase(state), step: "free-road" },
      },
      actorId,
      cardId,
    ),
    {
      type: "development_card_played",
      playerId: actorId,
      cardId: card.card.id,
      cardType: "road-building",
      roadsGranted,
    },
  );
}

function buildFreeRoad(state: GameState, actorId: PlayerId, edgeId: EdgeId): GameCommandResult {
  if (
    state.phase.kind !== "turn" ||
    state.phase.step !== "free-road" ||
    state.phase.activePlayerId !== actorId
  ) return reject(state, "WRONG_PHASE", "A free road is not expected now");
  if (!legalFreeRoadEdges(state, actorId).includes(edgeId)) {
    return reject(state, "ILLEGAL_PLACEMENT", "The free road must connect to your network");
  }
  const road: RoadState = { ownerId: actorId, edgeId };
  const remaining = state.freeRoadsRemaining - 1;
  const player = requirePlayer(state, actorId);
  const changed: GameState = {
    ...state,
    roads: [...state.roads, road],
    players: updatePlayer(state.players, actorId, (candidate) => ({
      ...candidate,
      pieces: { ...candidate.pieces, roads: candidate.pieces.roads - 1 },
    })),
  };
  const canContinue =
    remaining > 0 &&
    player.pieces.roads > 1 &&
    findLegalRoadEdges(changed.map, changed.buildings, changed.roads, actorId).length > 0;
  const resume = state.developmentResumeStep ?? "action";
  const placed = state.freeRoadsGranted - remaining;
  return accepted(
    {
      ...changed,
      revision: state.revision + 1,
      freeRoadsRemaining: canContinue ? remaining : 0,
      freeRoadsGranted: canContinue ? state.freeRoadsGranted : 0,
      developmentResumeStep: canContinue ? state.developmentResumeStep : null,
      phase: canContinue ? state.phase : { ...state.phase, step: resume },
    },
    {
      type: "free_road_built",
      playerId: actorId,
      edgeId,
      placed,
      total: state.freeRoadsGranted,
      completed: !canContinue,
    },
  );
}

function playMonopoly(
  state: GameState,
  actorId: PlayerId,
  cardId: string,
  resource: ResourceType,
): GameCommandResult {
  const card = playableCard(state, actorId, cardId, "monopoly");
  if (!card.accepted) return card.result;
  const amount = state.players
    .filter((player) => player.id !== actorId)
    .reduce((total, player) => total + player.resources[resource], 0);
  const transfers = state.players
    .filter((player) => player.id !== actorId && player.resources[resource] > 0)
    .map((player) => ({ playerId: player.id, amount: player.resources[resource] }));
  const players = state.players.map((player) => {
    if (player.id === actorId) {
      return { ...player, resources: addResourceHands(player.resources, resourceAmounts({ [resource]: amount })) };
    }
    return { ...player, resources: { ...player.resources, [resource]: 0 } };
  });
  return accepted(
    consumeCard({ ...state, revision: state.revision + 1, players }, actorId, cardId),
    {
      type: "development_card_played",
      playerId: actorId,
      cardId: card.card.id,
      cardType: "monopoly",
      resource,
      total: amount,
      transfers,
    },
  );
}

function playResourceChoice(
  state: GameState,
  actorId: PlayerId,
  cardId: string,
  resources: readonly [ResourceType, ResourceType],
): GameCommandResult {
  const card = playableCard(state, actorId, cardId, "resource-choice");
  if (!card.accepted) return card.result;
  const grant = resourceAmounts({
    [resources[0]]: resources[0] === resources[1] ? 2 : 1,
    [resources[1]]: resources[0] === resources[1] ? 2 : 1,
  });
  if (!hasResources(state.bank, grant)) return reject(state, "BANK_SHORTAGE", "The bank lacks the selected resources");
  return accepted(
    consumeCard(
      {
        ...state,
        revision: state.revision + 1,
        bank: subtractResourceHands(state.bank, grant),
        players: updatePlayer(state.players, actorId, (player) => ({
          ...player,
          resources: addResourceHands(player.resources, grant),
        })),
      },
      actorId,
      cardId,
    ),
    {
      type: "development_card_played",
      playerId: actorId,
      cardId: card.card.id,
      cardType: "resource-choice",
      resources: grant,
    },
  );
}

type PlayableResult =
  | { readonly accepted: true; readonly card: DevelopmentCardState }
  | { readonly accepted: false; readonly result: GameCommandResult };

function playableCard(
  state: GameState,
  actorId: PlayerId,
  cardId: string,
  type: DevelopmentCardType,
): PlayableResult {
  if (!canPlayNow(state, actorId)) return { accepted: false, result: actionError(state, actorId, "play a card") };
  if (state.developmentCardPlayedThisTurn) {
    return { accepted: false, result: reject(state, "DEVELOPMENT_CARD_ALREADY_PLAYED", "Only one development card may be played per turn") };
  }
  const card = requirePlayer(state, actorId).developmentCards.find((candidate) => candidate.id === cardId && candidate.type === type);
  if (card === undefined) return { accepted: false, result: reject(state, "DEVELOPMENT_CARD_NOT_FOUND", "Development card not found") };
  if (card.acquiredTurn >= turnNumber(state)) {
    return { accepted: false, result: reject(state, "DEVELOPMENT_CARD_BOUGHT_THIS_TURN", "A purchased card cannot be played this turn") };
  }
  return { accepted: true, card };
}

function consumeCard(state: GameState, playerId: PlayerId, cardId: string): GameState {
  return {
    ...state,
    developmentCardPlayedThisTurn: true,
    players: updatePlayer(state.players, playerId, (player) => ({
      ...player,
      developmentCards: player.developmentCards.filter((card) => card.id !== cardId),
    })),
  };
}

function canPlayNow(state: GameState, playerId: PlayerId): boolean {
  return state.phase.kind === "turn" &&
    (state.phase.step === "roll" || state.phase.step === "action" || state.phase.step === "paired-action") &&
    state.phase.activePlayerId === playerId;
}

function currentPlayableStep(state: GameState): "roll" | "action" | "paired-action" {
  if (
    state.phase.kind !== "turn" ||
    (state.phase.step !== "roll" && state.phase.step !== "action" && state.phase.step !== "paired-action")
  ) {
    throw new Error("Development card has no resumable phase");
  }
  return state.phase.step;
}

function isAction(state: GameState, actorId: PlayerId): boolean {
  return state.phase.kind === "turn" &&
    (state.phase.step === "action" || state.phase.step === "paired-action") &&
    state.phase.activePlayerId === actorId;
}

function requirePlayableProfile(state: GameState): "base-3-4" | "extended-5-6" {
  if (state.ruleProfile === "two-player") throw new Error("The two-player profile is not playable");
  return state.ruleProfile;
}

function actionError(state: GameState, actorId: PlayerId, verb: string): GameCommandResult {
  if (state.phase.kind === "turn" && state.phase.activePlayerId !== actorId) {
    return reject(state, "NOT_YOUR_TURN", `Only the active player can ${verb}`);
  }
  return reject(state, "WRONG_PHASE", `Cannot ${verb} during this phase`);
}

function requireTurnPhase(state: GameState): Extract<GameState["phase"], { kind: "turn" }> {
  if (state.phase.kind !== "turn") throw new Error("Expected turn phase");
  return state.phase;
}

function turnNumber(state: GameState): number {
  return requireTurnPhase(state).turnNumber;
}

function accepted(state: GameState, event: GameEvent): GameCommandResult {
  assertGameInvariant(state);
  return { accepted: true, state, events: [event] };
}

function requirePlayer(state: GameState, playerId: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) throw new Error(`Unknown player ${playerId}`);
  return player;
}

function updatePlayer(
  players: readonly PlayerState[],
  playerId: PlayerId,
  update: (player: PlayerState) => PlayerState,
): readonly PlayerState[] {
  return players.map((player) => player.id === playerId ? update(player) : player);
}

function insufficient(state: GameState): GameCommandResult {
  return reject(state, "INSUFFICIENT_RESOURCES", "The player cannot afford a development card");
}

function reject(
  state: GameState,
  code: GameCommandErrorCode,
  message: string,
): GameCommandResult {
  return { accepted: false, state, events: [], error: { code, message } };
}
