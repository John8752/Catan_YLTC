import type { CamelCommand } from "@catan/game-core/camel-up";
import type { PlayerSession } from "../../room-session.js";
import { request } from "../../http.js";
import type { RoomCommandAck } from "@catan/protocol/platform";
export function sendCamelCommand(session: PlayerSession, commandId: string, command: CamelCommand): Promise<RoomCommandAck> {
  return request(`/api/rooms/${encodeURIComponent(session.roomId)}/camel-up/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seatToken: session.seatToken, commandId, command }) });
}
