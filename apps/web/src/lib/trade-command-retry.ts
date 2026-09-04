import { RESOURCE_TYPES } from "@catan/game-core";
import type { GameCommand, GameView } from "@catan/protocol";

type OpenTrade = NonNullable<GameView["openTrade"]>;
type TradeCommand = Extract<GameCommand, {
  readonly type:
    | "AcceptTradeOffer"
    | "DeclineTradeOffer"
    | "CounterTradeOffer"
    | "CompleteTradeOffer"
    | "CancelTradeOffer";
}>;

export function canRetryStaleTradeCommand(
  command: GameCommand,
  before: OpenTrade | null,
  after: OpenTrade | null,
  actorId: string,
): boolean {
  if (!isRetryableTradeCommand(command) || before === null || after === null) return false;
  if (command.offerId !== before.offerId || !sameOffer(before, after)) return false;

  switch (command.type) {
    case "AcceptTradeOffer":
    case "DeclineTradeOffer":
    case "CounterTradeOffer":
      return before.proposerId !== actorId;
    case "CancelTradeOffer":
      return before.proposerId === actorId;
    case "CompleteTradeOffer": {
      if (before.proposerId !== actorId) return false;
      const previousResponse = before.responses.find((response) => response.playerId === command.partnerId);
      const currentResponse = after.responses.find((response) => response.playerId === command.partnerId);
      return previousResponse !== undefined && currentResponse !== undefined && sameResponse(previousResponse, currentResponse);
    }
  }
}

function isRetryableTradeCommand(command: GameCommand): command is TradeCommand {
  return [
    "AcceptTradeOffer",
    "DeclineTradeOffer",
    "CounterTradeOffer",
    "CompleteTradeOffer",
    "CancelTradeOffer",
  ].includes(command.type);
}

function sameOffer(first: OpenTrade, second: OpenTrade): boolean {
  return first.offerId === second.offerId &&
    first.proposerId === second.proposerId &&
    sameResources(first.give, second.give) &&
    sameResources(first.receive, second.receive);
}

function sameResponse(first: OpenTrade["responses"][number], second: OpenTrade["responses"][number]): boolean {
  if (first.playerId !== second.playerId || first.response !== second.response) return false;
  if (first.response !== "countered" || second.response !== "countered") return true;
  return sameResources(first.proposerGives, second.proposerGives) &&
    sameResources(first.proposerReceives, second.proposerReceives);
}

function sameResources(first: OpenTrade["give"], second: OpenTrade["give"]): boolean {
  return RESOURCE_TYPES.every((resource) => first[resource] === second[resource]);
}
