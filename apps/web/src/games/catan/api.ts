import type { AiCommentaryMode, AiCommentaryResponse, GameCommand, GameCommandReply, GameHistoryPage, RoomSettingsInput, RoomView } from "@catan/protocol/catan";
import type { PlayerSession } from "../../room-session.js";
import { getRoom } from "../../api.js";
import { ApiError, request } from "../../http.js";
import { randomId } from "../../lib/random-id.js";

export async function getRoomHistory(session: PlayerSession, gameId: string, beforeRevision: number): Promise<GameHistoryPage> {
  const query = new URLSearchParams({ seatToken: session.seatToken, gameId, beforeRevision: String(beforeRevision) });
  return request<GameHistoryPage>(`/api/rooms/${encodeURIComponent(session.roomId)}/history?${query}`);
}

export async function updateRoomSettings(
  session: PlayerSession,
  expectedRevision: number,
  settings: RoomSettingsInput,
): Promise<RoomView> {
  return request<RoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}/settings`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seatToken: session.seatToken, expectedRevision, ...settings }),
  });
}

export async function rerollRoomMap(
  session: PlayerSession,
  expectedRevision: number,
): Promise<RoomView> {
  return request<RoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}/reroll-map`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seatToken: session.seatToken, expectedRevision }),
  });
}

export async function submitGameCommand(
  session: PlayerSession,
  expectedRevision: number,
  command: GameCommand,
  matchId?: string,
): Promise<GameCommandReply> {
  return request<GameCommandReply>(`/api/rooms/${encodeURIComponent(session.roomId)}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      seatToken: session.seatToken,
      commandId: randomId(),
      responseMode: "ack",
      expectedRevision,
      matchId,
      command,
    }),
  });
}

export async function requestAiCommentary(
  session: PlayerSession,
  expectedRevision: number,
  mode: AiCommentaryMode,
): Promise<AiCommentaryResponse> {
  return request<AiCommentaryResponse>(`/api/rooms/${encodeURIComponent(session.roomId)}/ai-commentary`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seatToken: session.seatToken, expectedRevision, mode }),
  });
}

export async function getCatanRoom(session: PlayerSession, afterRevision?: number): Promise<RoomView> {
  const room = await getRoom(session, afterRevision);
  if (room.gameId !== "catan") throw new ApiError("WRONG_GAME", "房间游戏不匹配");
  return room;
}
