import type { AnyRoomView, GameType } from "@catan/protocol/platform";
import type { PlayerSession } from "./room-session.js";

export const ROOM_SNAPSHOT_WAIT_MS = 1_500;
export class RoomSessionChangedError extends Error {
  constructor() { super("房间登录状态已变更"); }
}

/** Optional game-owned snapshot reconciliation. The platform never inspects game details. */
export interface RoomUpdatePolicy {
  isUpgrade(room: AnyRoomView, previous: AnyRoomView | null): boolean;
  merge(room: AnyRoomView, previous: AnyRoomView | null): AnyRoomView;
  reset(): void;
}
export type RoomPolicyFactory = (gameId: GameType, updates: RoomUpdates) => RoomUpdatePolicy | null;

/** Credentials and room revisions scope every HTTP/WS snapshot before publication. */
export class RoomUpdates {
  private current: AnyRoomView | null = null;
  private readonly listeners = new Set<() => void>();
  private policy: RoomUpdatePolicy | null = null;
  get snapshot(): AnyRoomView | null { return this.current; }
  get gamePolicy(): RoomUpdatePolicy | null { return this.policy; }
  constructor(private session: PlayerSession | null, private readonly publish: (room: AnyRoomView | null) => void,
    private readonly createPolicy: RoomPolicyFactory = () => null) {}

  reset(session: PlayerSession | null): void {
    if (session !== null && this.belongsTo(session)) return;
    this.session = session;
    this.current = null;
    this.policy?.reset(); this.policy = null;
    this.publish(null);
    this.notify();
  }
  belongsTo(session: PlayerSession): boolean {
    return this.session?.seatToken === session.seatToken && this.session.roomId === session.roomId && this.session.playerId === session.playerId;
  }
  accept(room: AnyRoomView, session: PlayerSession): boolean {
    if (!this.belongsTo(session) || room.id !== session.roomId || (room.game !== null && room.game.you.id !== session.playerId)) return false;
    if (this.current && room.gameId !== this.current.gameId) return false;
    if (!this.current) this.policy = this.createPolicy(room.gameId, this);
    const upgrade = this.policy?.isUpgrade(room, this.current) ?? false;
    if (this.current && (room.revision < this.current.revision || (room.revision === this.current.revision && !upgrade))) return false;
    this.current = this.policy?.merge(room, this.current) ?? room;
    this.publish(this.current);
    this.notify();
    return true;
  }
  /** A game-owned derived update may replace only the exact snapshot it read. */
  replaceDerived(previous: AnyRoomView, room: AnyRoomView): boolean {
    if (this.current !== previous || room.id !== previous.id || room.revision !== previous.revision || room.matchId !== previous.matchId || room.gameId !== previous.gameId) return false;
    this.current = room; this.publish(room);
    return true;
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private notify(): void { for (const listener of this.listeners) listener(); }
}
