import { randomBytes, randomInt } from "node:crypto";
import { PLAYER_COLORS, type PlayerColor } from "@catan/game-core/primitives";
import type { PlayableRuleProfile, GameCommand } from "@catan/game-core/catan";
import { projectHistoryPage, type AnyRoomView, type GameType, type RoomSession, type RoomView, type PlayerSessionResponse, type GameCommandResponse, type GameCommandReply, type GameHistoryPage, type LeaveRoomResponse } from "@catan/protocol";
import type { DrawGuessPlayerCommand } from "@catan/game-core/draw-guess";
import type { DrawGuessRoomView, DrawGuessSettings } from "@catan/protocol/draw-guess";
import type { AnyRoomRecord, RoomBase, RoomRecord, DrawRoomRecord, RoomListener, Subscription } from "./room-types.js";
import { AccountSeats } from "./account-seats.js";
import type { MatchRepository } from "./database/match-repository.js";
import type { AiCommentator } from "./ai-commentary.js";
import { normalizePlayerName, RoomError } from "./room-errors.js";
import { CatanRoomGame } from "./games/catan/room-game.js";
import { DrawGuessRoomGame } from "./games/draw-guess/room-game.js";

/** One authoritative directory and one seat/connection lifecycle for every game. */
export class RoomRegistry {
  private readonly rooms = new Map<string, AnyRoomRecord>();
  private readonly subscriptions = new Map<string, Set<Subscription>>();
  private readonly accountSeats = new AccountSeats(this.rooms, this.subscriptions, (room, id) => this.project(room, id));
  private accountIsActive: (accountId: string) => boolean = () => true;
  private readonly nextSeed: () => number;
  private readonly now: () => number;
  private readonly catan: CatanRoomGame;
  private readonly drawGuess: DrawGuessRoomGame;
  constructor(options: { readonly nextSeed?: () => number; readonly now?: () => number; readonly aiCommentator?: AiCommentator | null } = {}) {
    this.nextSeed = options.nextSeed ?? (() => randomInt(1, 2_147_483_647));
    this.now = options.now ?? Date.now;
    this.catan = new CatanRoomGame(this.rooms, this.now, (room) => this.notify(room), options.aiCommentator ?? null);
    this.drawGuess = new DrawGuessRoomGame(this.rooms, this.now, (room) => this.notify(room));
  }
  configureAiCommentator(ai: AiCommentator | null) { this.catan.configureAi(ai); }
  configureMatchRepository(repository: MatchRepository, onError: () => void = () => {}) { this.catan.repository = repository; this.catan.onSettlementError = onError; this.drawGuess.repository = repository; }
  configureAccountValidation(validate: (accountId: string) => boolean) { this.accountIsActive = validate; }
  accountSeat(accountId: string): RoomSession | null { return this.accountSeats.seat(accountId); }
  prepareAccountTakeover(accountId: string, guestSeat?: { readonly roomId: string; readonly seatToken: string }): () => void { return this.accountSeats.prepare(accountId, guestSeat); }

