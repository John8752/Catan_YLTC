import { useEffect, useRef, useState } from "react";
import type { RoomView } from "@catan/protocol";
import { getRoomHistory, type PlayerSession } from "../api.js";
import { RoomSessionChangedError, type RoomUpdates } from "../room-updates.js";

export function useRoomHistory(session: PlayerSession | null, room: RoomView | null, updates: RoomUpdates) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<symbol | null>(null);
  const scope = useRef(session);
  scope.current = session;
  useEffect(() => { pending.current = null; setBusy(false); setError(null); }, [session]);
  async function loadEarlier() {
    if (!session || pending.current !== null) return;
    const request = Symbol(); pending.current = request; setBusy(true); setError(null);
    try {
      do {
        await updates.loadEarlierHistory(session, (gameId, before) => getRoomHistory(session, gameId, before));
      } while (updates.belongsTo(session) && updates.hasHistoryGap);
    } catch (caught) {
      if (!(caught instanceof RoomSessionChangedError) && scope.current === session) setError("较早记录加载失败，请重试");
    } finally {
      if (pending.current === request) { pending.current = null; setBusy(false); }
    }
  }
  useEffect(() => {
    if (updates.hasHistoryGap && !busy && !error) void loadEarlier();
  }, [room, busy, error, session]);
  return { historyLoading: busy, historyError: error, historyHasGap: updates.hasHistoryGap, onLoadEarlierHistory: loadEarlier };
}
