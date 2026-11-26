import type { PokerCommand, PokerCommandRequest, PokerRoomView, PokerSettings, PokerSettingsRequest } from "@catan/protocol/texas-holdem";
import { request } from "../../http.js";
import type { PlayerSession } from "../../room-session.js";
import type { RoomCommandAck } from "@catan/protocol/platform";
export function sendPokerCommand(s: PlayerSession, commandId: string, command: PokerCommand): Promise<RoomCommandAck> {
  const body: PokerCommandRequest = { seatToken: s.seatToken, commandId, command };
  return request(`/api/rooms/${encodeURIComponent(s.roomId)}/texas-holdem/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
export function savePokerSettings(s: PlayerSession, expectedRevision: number, settings: PokerSettings): Promise<PokerRoomView> {
  const body: PokerSettingsRequest = { seatToken: s.seatToken, expectedRevision, ...settings };
  return request(`/api/rooms/${encodeURIComponent(s.roomId)}/texas-holdem/settings`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
