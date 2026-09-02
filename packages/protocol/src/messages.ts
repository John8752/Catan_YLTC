import type { RoomSettingsInput, RoomView, TableIntentContent } from "./views.js";
import type { PlayerColor } from "@catan/game-core";

export interface CreateRoomRequest {
  readonly playerName: string;
}

export interface JoinRoomRequest {
  readonly playerName: string;
}

export interface PlayerSessionResponse {
  readonly roomId: string;
  readonly playerId: string;
  readonly seatToken: string;
  readonly room: RoomView;
}

export interface StartRoomRequest {
  readonly seatToken: string;
}

export interface UpdateRoomSettingsRequest extends RoomSettingsInput {
  readonly seatToken: string;
  readonly expectedRevision: number;
}

export interface RerollRoomMapRequest {
  readonly seatToken: string;
  readonly expectedRevision: number;
}

export interface UpdatePlayerColorRequest {
  readonly seatToken: string;
  readonly expectedRevision: number;
  readonly color: PlayerColor;
}

export interface ShuffleRoomMembersRequest {
  readonly seatToken: string;
  readonly expectedRevision: number;
}

export interface LeaveRoomRequest {
  readonly seatToken: string;
}

export interface LeaveRoomResponse {
  readonly roomDeleted: boolean;
  readonly newHostPlayerId: string | null;
}

export const AI_COMMENTARY_MODES = ["commentary", "summary", "prediction", "intent"] as const;
export type AiCommentaryMode = (typeof AI_COMMENTARY_MODES)[number];

export interface AiCommentaryRequest {
  readonly seatToken: string;
  readonly expectedRevision: number;
  readonly mode: AiCommentaryMode;
}

export interface AiCommentaryResponse {
  readonly mode: AiCommentaryMode;
  readonly revision: number;
  readonly content: string;
  /** Present only for "intent", whose answer is per player rather than prose. */
  readonly intent?: TableIntentContent;
}

export type RoomServerMessage =
  | {
      readonly type: "room_state";
      readonly room: RoomView;
    }
  | {
      /** The room is gone for everyone. Sent once, just before it stops existing. */
      readonly type: "room_closed";
      readonly message: string;
    }
  | {
      readonly type: "error";
      readonly code: string;
      readonly message: string;
    };

export interface DisbandRoomRequest {
  readonly seatToken: string;
}

export interface ApiErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}
