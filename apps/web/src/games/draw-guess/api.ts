import type { DrawGuessPlayerCommand } from "@catan/game-core/draw-guess";
import type { DrawGuessRoomView, DrawGuessSettings } from "@catan/protocol/draw-guess";
import { request } from "../../http.js";
import { type PlayerSession } from "../../room-session.js";
export function sendDrawCommand(session: PlayerSession, commandId: string, command: DrawGuessPlayerCommand): Promise<DrawGuessRoomView> {
  return request(`/api/rooms/${encodeURIComponent(session.roomId)}/draw-guess/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seatToken: session.seatToken, commandId, command }) });
}
export function saveDrawSettings(session: PlayerSession, revision: number, settings: DrawGuessSettings): Promise<DrawGuessRoomView> {
  return request(`/api/rooms/${encodeURIComponent(session.roomId)}/draw-guess/settings`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ seatToken: session.seatToken, expectedRevision: revision, ...settings }) });
}
