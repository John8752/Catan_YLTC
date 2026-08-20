import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  createBaseGame,
  createStandardMap,
  DEFAULT_VICTORY_POINTS_TO_WIN,
  executeGameCommand,
  MAX_VICTORY_POINTS_TO_WIN,
  MIN_VICTORY_POINTS_TO_WIN,
  PLAYER_COLORS,
  type GameCommand,
  type GameCommandErrorCode,
  type GameState,
  type GameEventRecord,
  type PlayerColor,
} from "@catan/game-core";
import {
  type GameCommandResponse,
  projectGameForPlayer,
  type PlayerSessionResponse,
  type RoomView,
} from "@catan/protocol";

interface RoomMember {
  readonly id: string;
  readonly seatToken: string;
  readonly name: string;
  readonly color: PlayerColor;
}

interface RoomRecord {
  readonly id: string;
  readonly hostPlayerId: string;
  seed: number;
  revision: number;
  readonly members: RoomMember[];
  settings: {
    readonly playerLimit: 3 | 4;
    readonly victoryPointsToWin: number;
  };
  game: GameState | null;
  readonly commandResults: Map<string, GameCommandResponse>;
  readonly history: GameEventRecord[];
}

type RoomListener = (room: RoomView) => void;

interface Subscription {
  readonly playerId: string;
  readonly listener: RoomListener;
}

export type RoomErrorCode =
  | "ROOM_NOT_FOUND"
  | "PLAYER_NOT_FOUND"
  | "ROOM_ALREADY_STARTED"
  | "ROOM_FULL"
  | "INVALID_PLAYER_NAME"
  | "ONLY_HOST_CAN_START"
  | "ONLY_HOST_CAN_CONFIGURE"
  | "NOT_ENOUGH_PLAYERS"
  | "INVALID_ROOM_SETTINGS"
  | "ROOM_CAPACITY_TOO_SMALL"
  | "STALE_ROOM_REVISION"
  | "GAME_NOT_STARTED"
  | "STALE_REVISION"
  | GameCommandErrorCode;

export class RoomError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RoomError";
  }
}

export class RoomRegistry {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly subscriptions = new Map<string, Set<Subscription>>();
  private readonly nextSeed: () => number;

  constructor(options: { readonly nextSeed?: () => number } = {}) {
    this.nextSeed = options.nextSeed ?? (() => randomInt(1, 2_147_483_647));
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
      settings: { playerLimit: 4, victoryPointsToWin: DEFAULT_VICTORY_POINTS_TO_WIN },
      game: null,
      commandResults: new Map(),
      history: [],
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

    const color = PLAYER_COLORS[room.members.length];

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
    settings: { readonly playerLimit: number; readonly victoryPointsToWin: number },
  ): RoomView {
    const room = this.requireConfigurableRoom(roomId, seatToken, expectedRevision);
    if (settings.playerLimit !== 3 && settings.playerLimit !== 4) {
      throw new RoomError("INVALID_ROOM_SETTINGS", "Base 3–4 supports a player limit of three or four");
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

    if (room.members.length < 3) {
      throw new RoomError("NOT_ENOUGH_PLAYERS", "At least three players are required");
    }

    room.game = createBaseGame({
      id: `game_${room.id.toLowerCase()}`,
      seed: room.seed,
      players: room.members,
      victoryPointsToWin: room.settings.victoryPointsToWin,
    });
    room.revision += 1;
    this.notify(room);

    return this.projectRoom(room, playerId);
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
    const cached = room.commandResults.get(cacheKey);
    if (cached !== undefined) return cached;
    if (room.game === null) throw new RoomError("GAME_NOT_STARTED", "The game has not started");
    if (room.game.revision !== expectedRevision) {
      throw new RoomError("STALE_REVISION", "Game state changed; refresh and try again");
    }

    const result = executeGameCommand(room.game, playerId, command);
    if (!result.accepted) throw new RoomError(result.error.code, result.error.message);

    room.game = result.state;
    room.history.push(...result.events.map((event) => ({ revision: result.state.revision, event })));
    room.revision += 1;
    const response: GameCommandResponse = {
      commandId,
      room: this.projectRoom(room, playerId),
    };
    room.commandResults.set(cacheKey, response);
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
        ruleProfile: "base-3-4",
        playerLimit: room.settings.playerLimit,
        victoryPointsToWin: room.settings.victoryPointsToWin,
        mapSeed: room.seed,
      },
      previewMap: room.game === null ? createStandardMap(room.seed) : null,
      game: room.game === null ? null : projectGameForPlayer(room.game, viewerId, room.history),
    };
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
}

function normalizePlayerName(playerName: string): string {
  const name = playerName.trim();

  if (name.length < 1 || name.length > 24) {
    throw new RoomError("INVALID_PLAYER_NAME", "Player name must contain 1–24 characters");
  }

  return name;
}
