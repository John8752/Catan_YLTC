import type { EdgeId, HexId, PlayerId, VertexId } from "../primitives/index.js";
import type { ResourceHand, ResourceType } from "../resources/index.js";
import type { GameState } from "./state.js";

export type GameCommand =
  | { readonly type: "PlaceInitialSettlement"; readonly vertexId: VertexId }
  | { readonly type: "PlaceInitialRoad"; readonly edgeId: EdgeId }
  | { readonly type: "RollDice" }
  | { readonly type: "DiscardResources"; readonly resources: ResourceHand }
  | { readonly type: "MoveRobber"; readonly hexId: HexId; readonly victimId: PlayerId | null }
  | { readonly type: "BuildRoad"; readonly edgeId: EdgeId }
  | { readonly type: "BuildSettlement"; readonly vertexId: VertexId }
  | { readonly type: "BuildCity"; readonly vertexId: VertexId }
  | {
      readonly type: "OpenTradeOffer";
      readonly offerId: string;
      readonly give: ResourceHand;
      readonly receive: ResourceHand;
    }
  | { readonly type: "AcceptTradeOffer"; readonly offerId: string }
  | { readonly type: "CancelTradeOffer"; readonly offerId: string }
  | { readonly type: "MaritimeTrade"; readonly give: ResourceType; readonly receive: ResourceType }
  | { readonly type: "BuyDevelopmentCard" }
  | { readonly type: "PlayKnight"; readonly cardId: string }
  | { readonly type: "PlayRoadBuilding"; readonly cardId: string }
  | { readonly type: "BuildFreeRoad"; readonly edgeId: EdgeId }
  | { readonly type: "PlayMonopoly"; readonly cardId: string; readonly resource: ResourceType }
  | {
      readonly type: "PlayResourceChoice";
      readonly cardId: string;
      readonly resources: readonly [ResourceType, ResourceType];
    }
  | { readonly type: "EndTurn" };

export type GameCommandErrorCode =
  | "WRONG_PHASE"
  | "NOT_YOUR_TURN"
  | "INVALID_LOCATION"
  | "DISTANCE_RULE"
  | "ROAD_NOT_ADJACENT"
  | "INVALID_DISCARD"
  | "ROBBER_MUST_MOVE"
  | "INVALID_VICTIM"
  | "NO_PIECES_LEFT"
  | "INSUFFICIENT_RESOURCES"
  | "ILLEGAL_PLACEMENT"
  | "INVALID_TRADE"
  | "TRADE_NOT_FOUND"
  | "BANK_SHORTAGE"
  | "DEVELOPMENT_DECK_EMPTY"
  | "DEVELOPMENT_CARD_NOT_FOUND"
  | "DEVELOPMENT_CARD_BOUGHT_THIS_TURN"
  | "DEVELOPMENT_CARD_ALREADY_PLAYED";

export interface GameCommandError {
  readonly code: GameCommandErrorCode;
  readonly message: string;
}

export type GameEvent =
  | {
      readonly type: "initial_settlement_placed";
      readonly playerId: PlayerId;
      readonly vertexId: VertexId;
    }
  | {
      readonly type: "initial_road_placed";
      readonly playerId: PlayerId;
      readonly edgeId: EdgeId;
    }
  | {
      readonly type: "starting_resources_granted";
      readonly playerId: PlayerId;
      readonly total: number;
    }
  | { readonly type: "setup_completed"; readonly firstPlayerId: PlayerId }
  | {
      readonly type: "dice_rolled";
      readonly playerId: PlayerId;
      readonly dice: readonly [number, number];
    }
  | { readonly type: "resources_produced"; readonly total: number }
  | { readonly type: "resources_discarded"; readonly playerId: PlayerId; readonly total: number }
  | {
      readonly type: "robber_moved";
      readonly playerId: PlayerId;
      readonly hexId: HexId;
      readonly victimId: PlayerId | null;
      readonly stolenResource: ResourceType | null;
    }
  | {
      readonly type: "turn_ended";
      readonly playerId: PlayerId;
      readonly nextPlayerId: PlayerId;
      readonly turnNumber: number;
    }
  | {
      readonly type: "piece_built";
      readonly playerId: PlayerId;
      readonly piece: "road" | "settlement" | "city";
      readonly locationId: EdgeId | VertexId;
    }
  | { readonly type: "trade_offered"; readonly offerId: string; readonly playerId: PlayerId }
  | { readonly type: "trade_cancelled"; readonly offerId: string; readonly playerId: PlayerId }
  | {
      readonly type: "player_trade_completed";
      readonly offerId: string;
      readonly proposerId: PlayerId;
      readonly accepterId: PlayerId;
    }
  | {
      readonly type: "maritime_trade_completed";
      readonly playerId: PlayerId;
      readonly give: ResourceType;
      readonly receive: ResourceType;
      readonly ratio: number;
    }
  | {
      readonly type: "development_card_bought";
      readonly playerId: PlayerId;
      readonly cardId: string;
      readonly cardType: string;
    }
  | { readonly type: "development_card_played"; readonly playerId: PlayerId; readonly cardId: string; readonly cardType: string }
  | { readonly type: "free_road_built"; readonly playerId: PlayerId; readonly edgeId: EdgeId }
  | {
      readonly type: "award_changed";
      readonly award: "longest-road" | "largest-army";
      readonly holderId: PlayerId | null;
    }
  | { readonly type: "game_won"; readonly playerId: PlayerId };

export type GameCommandResult =
  | {
      readonly accepted: true;
      readonly state: GameState;
      readonly events: readonly GameEvent[];
    }
  | {
      readonly accepted: false;
      readonly state: GameState;
      readonly events: readonly [];
      readonly error: GameCommandError;
    };
