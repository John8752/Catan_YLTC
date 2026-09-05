import { projectRoomView } from "./project-room.js";
import type { RoomMember, RoomRecord, RoomListener, Subscription } from "./room-types.js";
import { AccountSeats } from "./account-seats.js";
import { prepareSettlement } from "./settlements.js";
import type { MatchRepository } from "./database/match-repository.js";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  createGame,
  DEFAULT_VICTORY_POINTS_TO_WIN,
  executeGameCommand,
  MAX_VICTORY_POINTS_TO_WIN,
  MIN_VICTORY_POINTS_TO_WIN,
  getRuleProfileDefinition,
  PLAYER_COLORS,
  type GameCommand,
  type PlayerColor,
  type PlayableRuleProfile,
} from "@catan/game-core";
import {
  type GameCommandResponse,
  type GameCommandReply,
  projectHistoryPage, type GameHistoryPage,
  type LeaveRoomResponse,
  collectVictoryWarnings,
  type PlayerSessionResponse,
  type RoomView,
} from "@catan/protocol";
import type { AiCommentator } from "./ai-commentary.js";
import { RoomSetupAnalysis } from "./room-setup-analysis.js";
import { normalizePlayerName, RoomError } from "./room-errors.js";
import { TurnTimerManager, type TurnTimerExpiry } from "./turn-timer.js";

export class RoomRegistry {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly subscriptions = new Map<string, Set<Subscription>>();
  private readonly accountSeats = new AccountSeats(this.rooms, this.subscriptions, (room, playerId) => this.projectRoom(room, playerId));
  private matchRepository: MatchRepository | null = null;
  private onSettlementError: () => void = () => {};
  private accountIsActive: (accountId: string) => boolean = () => true;
  private readonly nextSeed: () => number;
  private readonly now: () => number;
  private readonly turnTimers: TurnTimerManager;
  private readonly setupAnalysis: RoomSetupAnalysis;

  constructor(
    options: {
      readonly nextSeed?: () => number;
      readonly now?: () => number;
      readonly aiCommentator?: AiCommentator | null;
    } = {},
  ) {
    this.nextSeed = options.nextSeed ?? (() => randomInt(1, 2_147_483_647));
    this.now = options.now ?? (() => Date.now());
    this.turnTimers = new TurnTimerManager(this.now);
    this.setupAnalysis = new RoomSetupAnalysis(this.rooms, options.aiCommentator ?? null, (room, id) => this.projectRoom(room, id), (room) => this.notify(room));
  }

  configureAiCommentator(aiCommentator: AiCommentator | null): void {
    this.setupAnalysis.configure(aiCommentator);
  }

  configureMatchRepository(repository: MatchRepository, onError: () => void = () => {}): void {
    this.matchRepository = repository;
    this.onSettlementError = onError;
  }
  configureAccountValidation(validate: (accountId: string) => boolean): void { this.accountIsActive = validate; }

  accountSeat(accountId: string): PlayerSessionResponse | null { return this.accountSeats.seat(accountId); }
  prepareAccountTakeover(accountId: string, guestSeat?: { readonly roomId: string; readonly seatToken: string }): () => void {
    return this.accountSeats.prepare(accountId, guestSeat);
  }

  createRoom(playerName: string, accountId: string | null = null): PlayerSessionResponse {
    const existing = accountId === null ? null : this.accountSeat(accountId);
    if (existing) return existing;
    const name = normalizePlayerName(playerName);
    const roomId = this.createRoomId();
    const playerId = `player_${randomUUID()}`;
    const seatToken = randomBytes(24).toString("base64url");
    const room: RoomRecord = {
      id: roomId,
      matchId: randomUUID(),
      startedAt: 0,
      hostPlayerId: playerId,
      seed: this.createSeed(),
      revision: 1,
      members: [{ id: playerId, seatToken, accountId, name, color: PLAYER_COLORS[0] }],
      settings: { ruleProfile: "base-3-4", victoryPointsToWin: DEFAULT_VICTORY_POINTS_TO_WIN, bankCountsPublic: true },
      game: null,
      appliedCommands: new Set(),
      history: [],
      victoryWarnings: [],
      publicSetupAnalysis: null,
      tableIntentTurns: new Map(),
      lastActiveAt: this.now(),
    };

    this.rooms.set(roomId, room);

    return {
      roomId,
      playerId,
      seatToken,
      room: this.projectRoom(room, playerId),
    };
  }

