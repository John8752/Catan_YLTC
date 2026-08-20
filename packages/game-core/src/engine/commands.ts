import type { EdgeId, PlayerId, VertexId } from "../primitives/index.js";
import type { GameState } from "./state.js";

export type GameCommand =
  | { readonly type: "PlaceInitialSettlement"; readonly vertexId: VertexId }
  | { readonly type: "PlaceInitialRoad"; readonly edgeId: EdgeId };

export type GameCommandErrorCode =
  | "WRONG_PHASE"
  | "NOT_YOUR_TURN"
  | "INVALID_LOCATION"
  | "DISTANCE_RULE"
  | "ROAD_NOT_ADJACENT";

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
  | { readonly type: "setup_completed"; readonly firstPlayerId: PlayerId };

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
