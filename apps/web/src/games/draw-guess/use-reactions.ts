import { useEffect, useRef, useState } from "react";
import type { DrawGuessPlayerCommand, PageReaction } from "@catan/game-core/draw-guess";
import type { AnyRoomView } from "@catan/protocol/platform";
import type { PlayerSession } from "../../room-session.js";
import { randomId } from "../../lib/random-id.js";
import { sendDrawCommand } from "./api.js";

interface Click { readonly id: string; readonly command: Extract<DrawGuessPlayerCommand, { type: "react" }> }
/** Mounted for the match, not an album: switching albums cannot drop queued clicks. */
export function useReactions(session: PlayerSession, matchId: string, onRoom: (room: AnyRoomView) => void) {
  const queue = useRef<Click[]>([]);
  const running = useRef(false), blocked = useRef(false), active = useRef(true);
  const callback = useRef(onRoom); callback.current = onRoom;
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function flush() {
    if (running.current || blocked.current || !active.current) return;
    running.current = true;
    try {
      while (active.current && queue.current.length > 0) {
        const click = queue.current[0]!;
        try {
          const room = await sendDrawCommand(session, click.id, click.command);
          if (!active.current) return;
          queue.current.shift(); setPending(queue.current.length); callback.current(room);
        } catch (reason) {
          if (active.current) {
            blocked.current = true;
            setError(`表态尚未确认，点击重试会保留原次数。${reason instanceof Error ? reason.message : "请检查网络。"}`);
          }
          return;
        }
      }
    } finally { running.current = false; }
  }
  function react(albumOwnerId: string, step: number, reaction: PageReaction) {
    queue.current.push({ id: randomId(), command: { type: "react", matchId, albumOwnerId, step, reaction } });
    setPending(queue.current.length); void flush();
  }
  function retry() { blocked.current = false; setError(null); void flush(); }
  return { react, retry, pending, error };
}
