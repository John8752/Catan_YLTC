import type {
  ApiErrorResponse,
  GameCommand,
  GameCommandResponse,
  LeaveRoomResponse,
  PlayerSessionResponse,
  RoomServerMessage,
  RoomSettingsView,
  RoomView,
} from "@catan/protocol";

export interface PlayerSession {
  readonly roomId: string;
  readonly playerId: string;
  readonly seatToken: string;
}

export async function createRoom(playerName: string): Promise<PlayerSessionResponse> {
  return request<PlayerSessionResponse>("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerName }),
  });
}

export async function joinRoom(roomId: string, playerName: string): Promise<PlayerSessionResponse> {
  return request<PlayerSessionResponse>(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerName }),
  });
}

export async function getRoom(session: PlayerSession): Promise<RoomView> {
  const query = new URLSearchParams({ seatToken: session.seatToken });
  return request<RoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}?${query}`);
}

export async function startRoom(session: PlayerSession): Promise<RoomView> {
  return request<RoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seatToken: session.seatToken }),
  });
}

export async function updateRoomSettings(
  session: PlayerSession,
  expectedRevision: number,
  settings: Pick<RoomSettingsView, "ruleProfile" | "playerLimit" | "victoryPointsToWin">,
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
): Promise<GameCommandResponse> {
  return request<GameCommandResponse>(`/api/rooms/${encodeURIComponent(session.roomId)}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      seatToken: session.seatToken,
      commandId: crypto.randomUUID(),
      expectedRevision,
      command,
    }),
  });
}

export function connectToRoom(
  session: PlayerSession,
  onMessage: (message: RoomServerMessage) => void,
): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL("/ws", `${protocol}//${window.location.host}`);
  url.searchParams.set("roomId", session.roomId);
  url.searchParams.set("seatToken", session.seatToken);

  const socket = new WebSocket(url);
  socket.addEventListener("message", (event) => {
    onMessage(JSON.parse(String(event.data)) as RoomServerMessage);
  });
  return socket;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const payload = (await response.json()) as ApiErrorResponse;
    throw new Error(payload.error.message);
  }

  return (await response.json()) as T;
}
