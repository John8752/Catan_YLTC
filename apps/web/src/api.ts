import type { PlayerSession } from "./room-session.js";
import { createPlatformRoomDecoder, PLATFORM_ROOM_TRANSPORT, RoomBaselineError, type PlatformWireMessage } from "@catan/protocol/transport";
import { request } from "./http.js";
import type { LeaveRoomResponse, RoomSession, AnyRoomServerMessage, AnyRoomView, GameType } from "@catan/protocol/platform";
import type { PlayerColor } from "@catan/game-core/primitives";

export async function createRoom(playerName: string, gameId: GameType = "catan"): Promise<RoomSession> {
  return request<RoomSession>("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerName, gameId }),
  });
}

export async function joinRoom(roomId: string, playerName: string): Promise<RoomSession> {
  return request<RoomSession>(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerName }),
  });
}

export async function getRoom(session: PlayerSession, afterRevision?: number): Promise<AnyRoomView> {
  const query = new URLSearchParams({ seatToken: session.seatToken, transport: PLATFORM_ROOM_TRANSPORT });
  if (afterRevision !== undefined) query.set("afterRevision", String(afterRevision));
  return request<AnyRoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}?${query}`);
}

export async function startRoom(session: PlayerSession): Promise<AnyRoomView> {
  return request<AnyRoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seatToken: session.seatToken }),
  });
}

export async function updatePlayerColor(
  session: PlayerSession,
  expectedRevision: number,
  color: PlayerColor,
): Promise<AnyRoomView> {
  return request<AnyRoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}/player-color`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seatToken: session.seatToken, expectedRevision, color }),
  });
}

export async function shuffleRoomMembers(
  session: PlayerSession,
  expectedRevision: number,
): Promise<AnyRoomView> {
  return request<AnyRoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}/shuffle-members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seatToken: session.seatToken, expectedRevision }),
  });
}

/** Ends the room for everyone. Host only, and it works mid-match. */
export async function disbandRoom(session: PlayerSession): Promise<void> {
  await request<{ readonly roomDeleted: boolean }>(
    `/api/rooms/${encodeURIComponent(session.roomId)}/disband`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seatToken: session.seatToken }),
    },
  );
}

export async function leaveRoom(session: PlayerSession): Promise<LeaveRoomResponse> {
  return request<LeaveRoomResponse>(`/api/rooms/${encodeURIComponent(session.roomId)}/leave`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seatToken: session.seatToken }),
  });
}

export function connectToRoom(
  session: PlayerSession,
  onMessage: (message: AnyRoomServerMessage) => void,
): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL("/ws", `${protocol}//${window.location.host}`);
  url.searchParams.set("roomId", session.roomId);
  url.searchParams.set("seatToken", session.seatToken);

  url.searchParams.set("transport", PLATFORM_ROOM_TRANSPORT);
  const decode = createPlatformRoomDecoder();
  const socket = new WebSocket(url);
  socket.addEventListener("message", (event) => {
    try { onMessage(decode(JSON.parse(String(event.data)) as PlatformWireMessage)); }
    catch (error) {
      if (!(error instanceof RoomBaselineError)) throw error;
      socket.close(4002, "Map snapshot required");
    }
  });
  return socket;
}

export async function returnToLobby(session: PlayerSession, matchId: string): Promise<AnyRoomView> {
  return request(`/api/rooms/${encodeURIComponent(session.roomId)}/return-to-lobby`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seatToken: session.seatToken, matchId }) });
}
