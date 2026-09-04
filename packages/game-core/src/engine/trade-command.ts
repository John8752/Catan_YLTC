import type { PlayerId } from "../primitives/index.js";
import {
  addResourceHands,
  hasResources,
  resourceAmounts,
  subtractResourceHands,
  totalResources,
  RESOURCE_TYPES,
  type ResourceHand,
  type ResourceType,
} from "../resources/index.js";
import { calculateMaritimeRatio } from "../trade/index.js";
import type { GameCommand, GameCommandResult, GameEvent } from "./commands.js";
import { assertGameInvariant } from "./create-game.js";
import type { GameState, PlayerState } from "./state.js";

type TradeCommand = Extract<
  GameCommand,
  {
    type:
      | "OpenTradeOffer"
      | "AcceptTradeOffer"
      | "DeclineTradeOffer"
      | "CounterTradeOffer"
      | "CompleteTradeOffer"
      | "CancelTradeOffer"
      | "MaritimeTrade";
  }
>;

export function executeTradeCommand(
  state: GameState,
  actorId: PlayerId,
  command: TradeCommand,
): GameCommandResult {
  if (
    state.phase.kind !== "turn" ||
    (state.phase.step !== "action" && state.phase.step !== "paired-action")
  ) {
    return reject(state, "WRONG_PHASE", "Trading is only allowed during the action stage");
  }
  if (state.phase.step === "paired-action" && command.type !== "MaritimeTrade") {
    return reject(state, "INVALID_TRADE", "The paired player may only trade with the bank");
  }

  switch (command.type) {
    case "OpenTradeOffer":
      return openOffer(state, actorId, command.offerId, command.give, command.receive);
    case "AcceptTradeOffer":
      return respondToOffer(state, actorId, command.offerId, "accepted");
    case "DeclineTradeOffer":
      return respondToOffer(state, actorId, command.offerId, "declined");
    case "CounterTradeOffer":
      return counterOffer(
        state,
        actorId,
        command.offerId,
        command.proposerGives,
        command.proposerReceives,
      );
    case "CompleteTradeOffer":
      return completeOffer(state, actorId, command.offerId, command.partnerId);
    case "CancelTradeOffer":
      return cancelOffer(state, actorId, command.offerId);
    case "MaritimeTrade":
      return maritimeTrade(state, actorId, command.give, command.receive);
  }
}

export function maritimeRatio(state: GameState, playerId: PlayerId, resource: ResourceType): 2 | 3 | 4 {
  return calculateMaritimeRatio(state.map, state.buildings, playerId, resource);
}

function openOffer(
  state: GameState,
  actorId: PlayerId,
  offerId: string,
  give: ResourceHand,
  receive: ResourceHand,
): GameCommandResult {
  if (state.phase.kind !== "turn" || state.phase.activePlayerId !== actorId) {
    return reject(state, "NOT_YOUR_TURN", "Only the active player can offer a trade");
  }
  if (state.openTrade !== null) return reject(state, "INVALID_TRADE", "A trade offer is already open");
  if (offerId.trim().length === 0 || !validTradeTerms(give, receive)) {
    return reject(state, "INVALID_TRADE", "The trade offer is invalid");
  }
  const proposer = requirePlayer(state, actorId);
  if (!hasResources(proposer.resources, give)) return insufficient(state);

  return accepted(
    {
      ...state,
      revision: state.revision + 1,
      openTrade: { offerId, proposerId: actorId, give, receive, responses: [] },
    },
    { type: "trade_offered", offerId, playerId: actorId },
  );
}

function counterOffer(
  state: GameState,
  actorId: PlayerId,
  offerId: string,
  proposerGives: ResourceHand,
  proposerReceives: ResourceHand,
): GameCommandResult {
  const offer = state.openTrade;
  if (offer === null || offer.offerId !== offerId) return reject(state, "TRADE_NOT_FOUND", "Trade offer not found");
  if (offer.proposerId === actorId) return reject(state, "INVALID_TRADE", "The proposer cannot counter their own offer");
  if (state.phase.kind !== "turn" || state.phase.activePlayerId !== offer.proposerId) {
    return reject(state, "INVALID_TRADE", "The offer is no longer active");
  }
  if (!validTradeTerms(proposerGives, proposerReceives)) {
    return reject(state, "INVALID_TRADE", "The counteroffer is invalid");
  }
  const previous = offer.responses.find((candidate) => candidate.playerId === actorId);
  if (
    previous?.response === "countered" &&
    equalResourceHands(previous.proposerGives, proposerGives) &&
    equalResourceHands(previous.proposerReceives, proposerReceives)
  ) {
    return unchanged(state);
  }
  const responder = requirePlayer(state, actorId);
  if (!hasResources(responder.resources, proposerReceives)) return insufficient(state);

  const responses = [
    ...offer.responses.filter((candidate) => candidate.playerId !== actorId),
    { playerId: actorId, response: "countered" as const, proposerGives, proposerReceives },
  ];
  return accepted(
    { ...state, revision: state.revision + 1, openTrade: { ...offer, responses } },
    { type: "trade_response_recorded", offerId, playerId: actorId, response: "countered" },
  );
}