  createRoom(playerName: string, accountId?: null, gameId?: "catan"): PlayerSessionResponse;
  createRoom(playerName: string, accountId: string | null, gameId?: GameType): RoomSession;
  createRoom(playerName: string, accountId: string | null = null, gameId: GameType = "catan"): RoomSession {
    if (gameId !== "catan" && gameId !== "draw-guess") throw new RoomError("INVALID_REQUEST", "未知游戏");
    const existing = accountId === null ? null : this.accountSeat(accountId);
    if (existing) return existing;
    const name = normalizePlayerName(playerName);
    const roomId = this.createRoomId();
    const playerId = "player_" + randomBytes(16).toString("hex");
    const seatToken = randomBytes(24).toString("base64url");
    const base: RoomBase = { id: roomId, matchId: null, startedAt: 0, matchesStarted: 0, hostPlayerId: playerId, seed: this.createSeed(), revision: 1,
      members: [{ id: playerId, seatToken, accountId, name, color: PLAYER_COLORS[0] }], appliedCommands: new Set(), lastActiveAt: this.now() };
    const room = gameId === "catan" ? this.catan.create(base) : this.drawGuess.create(base);
    this.rooms.set(roomId, room);
    return { roomId, playerId, seatToken, room: this.project(room, playerId) };
  }
  joinRoom(roomId: string, playerName: string, accountId: string | null = null): RoomSession {
    const existing = accountId === null ? null : this.accountSeat(accountId);
    if (existing) return existing;
    const room = this.requireRoom(roomId); const name = normalizePlayerName(playerName);
    if (room.game !== null) throw new RoomError("ROOM_ALREADY_STARTED", "房间已开局");
    const cap = room.gameId === "catan" ? this.catan.capacity(room) : 6;
    if (room.members.length >= cap) throw new RoomError("ROOM_FULL", "房间已满");
    const color = PLAYER_COLORS.find((candidate) => !room.members.some((member) => member.color === candidate));
    if (!color) throw new RoomError("ROOM_FULL", "房间已满");
    const playerId = "player_" + randomBytes(16).toString("hex"); const seatToken = randomBytes(24).toString("base64url");
    room.members.push({ id: playerId, seatToken, accountId, name, color }); room.revision++; this.notify(room);
    return { roomId: room.id, playerId, seatToken, room: this.project(room, playerId) };
  }
  startRoom(roomId: string, seatToken: string): AnyRoomView {
    const room = this.requireRoom(roomId); const member = this.credential(room, seatToken);
    if (member.id !== room.hostPlayerId) throw new RoomError("ONLY_HOST_CAN_START", "只有房主可以开始游戏");
    if (room.game !== null) throw new RoomError("ROOM_ALREADY_STARTED", "房间已开局");
    // Finished rooms can coexist with a newer active seat. Never reactivate a linked account twice.
    for (const member of room.members) {
      const active = member.accountId === null ? null : this.accountSeat(member.accountId);
      if (active && active.roomId !== room.id) throw new RoomError("ACCOUNT_BUSY", "有玩家已在另一个房间，请先退出旧座位");
    }
    if (room.gameId === "catan") this.catan.start(room); else this.drawGuess.start(room);
    room.matchesStarted++;
    room.revision++; this.notify(room); return this.project(room, member.id);
  }
  returnToLobby(roomId: string, seatToken: string, matchId: string): AnyRoomView {
    const room = this.requireRoom(roomId); const member = this.credential(room, seatToken);
    if (member.id !== room.hostPlayerId) throw new RoomError("ONLY_HOST_CAN_CONFIGURE", "只有房主可以再来一局");
    if (room.matchId !== matchId || room.game?.phase.kind !== "finished") throw new RoomError("MATCH_NOT_FINISHED", "当前对局尚未结束或已更换");
    for (const seat of room.members) {
      const active = seat.accountId === null ? null : this.accountSeat(seat.accountId);
      if (active && active.roomId !== room.id) throw new RoomError("ACCOUNT_BUSY", "有玩家已在另一个房间，请先释放这个房间的座位");
    }
    if (room.gameId === "catan") this.catan.reset(room); else this.drawGuess.reset(room);
    for (const sub of this.subscriptions.get(room.id) ?? []) if (sub.eventAfterRevision !== undefined) sub.eventAfterRevision = null;
    room.seed = this.createSeed(room.seed); room.revision++; this.notify(room); return this.project(room, member.id);
  }
  updatePlayerColor(roomId: string, seatToken: string, revision: number, color: PlayerColor): AnyRoomView {
    const room = this.openLobby(roomId, seatToken, revision); const member = this.credential(room, seatToken);
    if (!PLAYER_COLORS.includes(color)) throw new RoomError("INVALID_REQUEST", "未知颜色");
    if (member.color === color) return this.project(room, member.id);
    if (room.members.some((m) => m.color === color)) throw new RoomError("PLAYER_COLOR_TAKEN", "这个颜色已经被其他玩家选择");
    member.color = color; room.revision++; this.notify(room); return this.project(room, member.id);
  }
  shuffleMembers(roomId: string, seatToken: string, revision: number): AnyRoomView {
    const room = this.openLobby(roomId, seatToken, revision); const member = this.credential(room, seatToken);
    if (member.id !== room.hostPlayerId) throw new RoomError("ONLY_HOST_CAN_SHUFFLE", "只有房主可以打乱玩家顺序");
    if (room.members.length < 2) return this.project(room, member.id);
    const previous = room.members.map((m) => m.id);
    for (let i = room.members.length - 1; i > 0; i--) { const j = randomInt(i + 1); [room.members[i], room.members[j]] = [room.members[j]!, room.members[i]!]; }
    if (room.members.every((m, i) => m.id === previous[i])) room.members.push(room.members.shift()!);
    room.revision++; this.notify(room); return this.project(room, member.id);
  }
  leaveRoom(roomId: string, seatToken: string): LeaveRoomResponse {
    const room = this.requireRoom(roomId); const member = this.credential(room, seatToken);
    if (room.game !== null && room.game.phase.kind !== "finished") throw new RoomError("CANNOT_LEAVE_STARTED_GAME", "对局中请保留座位，方便断线重连");
    room.members.splice(room.members.indexOf(member), 1);
    const subs = this.subscriptions.get(room.id);
    for (const sub of subs ?? []) if (sub.playerId === member.id) { subs!.delete(sub); sub.onClosed?.(); }
    if (subs?.size === 0) this.subscriptions.delete(room.id);
    if (room.members.length === 0) { this.remove(room); return { roomDeleted: true, newHostPlayerId: null }; }
    if (room.hostPlayerId === member.id) room.hostPlayerId = room.members[0]!.id;
    room.revision++; this.notify(room); return { roomDeleted: false, newHostPlayerId: room.hostPlayerId };
  }
  disbandRoom(roomId: string, seatToken: string) {
    const room = this.requireRoom(roomId); const member = this.credential(room, seatToken);
    if (member.id !== room.hostPlayerId) throw new RoomError("ONLY_HOST_CAN_DISBAND", "只有房主可以解散房间");
    for (const sub of this.subscriptions.get(room.id) ?? []) { try { sub.onClosed?.(); } catch { /* Other seats still close. */ } }
    this.remove(room);
  }
  getRoom(roomId: string, seatToken: string, after?: number | null): AnyRoomView {
    const room = this.requireRoom(roomId); const member = this.credential(room, seatToken);
    if (room.gameId === "catan" && after != null && (!room.game || after > room.game.revision)) throw new RoomError("INVALID_REQUEST", "记录游标无效");
    return this.project(room, member.id, after);
  }
  subscribe(roomId: string, seatToken: string, listener: RoomListener, onClosed?: () => void, onReplaced?: () => void, incremental = false): () => void {
    const room = this.requireRoom(roomId); const member = this.credential(room, seatToken);
    const sub: Subscription = { playerId: member.id, listener, onClosed, onReplaced, eventAfterRevision: incremental && room.gameId === "catan" ? null : undefined };
    const subs = this.subscriptions.get(room.id) ?? new Set<Subscription>(); subs.add(sub); this.subscriptions.set(room.id, subs);
    listener(this.project(room, member.id, sub.eventAfterRevision));
    if (sub.eventAfterRevision !== undefined) sub.eventAfterRevision = room.game?.revision ?? null;
    return () => { subs.delete(sub); if (subs.size === 0) this.subscriptions.delete(room.id); };
  }
  evictIdleRooms(idleMs: number): string[] {
    const ids: string[] = [];
    for (const room of this.rooms.values()) if (!(this.subscriptions.get(room.id)?.size) && room.lastActiveAt <= this.now() - idleMs) { ids.push(room.id); this.remove(room); }
    return ids;
  }
  get roomCount() { return this.rooms.size; }
  dispose() { this.catan.dispose(); this.drawGuess.dispose(); }

