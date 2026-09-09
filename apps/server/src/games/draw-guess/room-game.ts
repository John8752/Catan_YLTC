import { randomUUID } from "node:crypto";
import { createDrawGuess, executeDrawGuess, type DrawGuessPlayerCommand, type DrawGuessState } from "@catan/game-core/draw-guess";
import { DEFAULT_DRAW_GUESS_SETTINGS, projectDrawGuess, type DrawGuessRoomView, type DrawGuessSettings, type DrawGuessSettlementV1 } from "@catan/protocol/draw-guess";
import type { AnyRoomRecord, DrawRoomRecord, RoomBase } from "../../room-types.js";
import type { MatchRepository } from "../../database/match-repository.js";
import { RoomError } from "../../room-errors.js";

interface Deadline { readonly matchId: string; readonly step: number; readonly deadlineAt: number; readonly durationMs: number; readonly handle: ReturnType<typeof setTimeout> }
export class DrawGuessRoomGame {
  private readonly timers = new Map<string, Deadline>();
  repository: MatchRepository | null = null;
  constructor(private readonly rooms: Map<string, AnyRoomRecord>, private readonly now: () => number, private readonly notify: (room: DrawRoomRecord) => void) {}
  create(base: RoomBase): DrawRoomRecord { return { ...base, gameId: "draw-guess", settings: { ...DEFAULT_DRAW_GUESS_SETTINGS }, game: null }; }
  project(room: DrawRoomRecord, viewerId: string): DrawGuessRoomView {
    const timer = this.timers.get(room.id);
    return { id: room.id, gameId: room.gameId, matchId: room.matchId, revision: room.revision, hostPlayerId: room.hostPlayerId,
      members: room.members.map(({ id, name, color }) => ({ id, name, color, isHost: id === room.hostPlayerId })), settings: { ...room.settings },
      game: room.game ? projectDrawGuess(room.game, viewerId, timer ? { deadlineAt: timer.deadlineAt, durationMs: timer.durationMs, serverNow: this.now() } : null) : null };
  }
  start(room: DrawRoomRecord) {
    if (room.members.length < 3 || room.members.length > 6) throw new RoomError("NOT_ENOUGH_PLAYERS", "传画猜词需要 3–6 人");
    const matchId = randomUUID(); const game = createDrawGuess(matchId, room.members.map(({ id, name }) => ({ id, name })), room.seed);
    room.matchId = matchId; room.startedAt = this.now(); room.game = game; this.sync(room);
  }
  reset(room: DrawRoomRecord) { this.cancel(room.id); room.game = null; room.matchId = null; room.startedAt = 0; room.appliedCommands.clear(); }
  settings(room: DrawRoomRecord, settings: DrawGuessSettings) {
    if (![30, 60, 90].includes(settings.textSeconds) || ![60, 90, 120].includes(settings.drawingSeconds)) throw new RoomError("INVALID_ROOM_SETTINGS", "请选择支持的时长");
    room.settings = { ...settings };
  }
  command(room: DrawRoomRecord, playerId: string, commandId: string, command: DrawGuessPlayerCommand): DrawGuessRoomView {
    if (!room.game) throw new RoomError("GAME_NOT_STARTED", "游戏尚未开始");
    if (room.game.id !== command.matchId) throw new RoomError("STALE_MATCH", "操作属于上一局，请刷新");
    const key = `${playerId}:${commandId}`;
    if (command.type !== "draft" && room.appliedCommands.has(key)) return this.project(room, playerId);
    const next = executeDrawGuess(room.game, playerId, command, room.hostPlayerId);
    if (next === room.game) return this.project(room, playerId);
    this.settle(room, next);
    room.game = next; room.revision++;
    if (command.type !== "draft") room.appliedCommands.add(key);
    this.sync(room);
    // Draft content stays private. Checkpoints do not trigger noisy table-wide pushes.
    if (command.type !== "draft") this.notify(room);
    return this.project(room, playerId);
  }
  private settle(room: DrawRoomRecord, next: DrawGuessState) {
    if (next.phase.kind !== "finished" || room.game?.phase.kind === "finished" || !this.repository) return;
    const pages = next.albums.flatMap((album) => album.pages);
    const data: DrawGuessSettlementV1 = { playerCount: next.players.length, albumCount: next.albums.length,
      players: next.players.map(({ id, name }) => ({ id, name, submittedPages: pages.filter((p) => p.authorId === id && !p.timedOut).length, timedOutPages: pages.filter((p) => p.authorId === id && p.timedOut).length })) };
    this.repository.save({ gameId: "draw-guess", matchId: next.id, dataVersion: 1, startedAt: room.startedAt, finishedAt: this.now(), data },
      room.members.flatMap((m) => m.accountId === null ? [] : [{ accountId: m.accountId, playerId: m.id }]));
  }
  private sync(room: DrawRoomRecord) {
    const game = room.game;
    if (!game || game.phase.kind !== "work") { this.cancel(room.id); return; }
    const { step } = game.phase;
    const current = this.timers.get(room.id);
    if (current?.matchId === game.id && current.step === step) return;
    this.cancel(room.id);
    const durationMs = (step % 2 ? room.settings.drawingSeconds : room.settings.textSeconds) * 1000;
    const deadlineAt = this.now() + durationMs;
    const matchId = game.id;
    const handle = setTimeout(() => {
      const live = this.rooms.get(room.id); const timer = this.timers.get(room.id);
      if (!live || live.gameId !== "draw-guess" || !live.game || live.game.id !== matchId || live.game.phase.kind !== "work" || live.game.phase.step !== step || timer?.handle !== handle) return;
      this.timers.delete(room.id);
      live.game = executeDrawGuess(live.game, null, { type: "expire", matchId, step }); live.revision++;
      this.sync(live); this.notify(live);
    }, durationMs);
    handle.unref?.(); this.timers.set(room.id, { matchId, step, deadlineAt, durationMs, handle });
  }
  cancel(roomId: string) { const timer = this.timers.get(roomId); if (timer) clearTimeout(timer.handle); this.timers.delete(roomId); }
  dispose() { for (const id of this.timers.keys()) this.cancel(id); }
}