  joinRoom(roomId: string, playerName: string, accountId: string | null = null): PlayerSessionResponse {
    const existing = accountId === null ? null : this.accountSeat(accountId);
    if (existing) return existing;
    const room = this.requireRoom(roomId);
    const name = normalizePlayerName(playerName);

    if (room.game !== null) {
      throw new RoomError("ROOM_ALREADY_STARTED", "This room has already started");
    }

    const seatCap = getRuleProfileDefinition(room.settings.ruleProfile).maxPlayers;
    if (room.members.length >= seatCap) {
      throw new RoomError("ROOM_FULL", `This room is limited to ${seatCap} players`);
    }

    const color = PLAYER_COLORS.find(
      (candidate) => !room.members.some((member) => member.color === candidate),
    );

    if (color === undefined) {
      throw new RoomError("ROOM_FULL", "No player color is available");
    }

    const playerId = `player_${randomUUID()}`;
    const seatToken = randomBytes(24).toString("base64url");
    room.members.push({ id: playerId, seatToken, accountId, name, color });
    room.revision += 1;
    this.notify(room);

    return {
      roomId: room.id,
      playerId,
      seatToken,
      room: this.projectRoom(room, playerId),
    };
  }

  updateSettings(
    roomId: string,
    seatToken: string,
    expectedRevision: number,
    settings: {
      readonly ruleProfile: PlayableRuleProfile;
      readonly victoryPointsToWin: number;
      readonly bankCountsPublic?: boolean | undefined;
    },
  ): RoomView {
    const room = this.requireConfigurableRoom(roomId, seatToken, expectedRevision);
    const profile = getRuleProfileDefinition(settings.ruleProfile);
    if (
      !Number.isInteger(settings.victoryPointsToWin) ||
      settings.victoryPointsToWin < MIN_VICTORY_POINTS_TO_WIN ||
      settings.victoryPointsToWin > MAX_VICTORY_POINTS_TO_WIN
    ) {
      throw new RoomError(
        "INVALID_ROOM_SETTINGS",
        `Victory target must be ${MIN_VICTORY_POINTS_TO_WIN}–${MAX_VICTORY_POINTS_TO_WIN} points`,
      );
    }
    // Switching profiles is what can shrink the room now, so the seated players
    // are what the new profile has to be able to hold.
    if (profile.maxPlayers < room.members.length) {
      throw new RoomError("ROOM_CAPACITY_TOO_SMALL", "Player limit cannot be lower than the occupied seats");
    }

    room.settings = {
      ruleProfile: settings.ruleProfile,
      victoryPointsToWin: settings.victoryPointsToWin,
      bankCountsPublic: settings.bankCountsPublic ?? room.settings.bankCountsPublic,
    };
    room.revision += 1;
    this.notify(room);
    return this.projectRoom(room, room.hostPlayerId);
  }

  rerollMap(roomId: string, seatToken: string, expectedRevision: number): RoomView {
    const room = this.requireConfigurableRoom(roomId, seatToken, expectedRevision);
    room.seed = this.createSeed(room.seed);
    room.revision += 1;
    this.notify(room);
    return this.projectRoom(room, room.hostPlayerId);
  }

  updatePlayerColor(
    roomId: string,
    seatToken: string,
    expectedRevision: number,
    color: PlayerColor,
  ): RoomView {
    const room = this.requireOpenLobby(roomId, seatToken, expectedRevision);
    const member = this.requireCredential(room, seatToken);
    if (member.color === color) return this.projectRoom(room, member.id);
    if (room.members.some((candidate) => candidate.color === color)) {
      throw new RoomError("PLAYER_COLOR_TAKEN", "这个颜色已经被其他玩家选择");
    }

    member.color = color;
    room.revision += 1;
    this.notify(room);
    return this.projectRoom(room, member.id);
  }

  shuffleMembers(roomId: string, seatToken: string, expectedRevision: number): RoomView {
    const room = this.requireOpenLobby(roomId, seatToken, expectedRevision);
    const member = this.requireCredential(room, seatToken);
    if (member.id !== room.hostPlayerId) {
      throw new RoomError("ONLY_HOST_CAN_SHUFFLE", "只有房主可以打乱玩家顺序");
    }
    if (room.members.length < 2) return this.projectRoom(room, room.hostPlayerId);

    const previousOrder = room.members.map((member) => member.id);
    for (let index = room.members.length - 1; index > 0; index -= 1) {
      const target = randomInt(index + 1);
      [room.members[index], room.members[target]] = [room.members[target]!, room.members[index]!];
    }
    if (room.members.every((member, index) => member.id === previousOrder[index])) {
      room.members.push(room.members.shift()!);
    }

    room.revision += 1;
    this.notify(room);
    return this.projectRoom(room, room.hostPlayerId);
  }

