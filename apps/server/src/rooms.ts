import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  createBaseGame,
  executeGameCommand,
  PLAYER_COLORS,
  type GameCommand,
  type GameCommandErrorCode,
  type GameState,
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
  readonly name: string;
  readonly color: PlayerColor;
}

interface RoomRecord {
  readonly id: string;
  readonly hostPlayerId: string;
  readonly seed: number;
  revision: number;
  readonly members: RoomMember[];
  game: GameState | null;
  readonly commandResults: Map<string, GameCommandResponse>;
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
  | "NOT_ENOUGH_PLAYERS"
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

  createRoom(playerName: string): PlayerSessionResponse {
    const name = normalizePlayerName(playerName);
    const roomId = this.createRoomId();
    const playerId = `player_${randomUUID()}`;
    const room: RoomRecord = {
      id: roomId,
      hostPlayerId: playerId,
      seed: randomInt(1, 2_147_483_647),
      revision: 1,
      members: [{ id: playerId, name, color: PLAYER_COLORS[0] }],
      game: null,
      commandResults: new Map(),
    };

    this.rooms.set(roomId, room);

    return {
      roomId,
      playerId,
      room: this.projectRoom(room, playerId),
    };
  }

  joinRoom(roomId: string, playerName: string): PlayerSessionResponse {
    const room = this.requireRoom(roomId);
    const name = normalizePlayerName(playerName);

    if (room.game !== null) {
      throw new RoomError("ROOM_ALREADY_STARTED", "This room has already started");
    }

    if (room.members.length >= 4) {
      throw new RoomError("ROOM_FULL", "M0 base rooms support at most four players");
    }

    const color = PLAYER_COLORS[room.members.length];

    if (color === undefined) {
      throw new RoomError("ROOM_FULL", "No player color is available");
    }

    const playerId = `player_${randomUUID()}`;
    room.members.push({ id: playerId, name, color });
    room.revision += 1;
    this.notify(room);

    return {
      roomId: room.id,
      playerId,
      room: this.projectRoom(room, playerId),
    };
  }

  startRoom(roomId: string, playerId: string): RoomView {
    const room = this.requireRoom(roomId);
    this.requireMember(room, playerId);

    if (playerId !== room.hostPlayerId) {
      throw new RoomError("ONLY_HOST_CAN_START", "Only the room host can start the game");
    }

    if (room.game !== null) {
      throw new RoomError("ROOM_ALREADY_STARTED", "This room has already started");
    }

    if (room.members.length < 3) {
      throw new RoomError("NOT_ENOUGH_PLAYERS", "At least three players are required for M0");
    }

    room.game = createBaseGame({
      id: `game_${room.id.toLowerCase()}`,
      seed: room.seed,
      players: room.members,
    });
    room.revision += 1;
    this.notify(room);

    return this.projectRoom(room, playerId);
  }

  getRoom(roomId: string, playerId: string): RoomView {
    const room = this.requireRoom(roomId);
    this.requireMember(room, playerId);
    return this.projectRoom(room, playerId);
  }

  executeCommand(
    roomId: string,
    playerId: string,
    commandId: string,
    expectedRevision: number,
    command: GameCommand,
  ): GameCommandResponse {
    const room = this.requireRoom(roomId);
    this.requireMember(room, playerId);
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
    room.revision += 1;
    const response: GameCommandResponse = {
      commandId,
      room: this.projectRoom(room, playerId),
    };
    room.commandResults.set(cacheKey, response);
    this.notify(room);
    return response;
  }

  subscribe(roomId: string, playerId: string, listener: RoomListener): () => void {
    const room = this.requireRoom(roomId);
    this.requireMember(room, playerId);

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

  private projectRoom(room: RoomRecord, viewerId: string): RoomView {
    this.requireMember(room, viewerId);

    return {
      id: room.id,
      revision: room.revision,
      hostPlayerId: room.hostPlayerId,
      members: room.members.map((member) => ({
        ...member,
        isHost: member.id === room.hostPlayerId,
      })),
      game: room.game === null ? null : projectGameForPlayer(room.game, viewerId),
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
