import type { RoomView } from "./views.js";

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