  // Typed game entry points. HTTP dispatch validates the corresponding DTO before calling these.
  updateSettings(roomId: string, seatToken: string, revision: number, settings: { readonly ruleProfile: PlayableRuleProfile; readonly victoryPointsToWin: number; readonly bankCountsPublic?: boolean | undefined }): RoomView {
    const room = this.catanRoom(this.configurable(roomId, seatToken, revision)); this.catan.settings(room, settings);
    room.revision++; this.notify(room); return this.catan.project(room, room.hostPlayerId);
  }
  rerollMap(roomId: string, seatToken: string, revision: number): RoomView {
    const room = this.catanRoom(this.configurable(roomId, seatToken, revision)); room.seed = this.createSeed(room.seed);
    room.revision++; this.notify(room); return this.catan.project(room, room.hostPlayerId);
  }
  updateDrawSettings(roomId: string, seatToken: string, revision: number, settings: DrawGuessSettings): DrawGuessRoomView {
    const room = this.drawRoom(this.configurable(roomId, seatToken, revision)); this.drawGuess.settings(room, settings);
    room.revision++; this.notify(room); return this.drawGuess.project(room, room.hostPlayerId);
  }
  executeDrawCommand(roomId: string, seatToken: string, commandId: string, command: DrawGuessPlayerCommand): DrawGuessRoomView {
    const room = this.drawRoom(this.requireRoom(roomId)); const member = this.credential(room, seatToken);
    return this.drawGuess.command(room, member.id, commandId, command);
  }
  executeCommand(roomId: string, seatToken: string, commandId: string, expectedRevision: number, command: GameCommand): GameCommandResponse;
  executeCommand(roomId: string, seatToken: string, commandId: string, expectedRevision: number, command: GameCommand, responseMode: "ack" | undefined, matchId?: string): GameCommandReply;
  executeCommand(roomId: string, seatToken: string, commandId: string, expectedRevision: number, command: GameCommand, responseMode?: "ack", matchId?: string): GameCommandReply {
    const room = this.catanRoom(this.requireRoom(roomId)); const member = this.credential(room, seatToken);
    return this.catan.command(room, member.id, commandId, expectedRevision, command, responseMode, matchId);
  }
  getHistory(roomId: string, seatToken: string, gameId: string, beforeRevision?: number): GameHistoryPage {
    const room = this.catanRoom(this.requireRoom(roomId)); const member = this.credential(room, seatToken);
    if (!room.game || room.game.id !== gameId) throw new RoomError("GAME_NOT_STARTED", "对局已变更，请刷新");
    if (beforeRevision !== undefined && beforeRevision > room.game.revision + 1) throw new RoomError("INVALID_REQUEST", "记录游标无效");
    return projectHistoryPage(room.game, member.id, room.history, room.victoryWarnings, beforeRevision);
  }
  tableIntentAvailable(roomId: string, seatToken: string): boolean {
    const room = this.catanRoom(this.requireRoom(roomId)); const member = this.credential(room, seatToken);
    return room.game?.phase.kind === "turn" && room.tableIntentTurns.get(member.id) !== room.game.phase.turnNumber;
  }
  recordTableIntentUse(roomId: string, seatToken: string, matchId: string, turnNumber: number) {
    const room = this.catanRoom(this.requireRoom(roomId)); const member = this.credential(room, seatToken);
    if (room.matchId !== matchId) throw new RoomError("STALE_MATCH", "这次分析属于上一局，请重新分析");
    if (room.game?.phase.kind !== "turn" || room.game.phase.turnNumber !== turnNumber) throw new RoomError("STALE_REVISION", "回合已更新，请重新分析");
    room.tableIntentTurns.set(member.id, turnNumber);
  }
  getCatanRoom(roomId: string, seatToken: string, after?: number | null): RoomView {
    const view = this.getRoom(roomId, seatToken, after); if (view.gameId !== "catan") throw new RoomError("WRONG_GAME", "此操作仅适用于卡坦"); return view;
  }
  startCatanRoom(roomId: string, seatToken: string): RoomView {
    this.getCatanRoom(roomId, seatToken); const view = this.startRoom(roomId, seatToken);
    if (view.gameId !== "catan") throw new RoomError("WRONG_GAME", "游戏不匹配"); return view;
  }