  leaveRoom(roomId: string, seatToken: string): LeaveRoomResponse {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    if (room.game !== null) {
      throw new RoomError(
        "CANNOT_LEAVE_STARTED_GAME",
        "Players cannot release their seat after the game starts",
      );
    }

    const memberIndex = room.members.findIndex((candidate) => candidate.id === member.id);
    room.members.splice(memberIndex, 1);
    this.removeSubscriptions(room.id, member.id);

    if (room.members.length === 0) {
      this.turnTimers.clear(room.id);
      this.setupAnalysis.cancel(room.id);
      this.rooms.delete(room.id);
      this.subscriptions.delete(room.id);
      return { roomDeleted: true, newHostPlayerId: null };
    }

    if (room.hostPlayerId === member.id) {
      const nextHost = room.members[0];
      if (nextHost === undefined) throw new Error("Room has no host candidate");
      room.hostPlayerId = nextHost.id;
    }
    room.revision += 1;
    this.notify(room);
    return { roomDeleted: false, newHostPlayerId: room.hostPlayerId };
  }

  /**
   * Ends the room for everybody, started or not.
   *
   * `leaveRoom` deliberately refuses once a game is running, which left a host
   * with no way out of a match nobody wants to finish, and left an abandoned room
   * sitting in memory until the idle sweep. This is the deliberate version of
   * that: only the host, and everyone is told before the room stops existing.
   */
  disbandRoom(roomId: string, seatToken: string): void {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    if (member.id !== room.hostPlayerId) {
      throw new RoomError("ONLY_HOST_CAN_DISBAND", "Only the room host can disband the room");
    }

    for (const subscription of this.subscriptions.get(room.id) ?? []) subscription.onClosed?.();
    this.turnTimers.clear(room.id);
    this.setupAnalysis.cancel(room.id);
    this.rooms.delete(room.id);
    this.subscriptions.delete(room.id);
  }

  startRoom(roomId: string, seatToken: string): RoomView {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    const playerId = member.id;

    if (playerId !== room.hostPlayerId) {
      throw new RoomError("ONLY_HOST_CAN_START", "Only the room host can start the game");
    }

    if (room.game !== null) {
      throw new RoomError("ROOM_ALREADY_STARTED", "This room has already started");
    }

    const profile = getRuleProfileDefinition(room.settings.ruleProfile);
    if (room.members.length < profile.minPlayers) {
      throw new RoomError("NOT_ENOUGH_PLAYERS", `At least ${profile.minPlayers} players are required`);
    }

    room.startedAt = this.now();
    room.game = createGame({
      id: `game_${room.id.toLowerCase()}`,
      seed: room.seed,
      players: room.members.map(({ id, name, color }) => ({ id, name, color })),
      victoryPointsToWin: room.settings.victoryPointsToWin,
      ruleProfile: room.settings.ruleProfile,
    });
    room.revision += 1;
    this.syncTurnTimer(room);
    this.notify(room);

    return this.projectRoom(room, playerId);
  }

