import { createGame, DEFAULT_VICTORY_POINTS_TO_WIN, executeGameCommand, getRuleProfileDefinition, MIN_VICTORY_POINTS_TO_WIN, MAX_VICTORY_POINTS_TO_WIN, type GameCommand, type PlayableRuleProfile } from "@catan/game-core/catan";
import { collectVictoryWarnings, type GameCommandReply, type RoomView } from "@catan/protocol";
import { randomUUID } from "node:crypto";
import type { AnyRoomRecord, RoomBase, RoomRecord } from "../../room-types.js";
import type { MatchRepository } from "../../database/match-repository.js";
import type { AiCommentator } from "../../ai-commentary.js";
import { RoomSetupAnalysis } from "../../room-setup-analysis.js";
import { TurnTimerManager, type TurnTimerExpiry } from "../../turn-timer.js";
import { projectRoomView } from "../../project-room.js";
import { prepareSettlement } from "../../settlements.js";
import { RoomError } from "../../room-errors.js";

export class CatanRoomGame {
  private readonly timers: TurnTimerManager;
  private readonly analysis: RoomSetupAnalysis;
  repository: MatchRepository | null = null;
  onSettlementError: () => void = () => {};
  constructor(private readonly rooms: Map<string, AnyRoomRecord>, private readonly now: () => number,
    private readonly notify: (room: RoomRecord) => void, ai: AiCommentator | null) {
    this.timers = new TurnTimerManager(now);
    this.analysis = new RoomSetupAnalysis(rooms, ai, (room, id) => this.project(room, id), notify);
  }
  create(base: RoomBase): RoomRecord {
    return { ...base, gameId: "catan", settings: { ruleProfile: "base-3-4", victoryPointsToWin: DEFAULT_VICTORY_POINTS_TO_WIN, bankCountsPublic: true }, game: null,
      history: [], victoryWarnings: [], publicSetupAnalysis: null, tableIntentTurns: new Map() };
  }
  configureAi(ai: AiCommentator | null) { this.analysis.configure(ai); }
  project(room: RoomRecord, viewerId: string, after?: number | null): RoomView { return projectRoomView(room, viewerId, this.timers.view(room.id), after); }
  capacity(room: RoomRecord): number { return getRuleProfileDefinition(room.settings.ruleProfile).maxPlayers; }
  start(room: RoomRecord) {
    if (room.members.length < getRuleProfileDefinition(room.settings.ruleProfile).minPlayers) throw new RoomError("NOT_ENOUGH_PLAYERS", "玩家人数不足");
    const matchId = randomUUID();
    const game = createGame({ id: matchId, seed: room.seed, players: room.members.map(({ id, name, color }) => ({ id, name, color })),
      victoryPointsToWin: room.settings.victoryPointsToWin, ruleProfile: room.settings.ruleProfile });
    room.matchId = matchId; room.startedAt = this.now(); room.game = game;
    this.sync(room);
  }
  reset(room: RoomRecord) {
    this.cancel(room.id); room.game = null; room.matchId = null; room.startedAt = 0; room.appliedCommands.clear();
    room.history.length = 0; room.victoryWarnings.length = 0; room.publicSetupAnalysis = null; room.tableIntentTurns.clear();
  }
  settings(room: RoomRecord, settings: { readonly ruleProfile: PlayableRuleProfile; readonly victoryPointsToWin: number; readonly bankCountsPublic?: boolean | undefined }) {
    const profile = getRuleProfileDefinition(settings.ruleProfile);
    if (!Number.isInteger(settings.victoryPointsToWin) || settings.victoryPointsToWin < MIN_VICTORY_POINTS_TO_WIN || settings.victoryPointsToWin > MAX_VICTORY_POINTS_TO_WIN) throw new RoomError("INVALID_ROOM_SETTINGS", `胜利目标须为 ${MIN_VICTORY_POINTS_TO_WIN}–${MAX_VICTORY_POINTS_TO_WIN} 分`);
    if (profile.maxPlayers < room.members.length) throw new RoomError("ROOM_CAPACITY_TOO_SMALL", "已入座人数超过此规则的人数上限");
    room.settings = { ruleProfile: settings.ruleProfile, victoryPointsToWin: settings.victoryPointsToWin, bankCountsPublic: settings.bankCountsPublic ?? room.settings.bankCountsPublic };
  }
  command(room: RoomRecord, playerId: string, commandId: string, expectedRevision: number, command: GameCommand, responseMode?: "ack", matchId?: string): GameCommandReply {
    if (!room.game) throw new RoomError("GAME_NOT_STARTED", "游戏尚未开始");
    if ((matchId !== undefined && matchId !== room.matchId) || (matchId === undefined && room.matchesStarted > 1)) throw new RoomError("STALE_MATCH", "操作属于上一局或旧客户端，请刷新");
    const response = (): GameCommandReply => responseMode === "ack"
      ? { commandId, roomId: room.id, matchId: room.matchId!, roomRevision: room.revision, gameRevision: room.game!.revision }
      : { commandId, room: this.project(room, playerId) };
    const key = `${playerId}:${commandId}`;
    if (room.appliedCommands.has(key)) return response();
    if (room.game.revision !== expectedRevision) throw new RoomError("STALE_REVISION", "游戏状态已更新，请重试");
    const result = executeGameCommand(room.game, playerId, command);
    if (!result.accepted) throw new RoomError(result.error.code, result.error.message);
    if (result.state.revision === room.game.revision && result.events.length === 0) { room.appliedCommands.add(key); return response(); }
    const settlement = prepareSettlement(room, result.state, result.events, this.now());
    if (settlement && this.repository) this.repository.save(settlement.record, settlement.participants);
    room.victoryWarnings.push(...collectVictoryWarnings(room.game, result.state, room.victoryWarnings));
    room.game = result.state; room.history.push(...result.events.map((event) => ({ revision: result.state.revision, event })));
    room.revision++; room.appliedCommands.add(key);
    if (result.events.some((event) => event.type === "setup_completed")) this.analysis.start(room);
    this.sync(room); const reply = response(); this.notify(room); return reply;
  }
  private sync(room: RoomRecord) {
    if (!room.game) { this.timers.clear(room.id); return; }
    const matchId = room.matchId;
    this.timers.sync(room.id, room.game, (expiry) => this.expire(room.id, matchId, expiry));
  }
  private expire(roomId: string, matchId: string | null, expiry: TurnTimerExpiry) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameId !== "catan" || !room.game || room.matchId !== matchId) return;
    const result = executeGameCommand(room.game, expiry.playerId, expiry.command);
    if (!result.accepted) { this.sync(room); return; }
    const settlement = prepareSettlement(room, result.state, result.events, this.now());
    try { if (settlement && this.repository) this.repository.save(settlement.record, settlement.participants); }
    catch { this.onSettlementError(); this.sync(room); this.notify(room); return; }
    room.victoryWarnings.push(...collectVictoryWarnings(room.game, result.state, room.victoryWarnings));
    room.game = result.state; room.history.push(...result.events.map((event) => ({ revision: result.state.revision, event })));
    room.revision++; this.sync(room); this.notify(room);
  }
  cancel(roomId: string) { this.timers.clear(roomId); this.analysis.cancel(roomId); }
  dispose() { this.timers.dispose(); this.analysis.dispose(); }
}
