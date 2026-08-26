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
  type GameState,
  type GameEventRecord,
  type PlayerColor,
  type PlayableRuleProfile,
} from "@catan/game-core";
import {
  type GameCommandResponse,
  type LeaveRoomResponse,
  projectGameForPlayer,
  type PlayerSessionResponse,
  type RoomView,
} from "@catan/protocol";
import { normalizePlayerName, RoomError } from "./room-errors.js";
import { TurnTimerManager, type TurnTimerExpiry } from "./turn-timer.js";

interface RoomMember {
  readonly id: string;
  readonly seatToken: string;
  readonly name: string;
  readonly color: PlayerColor;
}

interface RoomRecord {
  readonly id: string;
  hostPlayerId: string;
  seed: number;
  revision: number;
  readonly members: RoomMember[];
  settings: {
    readonly ruleProfile: PlayableRuleProfile;
    readonly playerLimit: 3 | 4 | 5 | 6;
    readonly victoryPointsToWin: number;
  };
  game: GameState | null;
  /** Keys of commands already applied, so a client retry is not replayed. */
  readonly appliedCommands: Set<string>;
  readonly history: GameEventRecord[];
  lastActiveAt: number;
}

type RoomListener = (room: RoomView) => void;

interface Subscription {
  readonly playerId: string;
  readonly listener: RoomListener;
}

export class RoomRegistry {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly subscriptions = new Map<string, Set<Subscription>>();
  private readonly nextSeed: () => number;
  private readonly now: () => number;
  private readonly turnTimers: TurnTimerManager;

  constructor(
    options: { readonly nextSeed?: () => number; readonly now?: () => number } = {},
  ) {
    this.nextSeed = options.nextSeed ?? (() => randomInt(1, 2_147_483_647));
    this.now = options.now ?? (() => Date.now());
    this.turnTimers = new TurnTimerManager(this.now);
  }

