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
