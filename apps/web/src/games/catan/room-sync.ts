import type { GameCommandAck, GameCommandReply, GameHistoryPage, IndexedHistoryEntry } from "@catan/protocol/catan";
import type { AnyRoomView } from "@catan/protocol/platform";
import type { PlayerSession } from "../../room-session.js";
import { RoomUpdates, RoomSessionChangedError, ROOM_SNAPSHOT_WAIT_MS, type RoomUpdatePolicy } from "../../room-updates.js";
import { HistoryBuffer } from "./history-buffer.js";

export class CatanRoomSync implements RoomUpdatePolicy {
  private readonly history = new HistoryBuffer();
  constructor(private readonly updates: RoomUpdates) {}
  get hasHistoryGap(): boolean { return this.history.hasGap; }
  private get current() { return this.updates.snapshot; }
  belongsTo(session: PlayerSession) { return this.updates.belongsTo(session); }
  reset() { this.history.clear(); }
  isUpgrade(room: AnyRoomView, previous: AnyRoomView | null): boolean {
    return room.gameId === "catan" && room.game?.historyRange !== undefined &&
      (previous?.gameId !== "catan" || previous.game?.historyRange === undefined);
  }
  merge(room: AnyRoomView, previous: AnyRoomView | null): AnyRoomView {
    const previousGame = previous?.gameId === "catan" ? previous.game : null;
    if (room.game?.id !== previous?.game?.id) this.history.clear();
    if (room.gameId === "catan" && room.game?.historyRange) {
      this.history.add({ gameId: room.game.id, range: room.game.historyRange, entries: room.game.history as readonly IndexedHistoryEntry[] });
      const visible = this.history.hasGap && previousGame?.historyRange
        ? { entries: previousGame.history, range: previousGame.historyRange } : this.history.latest!;
      room = { ...room, game: { ...room.game, history: visible.entries, historyRange: visible.range } };
    }
    return room;
  }
  async loadEarlierHistory(session: PlayerSession, read: (gameId: string, beforeRevision: number) => Promise<GameHistoryPage>): Promise<void> {
    if (!this.belongsTo(session)) throw new RoomSessionChangedError();
    const latest = this.history.latest;
    if (!latest || latest.range.afterRevision === 0) return;
    const before = latest.range.afterRevision + 1;
    const page = await read(latest.gameId, before);
    if (!this.belongsTo(session) || this.current?.gameId !== "catan" || this.current.game?.id !== latest.gameId) throw new RoomSessionChangedError();
    if (page.gameId !== latest.gameId || page.range.throughRevision !== before - 1 || page.range.afterRevision >= before - 1) {
      throw new Error("记录加载范围无效，请重试");
    }
    this.history.add(page);
    const current = this.current;
    this.updates.replaceDerived(current, !this.history.hasGap
      ? { ...current, game: { ...current.game!, history: this.history.latest!.entries, historyRange: this.history.latest!.range } }
      : current); // History cannot advance dynamic game state or enqueue effects.
  }

  async confirm(reply: GameCommandReply, session: PlayerSession, read: (afterRevision?: number) => Promise<AnyRoomView>, connected: boolean): Promise<void> {
    if (!this.belongsTo(session)) throw new RoomSessionChangedError();
    if ("room" in reply) { this.updates.accept(reply.room, session); return; } // Older server during deployment.
    if (reply.roomId !== session.roomId) throw new Error("操作确认的房间不匹配");
    if (this.hasRevision(reply)) return; // Push often arrives before the HTTP acknowledgement.
    if (connected) {
      await new Promise<void>((resolve) => {
        const finish = () => { clearTimeout(timer); unsubscribe(); resolve(); };
        const changed = () => { if (!this.belongsTo(session) || this.hasRevision(reply)) finish(); };
        const timer = setTimeout(finish, ROOM_SNAPSHOT_WAIT_MS);
        const unsubscribe = this.updates.subscribe(changed);
      });
    }
    if (!this.belongsTo(session)) throw new RoomSessionChangedError();
    if (this.hasRevision(reply)) return;
    // A missing push must not strand the UI, or cause an already accepted command to be sent twice.
    const snapshot = await read(this.current?.game?.revision);
    if (!this.belongsTo(session)) throw new RoomSessionChangedError();
    this.updates.accept(snapshot, session);
    if (!this.hasRevision(reply)) throw new Error("操作已提交，正在等待最新状态，请稍后刷新");
  }

  private hasRevision(ack: GameCommandAck): boolean {
    return this.current !== null && this.current.revision >= ack.roomRevision &&
      (ack.matchId === undefined || ack.matchId === this.current.matchId) &&
      this.current.game !== null && this.current.game.revision >= ack.gameRevision;
  }
}

export function getCatanSync(updates: RoomUpdates): CatanRoomSync {
  if (!(updates.gamePolicy instanceof CatanRoomSync)) throw new Error("Catan synchronization requires a Catan snapshot");
  return updates.gamePolicy;
}
