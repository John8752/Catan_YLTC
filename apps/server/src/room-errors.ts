export type RoomErrorCode =
  | "WRONG_GAME"
  | "STALE_MATCH"
  | "MATCH_NOT_FINISHED"
  | "ACCOUNT_BUSY"
  | "INVALID_REQUEST"
  | "ROOM_NOT_FOUND"
  | "PLAYER_NOT_FOUND"
  | "ROOM_ALREADY_STARTED"
  | "ROOM_FULL"
  | "INVALID_PLAYER_NAME"
  | "ONLY_HOST_CAN_START"
  | "ONLY_HOST_CAN_CONFIGURE"
  | "ONLY_HOST_CAN_SHUFFLE"
  | "ONLY_HOST_CAN_DISBAND"
  | "PLAYER_COLOR_TAKEN"
  | "NOT_ENOUGH_PLAYERS"
  | "INVALID_ROOM_SETTINGS"
  | "ROOM_CAPACITY_TOO_SMALL"
  | "STALE_ROOM_REVISION"
  | "CANNOT_LEAVE_STARTED_GAME"
  | "GAME_NOT_STARTED"
  | "STALE_REVISION";

export class RoomError<Code extends string = RoomErrorCode> extends Error {
  constructor(
    readonly code: Code,
    message: string,
  ) {
    super(message);
    this.name = "RoomError";
  }
}

export function normalizePlayerName(playerName: string): string {
  const name = playerName.trim();
  if (name.length < 1) {
    throw new RoomError("INVALID_PLAYER_NAME", "Player name cannot be empty");
  }
  return name;
}
