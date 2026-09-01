import type { RoomSettingsInput, RoomView } from "./views.js";

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

export interface LeaveRoomRequest {
  readonly seatToken: string;
}

export interface LeaveRoomResponse {
  readonly roomDeleted: boolean;
  readonly newHostPlayerId: string | null;
}

export const AI_COMMENTARY_MODES = ["commentary", "summary", "prediction"] as const;
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
}

export type RoomServerMessage =
  | {
      readonly type: "room_state";
      readonly room: RoomView;
    }
  | {
      readonly type: "error";
      readonly code: string;
      readonly message: string;
    };

export interface ApiErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}
