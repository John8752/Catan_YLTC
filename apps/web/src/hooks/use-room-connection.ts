import { useEffect, useRef, useState } from "react";
import { connectToRoom, getRoom, type PlayerSession } from "../api.js";
import { ROOM_SNAPSHOT_WAIT_MS, type RoomUpdates } from "../room-updates.js";

interface Callbacks {
  readonly onSynced: () => void;
  readonly onError: (error: unknown) => void;
  readonly onClosed: (reason: "room_closed" | "account_session_replaced", message: string) => void;
  readonly onInvalidSeat: (message: string) => void;
}

export function useRoomConnection(session: PlayerSession | null, enabled: boolean, updates: RoomUpdates, callbacks: Callbacks) {
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "offline">("offline");
  const [snapshotEpoch, setSnapshotEpoch] = useState(0);
  const handlers = useRef(callbacks);
  handlers.current = callbacks;
  useEffect(() => {
    if (!enabled || session === null) { setConnectionState("offline"); return; }
    let active = true;
    let receivedSnapshot = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    // Normal initialization uses the socket's mandatory snapshot; HTTP is only a fallback.
    const fallback = setTimeout(() => {
      if (!active || receivedSnapshot) return;
      void getRoom(session).then((room) => {
        if (!active || receivedSnapshot || !updates.belongsTo(session)) return;
        setSnapshotEpoch((epoch) => epoch + 1);
        updates.accept(room, session);
      }).catch((error: unknown) => active && handlers.current.onError(error));
    }, ROOM_SNAPSHOT_WAIT_MS);

    const openSocket = () => {
      if (!active) return;
      setConnectionState("connecting");
      let initialSnapshot = true;
      socket = connectToRoom(session, (message) => {
        if (!active || !updates.belongsTo(session)) return;
        if (message.type === "room_state") {
          receivedSnapshot = true;
          clearTimeout(fallback);
          if (initialSnapshot) { setSnapshotEpoch((epoch) => epoch + 1); initialSnapshot = false; }
          updates.accept(message.room, session);
          handlers.current.onSynced();
        } else if (message.type === "room_closed" || message.type === "account_session_replaced") {
          active = false;
          handlers.current.onClosed(message.type, message.message);
        } else if (message.code === "PLAYER_NOT_FOUND" || message.code === "ROOM_NOT_FOUND") {
          active = false;
          handlers.current.onInvalidSeat(message.message);
        } else handlers.current.onError(new Error(message.message));
      });
      socket.addEventListener("open", () => active && setConnectionState("live"));
      socket.addEventListener("close", () => {
        if (!active) return;
        setConnectionState("offline");
        reconnectTimer = setTimeout(openSocket, 1_000);
      });
    };
    openSocket();
    return () => {
      active = false;
      clearTimeout(fallback);
      clearTimeout(reconnectTimer);
      if (socket?.readyState === WebSocket.CONNECTING) socket.addEventListener("open", () => socket?.close(), { once: true });
      else socket?.close();
    };
  }, [session, enabled, updates]);
  return { connectionState, snapshotEpoch };
}