  /**
   * Drops rooms that have no live subscriber and have not been touched within
   * `idleMs`. A room with an open socket is never evicted, however long a player
   * takes to act; abandoned rooms are what leak. Returns the evicted room ids.
   */
  evictIdleRooms(idleMs: number): string[] {
    const cutoff = this.now() - idleMs;
    const evicted: string[] = [];

    for (const room of this.rooms.values()) {
      if ((this.subscriptions.get(room.id)?.size ?? 0) > 0) continue;
      if (room.lastActiveAt > cutoff) continue;

      this.rooms.delete(room.id);
      this.subscriptions.delete(room.id);
      this.turnTimers.clear(room.id);
      this.setupAnalysis.cancel(room.id);
      evicted.push(room.id);
    }

    return evicted;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  getRoom(roomId: string, seatToken: string, eventAfterRevision?: number | null): RoomView {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    if (eventAfterRevision != null && (!room.game || eventAfterRevision > room.game.revision)) throw new RoomError("INVALID_REQUEST", "记录游标无效");
    return this.projectRoom(room, member.id, eventAfterRevision);
  }

  getHistory(roomId: string, seatToken: string, gameId: string, beforeRevision?: number): GameHistoryPage {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    if (!room.game || room.game.id !== gameId) throw new RoomError("GAME_NOT_STARTED", "对局已变更，请刷新");
    if (beforeRevision !== undefined && beforeRevision > room.game.revision + 1) throw new RoomError("INVALID_REQUEST", "记录游标无效");
    return projectHistoryPage(room.game, member.id, room.history, room.victoryWarnings, beforeRevision);
  }

  /**
   * Whether this seat may still ask what the table is planning this turn.
   *
   * Reading every opponent's next build is the strongest thing the commentator
   * does, so it is rationed per turn rather than per minute: one look, then
   * play. The allowance lives on the room record so it is discarded with the
   * room instead of outliving it in a registry-wide map.
   */
  tableIntentAvailable(roomId: string, seatToken: string): boolean {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    const phase = room.game?.phase;
    if (phase === undefined || phase.kind !== "turn") return false;
    return room.tableIntentTurns.get(member.id) !== phase.turnNumber;
  }

  /** Spend the allowance, once the model has actually answered. */
  recordTableIntentUse(roomId: string, seatToken: string): void {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    const phase = room.game?.phase;
    if (phase === undefined || phase.kind !== "turn") return;
    room.tableIntentTurns.set(member.id, phase.turnNumber);
  }

  executeCommand(roomId: string, seatToken: string, commandId: string, expectedRevision: number, command: GameCommand): GameCommandResponse;
  executeCommand(roomId: string, seatToken: string, commandId: string, expectedRevision: number, command: GameCommand, responseMode: "ack" | undefined): GameCommandReply;
  executeCommand(
    roomId: string,
    seatToken: string,
    commandId: string,
    expectedRevision: number,
    command: GameCommand,
    responseMode?: "ack",
  ): GameCommandReply {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    const playerId = member.id;
    const response = (): GameCommandReply => responseMode === "ack"
      ? { commandId, roomId: room.id, roomRevision: room.revision, gameRevision: room.game!.revision }
      : { commandId, room: this.projectRoom(room, playerId) };
    const cacheKey = `${playerId}:${commandId}`;
    if (room.appliedCommands.has(cacheKey)) {
      // Answer a retry from live state. Keeping the original response per command
      // meant retaining a full room projection -- map and entire history -- for
      // every move ever made, which made room memory quadratic in game length.
      return response();
    }
    if (room.game === null) throw new RoomError("GAME_NOT_STARTED", "The game has not started");
    if (room.game.revision !== expectedRevision) {
      throw new RoomError("STALE_REVISION", "游戏状态已更新，请重试");
    }

    const result = executeGameCommand(room.game, playerId, command);
    if (!result.accepted) throw new RoomError(result.error.code, result.error.message);

    if (result.state.revision === room.game.revision && result.events.length === 0) {
      room.appliedCommands.add(cacheKey);
      return response();
    }

    const settlement = prepareSettlement(room, result.state, result.events, this.now());
    if (settlement && this.matchRepository) this.matchRepository.save(settlement.record, settlement.participants);
    room.victoryWarnings.push(...collectVictoryWarnings(room.game, result.state, room.victoryWarnings));
    room.game = result.state;
    room.history.push(...result.events.map((event) => ({ revision: result.state.revision, event })));
    room.revision += 1;
    room.appliedCommands.add(cacheKey);
    if (result.events.some((event) => event.type === "setup_completed")) {
      this.setupAnalysis.start(room);
    }
    this.syncTurnTimer(room);
    const reply = response();
    this.notify(room);
    return reply;
  }

  subscribe(
    roomId: string,
    seatToken: string,
    listener: RoomListener,
    onClosed?: () => void,
    onReplaced?: () => void,
    incremental = false,
  ): () => void {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    const playerId = member.id;

    const subscription: Subscription = { playerId, listener, onClosed, onReplaced, eventAfterRevision: incremental ? null : undefined };
    const roomSubscriptions = this.subscriptions.get(room.id) ?? new Set<Subscription>();
    roomSubscriptions.add(subscription);
    this.subscriptions.set(room.id, roomSubscriptions);
    listener(this.projectRoom(room, playerId, subscription.eventAfterRevision));
    if (incremental) subscription.eventAfterRevision = room.game?.revision ?? null;

    return () => {
      roomSubscriptions.delete(subscription);

      if (roomSubscriptions.size === 0) {
        this.subscriptions.delete(room.id);
      }
    };
  }

  dispose(): void {
    this.turnTimers.dispose();
    this.setupAnalysis.dispose();
  }

  private createRoomId(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const roomId = randomBytes(3).toString("hex").toUpperCase();

      if (!this.rooms.has(roomId)) {
        return roomId;
      }
    }

    throw new Error("Unable to allocate a unique room id");
  }