  createRoom(playerName: string): PlayerSessionResponse {
    const name = normalizePlayerName(playerName);
    const roomId = this.createRoomId();
    const playerId = `player_${randomUUID()}`;
    const seatToken = randomBytes(24).toString("base64url");
    const room: RoomRecord = {
      id: roomId,
      hostPlayerId: playerId,
      seed: this.createSeed(),
      revision: 1,
      members: [{ id: playerId, seatToken, name, color: PLAYER_COLORS[0] }],
      settings: { ruleProfile: "base-3-4", playerLimit: 4, victoryPointsToWin: DEFAULT_VICTORY_POINTS_TO_WIN },
      game: null,
      appliedCommands: new Set(),
      history: [],
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

  joinRoom(roomId: string, playerName: string): PlayerSessionResponse {
    const room = this.requireRoom(roomId);
    const name = normalizePlayerName(playerName);

    if (room.game !== null) {
      throw new RoomError("ROOM_ALREADY_STARTED", "This room has already started");
    }

    if (room.members.length >= room.settings.playerLimit) {
      throw new RoomError("ROOM_FULL", `This room is limited to ${room.settings.playerLimit} players`);
    }

    const color = PLAYER_COLORS.find(
      (candidate) => !room.members.some((member) => member.color === candidate),
    );

    if (color === undefined) {
      throw new RoomError("ROOM_FULL", "No player color is available");
    }

    const playerId = `player_${randomUUID()}`;
    const seatToken = randomBytes(24).toString("base64url");
    room.members.push({ id: playerId, seatToken, name, color });
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
      readonly playerLimit: 3 | 4 | 5 | 6;
      readonly victoryPointsToWin: number;
    },
  ): RoomView {
    const room = this.requireConfigurableRoom(roomId, seatToken, expectedRevision);
    const profile = getRuleProfileDefinition(settings.ruleProfile);
    if (settings.playerLimit < profile.minPlayers || settings.playerLimit > profile.maxPlayers) {
      throw new RoomError(
        "INVALID_ROOM_SETTINGS",
        `${settings.ruleProfile} supports a player limit of ${profile.minPlayers}–${profile.maxPlayers}`,
      );
    }
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
    if (settings.playerLimit < room.members.length) {
      throw new RoomError("ROOM_CAPACITY_TOO_SMALL", "Player limit cannot be lower than the occupied seats");
    }

    room.settings = {
      ruleProfile: settings.ruleProfile,
      playerLimit: settings.playerLimit,
      victoryPointsToWin: settings.victoryPointsToWin,
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

    room.game = createGame({
      id: `game_${room.id.toLowerCase()}`,
      seed: room.seed,
      players: room.members,
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
      evicted.push(room.id);
    }

    return evicted;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  getRoom(roomId: string, seatToken: string): RoomView {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    return this.projectRoom(room, member.id);
  }

  executeCommand(
    roomId: string,
    seatToken: string,
    commandId: string,
    expectedRevision: number,
    command: GameCommand,
  ): GameCommandResponse {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    const playerId = member.id;
    const cacheKey = `${playerId}:${commandId}`;
    if (room.appliedCommands.has(cacheKey)) {
      // Answer a retry from live state. Keeping the original response per command
      // meant retaining a full room projection -- map and entire history -- for
      // every move ever made, which made room memory quadratic in game length.
      return { commandId, room: this.projectRoom(room, playerId) };
    }
    if (room.game === null) throw new RoomError("GAME_NOT_STARTED", "The game has not started");
    if (room.game.revision !== expectedRevision) {
      throw new RoomError("STALE_REVISION", "游戏状态已更新，请重试");
    }

    const result = executeGameCommand(room.game, playerId, command);
    if (!result.accepted) throw new RoomError(result.error.code, result.error.message);

    room.game = result.state;
    room.history.push(...result.events.map((event) => ({ revision: result.state.revision, event })));
    room.revision += 1;
    room.appliedCommands.add(cacheKey);
    this.syncTurnTimer(room);
    const response: GameCommandResponse = {
      commandId,
      room: this.projectRoom(room, playerId),
    };
    this.notify(room);
    return response;
  }

  subscribe(roomId: string, seatToken: string, listener: RoomListener): () => void {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    const playerId = member.id;

    const subscription: Subscription = { playerId, listener };
    const roomSubscriptions = this.subscriptions.get(room.id) ?? new Set<Subscription>();
    roomSubscriptions.add(subscription);
    this.subscriptions.set(room.id, roomSubscriptions);
    listener(this.projectRoom(room, playerId));

    return () => {
      roomSubscriptions.delete(subscription);

      if (roomSubscriptions.size === 0) {
        this.subscriptions.delete(room.id);
      }
    };
  }

  dispose(): void {
    this.turnTimers.dispose();
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
    return member;
  }

  private requireConfigurableRoom(roomId: string, seatToken: string, expectedRevision: number): RoomRecord {
    const room = this.requireRoom(roomId);
    const member = this.requireCredential(room, seatToken);
    if (member.id !== room.hostPlayerId) {
      throw new RoomError("ONLY_HOST_CAN_CONFIGURE", "Only the room host can change settings");
    }
    if (room.game !== null) {
      throw new RoomError("ROOM_ALREADY_STARTED", "Room settings are locked after the game starts");
    }
    if (room.revision !== expectedRevision) {
      throw new RoomError("STALE_ROOM_REVISION", "Room settings changed; refresh and try again");
    }
    return room;
  }

  private projectRoom(room: RoomRecord, viewerId: string): RoomView {
    this.requireMember(room, viewerId);

    return {
      id: room.id,
      revision: room.revision,
      hostPlayerId: room.hostPlayerId,
      members: room.members.map((member) => ({
        id: member.id,
        name: member.name,
        color: member.color,
        isHost: member.id === room.hostPlayerId,
      })),
      settings: {
        ruleProfile: room.settings.ruleProfile,
        playerLimit: room.settings.playerLimit,
        victoryPointsToWin: room.settings.victoryPointsToWin,
        mapSeed: room.seed,
      },
      previewMap: room.game === null
        ? getRuleProfileDefinition(room.settings.ruleProfile).createMap(room.seed)
        : null,
      game: room.game === null
        ? null
        : projectGameForPlayer(room.game, viewerId, room.history, this.turnTimers.view(room.id)),
    };
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
      subscription.listener(this.projectRoom(room, subscription.playerId));
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
