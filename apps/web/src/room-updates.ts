import type { GameCommandAck, GameCommandReply, RoomView } from "@catan/protocol";
import type { PlayerSession } from "./api.js";

export const ROOM_SNAPSHOT_WAIT_MS = 1_500;
export class RoomSessionChangedError extends Error {
  constructor() { super("房间登录状态已变更"); }
}

/** All HTTP/WS snapshots pass here before rendering. Credentials scope every asynchronous read. */
export class RoomUpdates {
  private current: RoomView | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(private session: PlayerSession | null, private readonly publish: (room: RoomView | null) => void) {}

  reset(session: PlayerSession | null): void {
    if (session !== null && this.belongsTo(session)) return;
    this.session = session;
    this.current = null;
    this.publish(null);
    this.notify();
  }

  belongsTo(session: PlayerSession): boolean {
    return this.session?.seatToken === session.seatToken && this.session.roomId === session.roomId && this.session.playerId === session.playerId;
  }

  accept(room: RoomView, session: PlayerSession): boolean {
    if (!this.belongsTo(session) || room.id !== session.roomId || (room.game !== null && room.game.you.id !== session.playerId)) return false;
    // Room metadata (including AI completion) can advance without a game revision.
    if (this.current !== null && room.revision <= this.current.revision) return false;
    this.current = room;
    this.publish(room);
    this.notify();
    return true;
  }

  async confirm(reply: GameCommandReply, session: PlayerSession, read: () => Promise<RoomView>, connected: boolean): Promise<void> {
    if (!this.belongsTo(session)) throw new RoomSessionChangedError();
    if ("room" in reply) { this.accept(reply.room, session); return; } // Older server during deployment.
    if (reply.roomId !== session.roomId) throw new Error("操作确认的房间不匹配");
    if (this.hasRevision(reply)) return; // Push often arrives before the HTTP acknowledgement.
    if (connected) {
      await new Promise<void>((resolve) => {
        const finish = () => { clearTimeout(timer); this.listeners.delete(changed); resolve(); };
        const changed = () => { if (!this.belongsTo(session) || this.hasRevision(reply)) finish(); };
        const timer = setTimeout(finish, ROOM_SNAPSHOT_WAIT_MS);
        this.listeners.add(changed);
      });
    }
    if (!this.belongsTo(session)) throw new RoomSessionChangedError();
    if (this.hasRevision(reply)) return;
    // A missing push must not strand the UI, or cause an already accepted command to be sent twice.
    const snapshot = await read();
    if (!this.belongsTo(session)) throw new RoomSessionChangedError();
    this.accept(snapshot, session);
    if (!this.hasRevision(reply)) throw new Error("操作已提交，正在等待最新状态，请稍后刷新");
  }

  private hasRevision(ack: GameCommandAck): boolean {
    return this.current !== null && this.current.revision >= ack.roomRevision &&
      this.current.game !== null && this.current.game.revision >= ack.gameRevision;
  }
  private notify(): void { for (const listener of this.listeners) listener(); }
}
