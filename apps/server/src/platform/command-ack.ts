import type { RoomCommandAck } from "@catan/protocol/platform";
export function commandAck(room: { id: string; gameId: RoomCommandAck["gameId"]; revision: number }, commandId: string,
  game: { id: string; revision: number; handNumber?: number }): RoomCommandAck {
  return { type: "command_ack", commandId, roomId: room.id, gameId: room.gameId, matchId: game.id,
    roomRevision: room.revision, gameRevision: game.revision, ...(game.handNumber === undefined ? {} : { handNumber: game.handNumber }) };
}
