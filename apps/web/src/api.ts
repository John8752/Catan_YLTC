import { createPlatformRoomDecoder, MissingRoomMapError, ROOM_EVENT_TRANSPORT, type PlatformWireMessage } from "@catan/protocol";
import { accountHeaders } from "./auth-api.js";
import type {
  AiCommentaryMode,
  AiCommentaryResponse,
  ApiErrorResponse,
  GameCommand,
  GameCommandReply,
  GameHistoryPage,
  LeaveRoomResponse,
  RoomSession,
  AnyRoomServerMessage,
  RoomSettingsInput,
  RoomView,
  AnyRoomView,
  GameType,
} from "@catan/protocol";
import type { PlayerColor } from "@catan/game-core";
import { randomId } from "./lib/random-id.js";

export interface PlayerSession {
  readonly roomId: string;
  readonly playerId: string;
  readonly seatToken: string;
}

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
  const query = new URLSearchParams({ seatToken: session.seatToken, transport: ROOM_EVENT_TRANSPORT });
  if (afterRevision !== undefined) query.set("afterRevision", String(afterRevision));
  return request<AnyRoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}?${query}`);
}

export async function getRoomHistory(session: PlayerSession, gameId: string, beforeRevision: number): Promise<GameHistoryPage> {
  const query = new URLSearchParams({ seatToken: session.seatToken, gameId, beforeRevision: String(beforeRevision) });
  return request<GameHistoryPage>(`/api/rooms/${encodeURIComponent(session.roomId)}/history?${query}`);
}

export async function startRoom(session: PlayerSession): Promise<AnyRoomView> {
  return request<AnyRoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seatToken: session.seatToken }),
  });
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

export function connectToRoom(
  session: PlayerSession,
  onMessage: (message: AnyRoomServerMessage) => void,
): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL("/ws", `${protocol}//${window.location.host}`);
  url.searchParams.set("roomId", session.roomId);
  url.searchParams.set("seatToken", session.seatToken);

  url.searchParams.set("transport", ROOM_EVENT_TRANSPORT);
  const decode = createPlatformRoomDecoder();
  const socket = new WebSocket(url);
  socket.addEventListener("message", (event) => {
    try { onMessage(decode(JSON.parse(String(event.data)) as PlatformWireMessage)); }
    catch (error) {
      if (!(error instanceof MissingRoomMapError)) throw error;
      socket.close(4002, "Map snapshot required");
    }
  });
  return socket;
}

/**
 * A rejection the server explained. The code travels with the message because
 * the caller's recovery depends on it: a stale revision means this client's copy
 * of the room is behind and has to be refetched, while a rule rejection means the
 * copy was right and the move simply was not allowed.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", headers: { ...init?.headers, ...accountHeaders() } });

  if (!response.ok) {
    const payload = (await response.json()) as ApiErrorResponse;
    throw new ApiError(payload.error.code, payload.error.message);
  }

  return (await response.json()) as T;
}

export async function getCatanRoom(session: PlayerSession, afterRevision?: number): Promise<RoomView> {
  const room = await getRoom(session, afterRevision);
  if (room.gameId !== "catan") throw new ApiError("WRONG_GAME", "房间游戏不匹配");
  return room;
}
export async function returnToLobby(session: PlayerSession, matchId: string): Promise<AnyRoomView> {
  return request(`/api/rooms/${encodeURIComponent(session.roomId)}/return-to-lobby`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seatToken: session.seatToken, matchId }) });
}
