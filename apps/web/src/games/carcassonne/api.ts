import type { CarcassonneCommandRequest, PlaceCommand } from "@catan/protocol/carcassonne";
import { request } from "../../http.js";
import type { PlayerSession } from "../../room-session.js";
import type { RoomCommandAck } from "@catan/protocol/platform";
export function sendCarcassonneCommand(session: PlayerSession, commandId: string, command: PlaceCommand): Promise<RoomCommandAck> {
  const body: CarcassonneCommandRequest={seatToken:session.seatToken,commandId,command};
  return request(`/api/rooms/${encodeURIComponent(session.roomId)}/carcassonne/commands`, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
}
