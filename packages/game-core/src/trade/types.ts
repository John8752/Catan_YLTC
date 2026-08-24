import type { PlayerId } from "../primitives/index.js";
import type { ResourceHand } from "../resources/index.js";

export interface TradeOfferState {
  readonly offerId: string;
  readonly proposerId: PlayerId;
  readonly give: ResourceHand;
  readonly receive: ResourceHand;
  readonly responses: readonly TradeOfferResponse[];
}

export type TradeOfferResponse =
  | AcceptedTradeOfferResponse
  | DeclinedTradeOfferResponse
  | CounteredTradeOfferResponse;

export interface AcceptedTradeOfferResponse {
  readonly playerId: PlayerId;
  readonly response: "accepted";
}

export interface DeclinedTradeOfferResponse {
  readonly playerId: PlayerId;
  readonly response: "declined";
}

export interface CounteredTradeOfferResponse {
  readonly playerId: PlayerId;
  readonly response: "countered";
  readonly proposerGives: ResourceHand;
  readonly proposerReceives: ResourceHand;
}
