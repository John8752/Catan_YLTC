import type { PlayerId } from "../primitives/index.js";
import type { ResourceHand } from "../resources/index.js";

export interface TradeOfferState {
  readonly offerId: string;
  readonly proposerId: PlayerId;
  readonly give: ResourceHand;
  readonly receive: ResourceHand;
}