  private createSeed(excludedSeed?: number): number {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const seed = this.nextSeed();
      if (Number.isInteger(seed) && seed > 0 && seed < 2_147_483_647 && seed !== excludedSeed) return seed;
    }
    throw new Error("Unable to allocate a map seed");
  }

  private requireRoom(roomId: string): RoomRecord {
    const room = this.rooms.get(roomId.trim().toUpperCase());

    if (room === undefined) {
      throw new RoomError("ROOM_NOT_FOUND", "Room not found");
    }

    room.lastActiveAt = this.now();
    return room;
  }

  private requireMember(room: RoomRecord, playerId: string): RoomMember {
    const member = room.members.find((candidate) => candidate.id === playerId);

    if (member === undefined) {
      throw new RoomError("PLAYER_NOT_FOUND", "Player does not belong to this room");
    }

    return member;
  }

  private requireCredential(room: RoomRecord, seatToken: string): RoomMember {
    const member = room.members.find((candidate) => candidate.seatToken === seatToken);
    if (member === undefined) {
      throw new RoomError("PLAYER_NOT_FOUND", "Seat credential is invalid");
    }
    if (member.accountId !== null && !this.accountIsActive(member.accountId)) {
      this.prepareAccountTakeover(member.accountId)();
      throw new RoomError("PLAYER_NOT_FOUND", "账号登录已失效，请重新登录");
    }
    return member;
  }

  private requireConfigurableRoom(roomId: string, seatToken: string, expectedRevision: number): RoomRecord {
    const room = this.requireOpenLobby(roomId, seatToken, expectedRevision);
    const member = this.requireCredential(room, seatToken);
    if (member.id !== room.hostPlayerId) {
      throw new RoomError("ONLY_HOST_CAN_CONFIGURE", "Only the room host can change settings");
    }
    return room;
  }

  private requireOpenLobby(roomId: string, seatToken: string, expectedRevision: number): RoomRecord {
    const room = this.requireRoom(roomId);
    this.requireCredential(room, seatToken);
    if (room.game !== null) {
      throw new RoomError("ROOM_ALREADY_STARTED", "Room settings are locked after the game starts");
    }
    if (room.revision !== expectedRevision) {
      throw new RoomError("STALE_ROOM_REVISION", "Room settings changed; refresh and try again");
    }
    return room;
  }

  private projectRoom(room: RoomRecord, viewerId: string, eventAfterRevision?: number | null): RoomView {
    this.requireMember(room, viewerId);
    return projectRoomView(room, viewerId, this.turnTimers.view(room.id), eventAfterRevision);
  }

  private syncTurnTimer(room: RoomRecord): void {
    if (room.game === null) {
      this.turnTimers.clear(room.id);
      return;
    }
    this.turnTimers.sync(room.id, room.game, (expiry) => this.applyTurnTimeout(room.id, expiry));
  }

  private applyTurnTimeout(roomId: string, expiry: TurnTimerExpiry): void {
    const room = this.rooms.get(roomId);
    if (room?.game === null || room?.game === undefined) return;
    const result = executeGameCommand(room.game, expiry.playerId, expiry.command);
    if (!result.accepted) {
      this.syncTurnTimer(room);
      return;
    }

    const settlement = prepareSettlement(room, result.state, result.events, this.now());
    try {
      if (settlement && this.matchRepository) this.matchRepository.save(settlement.record, settlement.participants);
    } catch {
      this.onSettlementError();
      // Keep the previous authoritative state and re-arm its timeout for retry.
      this.syncTurnTimer(room);
      this.notify(room);
      return;
    }
    room.victoryWarnings.push(...collectVictoryWarnings(room.game, result.state, room.victoryWarnings));
    room.game = result.state;
    room.history.push(...result.events.map((event) => ({ revision: result.state.revision, event })));
    room.revision += 1;
    this.syncTurnTimer(room);
    this.notify(room);
  }

  private notify(room: RoomRecord): void {
    const roomSubscriptions = this.subscriptions.get(room.id);

    if (roomSubscriptions === undefined) {
      return;
    }

    for (const subscription of roomSubscriptions) {
      subscription.listener(this.projectRoom(room, subscription.playerId, subscription.eventAfterRevision));
      if (subscription.eventAfterRevision !== undefined) subscription.eventAfterRevision = room.game?.revision ?? null;
    }
  }

  private removeSubscriptions(roomId: string, playerId: string): void {
    const roomSubscriptions = this.subscriptions.get(roomId);
    if (roomSubscriptions === undefined) return;

    for (const subscription of roomSubscriptions) {
      if (subscription.playerId === playerId) roomSubscriptions.delete(subscription);
    }
    if (roomSubscriptions.size === 0) this.subscriptions.delete(roomId);
  }
}
