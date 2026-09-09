import type { PlayerColor } from "@catan/game-core/primitives";
import type { GameType } from "./index.js";

export interface CreateRoomRequest {
  readonly gameId?: GameType;
  readonly playerName: string;
}

export interface JoinRoomRequest {
  readonly playerName: string;
}

export interface StartRoomRequest {
  readonly seatToken: string;
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

export interface DisbandRoomRequest {
  readonly seatToken: string;
}

export interface ApiErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}
