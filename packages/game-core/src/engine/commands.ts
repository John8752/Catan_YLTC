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
  | "ILLEGAL_PLACEMENT";

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
    };

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
