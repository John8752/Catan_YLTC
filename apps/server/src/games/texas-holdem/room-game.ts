import { randomInt, randomUUID } from "node:crypto";
import { shuffledByIndex } from "@catan/game-core/primitives";
import { createPoker, actPoker, nextPokerHand, freshDeck, PokerError, pokerStandings, validatePokerSettings, DEFAULT_POKER_SETTINGS, type Card, type PokerState, type PokerSettings } from "@catan/game-core/texas-holdem";
import { projectPoker, type PokerCommand, type PokerRoomView, type PokerSettlementV1 } from "@catan/protocol/texas-holdem";
import type { RoomBase } from "../../room-base.js";
import type { MatchRepository } from "../../database/match-repository.js";
import { RoomError } from "../../room-errors.js";
import type { PokerRoomRecord } from "./room-types.js";

interface Timer { key: string; deadlineAt: number; durationMs: number; handle: ReturnType<typeof setTimeout> }
export class PokerRoomGame {
  private timers = new Map<string, Timer>();
  repository: MatchRepository | null = null;
  onSettlementError: () => void = () => {};
  constructor(private find: (id: string) => PokerRoomRecord | undefined, private now: () => number, private notify: (room: PokerRoomRecord) => void,
    private deck: () => Card[] = () => shuffledByIndex(freshDeck(), randomInt)) {}
  create(base: RoomBase): PokerRoomRecord { return { ...base, gameId: "texas-holdem", settings: { ...DEFAULT_POKER_SETTINGS }, game: null }; }
  project(room: PokerRoomRecord, viewer: string): PokerRoomView {
    const timer = this.timers.get(room.id);
    return { id: room.id, revision: room.revision, matchId: room.matchId, gameId: room.gameId, hostPlayerId: room.hostPlayerId,
      members: room.members.map(({ id, name, color }) => ({ id, name, color, isHost: id === room.hostPlayerId })), settings: { ...room.settings },
      game: room.game ? projectPoker(room.game, viewer, timer ? { deadlineAt: timer.deadlineAt, durationMs: timer.durationMs, serverNow: this.now() } : null) : null };
  }
  settings(room: PokerRoomRecord, settings: PokerSettings) { this.translate(() => validatePokerSettings(settings)); room.settings = { ...settings }; }
  capacity() { return 9; }
  start(room: PokerRoomRecord) {
    if (room.members.length < 2 || room.members.length > 9) throw new RoomError("NOT_ENOUGH_PLAYERS", "德州扑克需要 2–9 人");
    const id = randomUUID(); const game = this.translate(() => createPoker(id, room.members.map(({ id, name }) => ({ id, name })), room.settings, this.deck()));
    room.matchId = id; room.startedAt = this.now(); room.game = game; this.sync(room);
  }
  reset(room: PokerRoomRecord) { this.cancel(room.id); room.game = null; room.matchId = null; room.startedAt = 0; room.appliedCommands.clear(); }
  command(room: PokerRoomRecord, playerId: string, commandId: string, c: PokerCommand): PokerRoomView {
    const s = room.game;
    if (!s) throw new RoomError("GAME_NOT_STARTED", "游戏尚未开始");
    if (c.matchId !== s.id) throw new RoomError("STALE_MATCH", "操作属于上一局，请刷新");
    const key = `${playerId}:${commandId}`;
    if (room.appliedCommands.has(key)) return this.project(room, playerId);
    if (c.expectedRevision !== s.revision || c.handNumber !== s.handNumber) throw new RoomError("STALE_REVISION", "牌桌已更新，请根据当前状态操作");
    if (c.action.type === "next-hand" && playerId !== room.hostPlayerId) throw new RoomError("ONLY_HOST_CAN_START", "只有房主可以提前发下一手");
    const next = this.translate(() => c.action.type === "next-hand" ? nextPokerHand(s, this.deck()) : actPoker(s, playerId, c.action));
    this.commit(room, next); room.appliedCommands.add(key); this.sync(room); this.notify(room); return this.project(room, playerId);
  }
  private commit(room: PokerRoomRecord, next: PokerState) {
    if (next.phase.kind === "finished" && room.game?.phase.kind !== "finished" && this.repository) {
      const data: PokerSettlementV1 = { mode: next.settings.mode, completedHands: next.handNumber, startingChips: next.settings.startingChips, standings: pokerStandings(next) };
      this.repository.save({ gameId: "texas-holdem", matchId: next.id, dataVersion: 1, startedAt: room.startedAt, finishedAt: this.now(), data },
        room.members.flatMap((m) => m.accountId === null ? [] : [{ accountId: m.accountId, playerId: m.id }]));
    }
    room.game = next; room.revision++;
  }
  private sync(room: PokerRoomRecord) {
    const s = room.game;
    if (!s || s.phase.kind === "finished") { this.cancel(room.id); return; }
    const key = `${s.id}:${s.handNumber}:${s.revision}`;
    if (this.timers.get(room.id)?.key === key) return;
    this.cancel(room.id);
    const durationMs = s.phase.kind === "hand-over" ? 6000 : room.settings.actionSeconds * 1000;
    const handle = setTimeout(() => {
      const live = this.find(room.id);
      if (!live || live.game !== s || this.timers.get(room.id)?.handle !== handle) return;
      this.timers.delete(room.id);
      try {
        const phase = s.phase;
        const next = phase.kind === "hand-over" ? nextPokerHand(s, this.deck()) : phase.kind === "betting" ? actPoker(s, phase.actorId, { type: s.players.find((p) => p.id === phase.actorId)!.streetBet === s.currentBet ? "check" : "fold" }) : s;
        this.commit(live, next);
      } catch { this.onSettlementError(); }
      this.sync(live); this.notify(live);
    }, durationMs);
    handle.unref?.(); this.timers.set(room.id, { key, handle, durationMs, deadlineAt: this.now() + durationMs });
  }
  private translate<T>(fn: () => T): T { try { return fn(); } catch (e) { if (e instanceof PokerError) throw new RoomError(e.code, e.message); throw e; } }
  cancel(id: string) { const timer = this.timers.get(id); if (timer) clearTimeout(timer.handle); this.timers.delete(id); }
  dispose() { for (const id of this.timers.keys()) this.cancel(id); }
}