  private requireRoom(roomId: string): AnyRoomRecord {
    const room = this.rooms.get(roomId.trim().toUpperCase()); if (!room) throw new RoomError("ROOM_NOT_FOUND", "房间不存在");
    room.lastActiveAt = this.now(); return room;
  }
  private credential(room: AnyRoomRecord, token: string) {
    const member = room.members.find((m) => m.seatToken === token);
    if (!member) throw new RoomError("PLAYER_NOT_FOUND", "座位凭证已失效");
    if (member.accountId !== null && !this.accountIsActive(member.accountId)) { this.prepareAccountTakeover(member.accountId)(); throw new RoomError("PLAYER_NOT_FOUND", "账号登录已失效，请重新登录"); }
    return member;
  }
  private openLobby(roomId: string, token: string, revision: number) {
    const room = this.requireRoom(roomId); this.credential(room, token);
    if (room.game !== null) throw new RoomError("ROOM_ALREADY_STARTED", "开局后不能更改房间设置");
    if (room.revision !== revision) throw new RoomError("STALE_ROOM_REVISION", "房间已更新，请重试"); return room;
  }
  private configurable(roomId: string, token: string, revision: number) {
    const room = this.openLobby(roomId, token, revision);
    if (this.credential(room, token).id !== room.hostPlayerId) throw new RoomError("ONLY_HOST_CAN_CONFIGURE", "只有房主可以修改设置"); return room;
  }
  private catanRoom(room: AnyRoomRecord): RoomRecord { if (room.gameId !== "catan") throw new RoomError("WRONG_GAME", "此操作仅适用于卡坦"); return room; }
  private drawRoom(room: AnyRoomRecord): DrawRoomRecord { if (room.gameId !== "draw-guess") throw new RoomError("WRONG_GAME", "此操作仅适用于传画猜词"); return room; }
  private project(room: AnyRoomRecord, id: string, after?: number | null): AnyRoomView {
    if (!room.members.some((m) => m.id === id)) throw new RoomError("PLAYER_NOT_FOUND", "玩家不属于这个房间");
    return room.gameId === "catan" ? this.catan.project(room, id, after) : this.drawGuess.project(room, id);
  }
  private notify(room: AnyRoomRecord) {
    for (const sub of this.subscriptions.get(room.id) ?? []) {
      sub.listener(this.project(room, sub.playerId, sub.eventAfterRevision));
      if (sub.eventAfterRevision !== undefined) sub.eventAfterRevision = room.game?.revision ?? null;
    }
  }
  private remove(room: AnyRoomRecord) { if (room.gameId === "catan") this.catan.cancel(room.id); else this.drawGuess.cancel(room.id); this.rooms.delete(room.id); this.subscriptions.delete(room.id); }
  private createRoomId() {
    for (let i = 0; i < 20; i++) { const id = randomBytes(3).toString("hex").toUpperCase(); if (!this.rooms.has(id)) return id; }
    throw new Error("Unable to allocate a unique room id");
  }
  private createSeed(excluded?: number) {
    for (let i = 0; i < 20; i++) { const seed = this.nextSeed(); if (Number.isInteger(seed) && seed > 0 && seed < 2_147_483_647 && seed !== excluded) return seed; }
    throw new Error("Unable to allocate a game seed");
  }
}
