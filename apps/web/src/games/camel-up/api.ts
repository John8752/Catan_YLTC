import type { CamelCommand } from "@catan/game-core/camel-up";
import type { CamelRoomView } from "@catan/protocol/camel-up";
import type { PlayerSession } from "../../room-session.js";
import { request } from "../../http.js";
export function sendCamelCommand(session: PlayerSession, commandId: string, command: CamelCommand): Promise<CamelRoomView> {
  return request(`/api/rooms/${encodeURIComponent(session.roomId)}/camel-up/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seatToken: session.seatToken, commandId, command }) });
}
