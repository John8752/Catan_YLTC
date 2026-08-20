import type {
  ApiErrorResponse,
  GameCommand,
  GameCommandResponse,
  PlayerSessionResponse,
  RoomServerMessage,
  RoomView,
} from "@catan/protocol";

export interface PlayerSession {
  readonly roomId: string;
  readonly playerId: string;
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
  const query = new URLSearchParams({ playerId: session.playerId });
  return request<RoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}?${query}`);
}

export async function startRoom(session: PlayerSession): Promise<RoomView> {
  return request<RoomView>(`/api/rooms/${encodeURIComponent(session.roomId)}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: session.playerId }),
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
      playerId: session.playerId,
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
  url.searchParams.set("playerId", session.playerId);

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