function respondToOffer(
  state: GameState,
  actorId: PlayerId,
  offerId: string,
  response: "accepted" | "declined",
): GameCommandResult {
  const offer = state.openTrade;
  if (offer === null || offer.offerId !== offerId) return reject(state, "TRADE_NOT_FOUND", "Trade offer not found");
  if (offer.proposerId === actorId) return reject(state, "INVALID_TRADE", "The proposer cannot answer their own offer");
  if (state.phase.kind !== "turn" || state.phase.activePlayerId !== offer.proposerId) {
    return reject(state, "INVALID_TRADE", "The offer is no longer active");
  }
  if (offer.responses.some((candidate) => candidate.playerId === actorId && candidate.response === response)) {
    return unchanged(state);
  }
  const responder = requirePlayer(state, actorId);
  if (response === "accepted" && !hasResources(responder.resources, offer.receive)) {
    return insufficient(state);
  }
  const responses = [
    ...offer.responses.filter((candidate) => candidate.playerId !== actorId),
    { playerId: actorId, response },
  ];
  return accepted(
    { ...state, revision: state.revision + 1, openTrade: { ...offer, responses } },
    { type: "trade_response_recorded", offerId, playerId: actorId, response },
  );
}

function completeOffer(
  state: GameState,
  actorId: PlayerId,
  offerId: string,
  partnerId: PlayerId,
): GameCommandResult {
  const offer = state.openTrade;
  if (offer === null || offer.offerId !== offerId) return reject(state, "TRADE_NOT_FOUND", "Trade offer not found");
  if (offer.proposerId !== actorId) return reject(state, "INVALID_TRADE", "Only the proposer selects a trade partner");
  if (state.phase.kind !== "turn" || state.phase.activePlayerId !== actorId) {
    return reject(state, "INVALID_TRADE", "The offer is no longer active");
  }
  const selectedResponse = offer.responses.find((candidate) => candidate.playerId === partnerId);
  if (selectedResponse === undefined || selectedResponse.response === "declined") {
    return reject(state, "INVALID_TRADE", "The selected player has not accepted or countered this offer");
  }
  const give = selectedResponse.response === "countered" ? selectedResponse.proposerGives : offer.give;
  const receive = selectedResponse.response === "countered" ? selectedResponse.proposerReceives : offer.receive;
  const proposer = requirePlayer(state, offer.proposerId);
  const accepter = requirePlayer(state, partnerId);
  if (!hasResources(proposer.resources, give) || !hasResources(accepter.resources, receive)) {
    return insufficient(state);
  }

  const players = state.players.map((player) => {
    if (player.id === proposer.id) {
      return {
        ...player,
        resources: addResourceHands(subtractResourceHands(player.resources, give), receive),
      };
    }
    if (player.id === accepter.id) {
      return {
        ...player,
        resources: addResourceHands(subtractResourceHands(player.resources, receive), give),
      };
    }
    return player;
  });
  return accepted(
    { ...state, revision: state.revision + 1, players, openTrade: null },
    {
      type: "player_trade_completed",
      offerId,
      proposerId: proposer.id,
      accepterId: accepter.id,
      give,
      receive,
    },
  );
}

function validTradeTerms(give: ResourceHand, receive: ResourceHand): boolean {
  return !(
    (totalResources(give) === 0 && totalResources(receive) === 0) ||
    RESOURCE_TYPES.some((resource) => give[resource] > 0 && receive[resource] > 0) ||
    RESOURCE_TYPES.some((resource) =>
      !Number.isInteger(give[resource]) ||
      !Number.isInteger(receive[resource]) ||
      give[resource] < 0 ||
      receive[resource] < 0
    )
  );
}

function cancelOffer(state: GameState, actorId: PlayerId, offerId: string): GameCommandResult {
  const offer = state.openTrade;
  if (offer === null || offer.offerId !== offerId) return reject(state, "TRADE_NOT_FOUND", "Trade offer not found");
  if (offer.proposerId !== actorId) return reject(state, "INVALID_TRADE", "Only the proposer can cancel the offer");
  return accepted(
    { ...state, revision: state.revision + 1, openTrade: null },
    { type: "trade_cancelled", offerId, playerId: actorId },
  );
}

function maritimeTrade(
  state: GameState,
  actorId: PlayerId,
  give: ResourceType,
  receive: ResourceType,
): GameCommandResult {
  if (state.phase.kind !== "turn" || state.phase.activePlayerId !== actorId) {
    return reject(state, "NOT_YOUR_TURN", "Only the active player can trade with the bank");
  }
  if (give === receive) return reject(state, "INVALID_TRADE", "Maritime resources must differ");
  const ratio = maritimeRatio(state, actorId, give);
  const payment = resourceAmounts({ [give]: ratio });
  const receipt = resourceAmounts({ [receive]: 1 });
  const player = requirePlayer(state, actorId);
  if (!hasResources(player.resources, payment)) return insufficient(state);
  if (state.bank[receive] < 1) return reject(state, "BANK_SHORTAGE", "The bank lacks the requested resource");

  return accepted(
    {
      ...state,
      revision: state.revision + 1,
      bank: addResourceHands(subtractResourceHands(state.bank, receipt), payment),
      players: updatePlayer(state.players, actorId, (candidate) => ({
        ...candidate,
        resources: addResourceHands(subtractResourceHands(candidate.resources, payment), receipt),
      })),
    },
    { type: "maritime_trade_completed", playerId: actorId, give, receive, ratio },
  );
}

function accepted(state: GameState, event: GameEvent): GameCommandResult {
  assertGameInvariant(state);
  return { accepted: true, state, events: [event] };
}

function unchanged(state: GameState): GameCommandResult {
  return { accepted: true, state, events: [] };
}

function equalResourceHands(first: ResourceHand, second: ResourceHand): boolean {
  return RESOURCE_TYPES.every((resource) => first[resource] === second[resource]);
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
  return reject(state, "INSUFFICIENT_RESOURCES", "A trade participant lacks the offered resources");
}

function reject(
  state: GameState,
  code: "WRONG_PHASE" | "NOT_YOUR_TURN" | "INVALID_TRADE" | "TRADE_NOT_FOUND" | "INSUFFICIENT_RESOURCES" | "BANK_SHORTAGE",
  message: string,
): GameCommandResult {
  return { accepted: false, state, events: [], error: { code, message } };
}
