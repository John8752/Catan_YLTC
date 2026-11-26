import type { AnyRoomView, RoomCommandAck } from "@catan/protocol/platform";
import { getRoom } from "../api.js";
import type { PlayerSession } from "../room-session.js";
import { RoomUpdates, RoomSessionChangedError, ROOM_SNAPSHOT_WAIT_MS } from "../room-updates.js";

interface Confirmation {
  readonly gameId: RoomCommandAck["gameId"]; readonly matchId: string; readonly commandId: string; readonly connected: boolean;
  readonly read?: () => Promise<AnyRoomView>;
}
/** Confirm an accepted command without resending it when its push is lost. */
export async function confirmRoomCommand(updates: RoomUpdates, session: PlayerSession, reply: RoomCommandAck, options: Confirmation): Promise<void> {
  function checkScope() {
    if (!updates.belongsTo(session)) throw new RoomSessionChangedError();
    const room = updates.snapshot;
    if (room && (room.gameId !== options.gameId || room.matchId !== options.matchId)) throw new RoomSessionChangedError();
  }
  checkScope();
  if (reply.type !== "command_ack" || reply.roomId !== session.roomId || reply.gameId !== options.gameId || reply.matchId !== options.matchId || reply.commandId !== options.commandId) throw new Error("操作确认不匹配");
  const hasRevision = () => {
    const room = updates.snapshot;
    return room?.gameId === reply.gameId && room.matchId === reply.matchId && room.revision >= reply.roomRevision && room.game !== null && room.game.revision >= reply.gameRevision &&
      (reply.handNumber === undefined || (room.gameId === "texas-holdem" && room.game.handNumber >= reply.handNumber));
  };
  if (hasRevision()) return;
  if (options.connected) await new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); unsubscribe(); resolve(); };
    const timer = setTimeout(finish, ROOM_SNAPSHOT_WAIT_MS);
    const unsubscribe = updates.subscribe(() => {
      const room = updates.snapshot;
      if (!updates.belongsTo(session) || room?.matchId !== options.matchId || hasRevision()) finish();
    });
  });
  checkScope();
  if (hasRevision()) return;
  const room = await (options.read ?? (() => getRoom(session)))();
  checkScope();
  if (room.gameId !== options.gameId || room.matchId !== options.matchId) throw new RoomSessionChangedError();
  updates.accept(room, session);
  if (!hasRevision()) throw new Error("操作已提交，正在等待最新状态，请稍后刷新");
}
