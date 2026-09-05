import type { GameCommandAck, GameCommandReply, RoomView, GameHistoryPage, IndexedHistoryEntry } from "@catan/protocol";
import type { PlayerSession } from "./api.js";
import { HistoryBuffer } from "./history-buffer.js";

export const ROOM_SNAPSHOT_WAIT_MS = 1_500;
export class RoomSessionChangedError extends Error {
  constructor() { super("房间登录状态已变更"); }
}

/** All HTTP/WS snapshots pass here before rendering. Credentials scope every asynchronous read. */
export class RoomUpdates {
  private current: RoomView | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly history = new HistoryBuffer();
  get hasHistoryGap(): boolean { return this.history.hasGap; }
  constructor(private session: PlayerSession | null, private readonly publish: (room: RoomView | null) => void) {}

  reset(session: PlayerSession | null): void {
    if (session !== null && this.belongsTo(session)) return;
    this.session = session;
    this.current = null;
    this.history.clear();
    this.publish(null);
    this.notify();
  }

  belongsTo(session: PlayerSession): boolean {
    return this.session?.seatToken === session.seatToken && this.session.roomId === session.roomId && this.session.playerId === session.playerId;
  }

  accept(room: RoomView, session: PlayerSession): boolean {
    if (!this.belongsTo(session) || room.id !== session.roomId || (room.game !== null && room.game.you.id !== session.playerId)) return false;
    // Room metadata (including AI completion) can advance without a game revision.
    const upgrade = room.game?.historyRange !== undefined && this.current?.game?.historyRange === undefined;
    if (this.current !== null && (room.revision < this.current.revision || (room.revision === this.current.revision && !upgrade))) return false;
    if (room.game?.id !== this.current?.game?.id) this.history.clear();
    if (room.game?.historyRange) {
      this.history.add({ gameId: room.game.id, range: room.game.historyRange, entries: room.game.history as readonly IndexedHistoryEntry[] });
      const visible = this.history.hasGap && this.current?.game?.historyRange
        ? { entries: this.current.game.history, range: this.current.game.historyRange } : this.history.latest!;
      room = { ...room, game: { ...room.game, history: visible.entries, historyRange: visible.range } };
    }
    this.current = room;
    this.publish(room);
    this.notify();
    return true;
  }

  async loadEarlierHistory(session: PlayerSession, read: (gameId: string, beforeRevision: number) => Promise<GameHistoryPage>): Promise<void> {
    if (!this.belongsTo(session)) throw new RoomSessionChangedError();
    const latest = this.history.latest;
    if (!latest || latest.range.afterRevision === 0) return;
    const before = latest.range.afterRevision + 1;
    const page = await read(latest.gameId, before);
    if (!this.belongsTo(session) || this.current?.game?.id !== latest.gameId) throw new RoomSessionChangedError();
    if (page.gameId !== latest.gameId || page.range.throughRevision !== before - 1 || page.range.afterRevision >= before - 1) {
      throw new Error("记录加载范围无效，请重试");
    }
    this.history.add(page);
    if (!this.history.hasGap) this.current = { ...this.current, game: { ...this.current.game, history: this.history.latest!.entries, historyRange: this.history.latest!.range } };
    this.publish(this.current); // History cannot advance/replace dynamic game state or enqueue effects.
  }

  async confirm(reply: GameCommandReply, session: PlayerSession, read: (afterRevision?: number) => Promise<RoomView>, connected: boolean): Promise<void> {
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
    const snapshot = await read(this.current?.game?.revision);
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
