import { CARCASSONNE_PLAYER_LIMITS } from "@catan/game-core/carcassonne";
import { randomUUID } from "node:crypto";
import { CarcassonneError, createCarcassonne, executeCarcassonne, type PlaceCommand } from "@catan/game-core/carcassonne";
import { projectCarcassonne, type CarcassonneRoomView, type CarcassonneSettlementV1 } from "@catan/protocol/carcassonne";
import type { MatchRepository } from "../../database/match-repository.js";
import type { RoomBase } from "../../room-base.js";
import { RoomError } from "../../room-errors.js";
import type { CarcassonneRoomRecord } from "./room-types.js";

export class CarcassonneRoomGame {
  repository: MatchRepository | null = null;
  constructor(private readonly now: () => number, private readonly notify: (room: CarcassonneRoomRecord) => void) {}
  create(base: RoomBase): CarcassonneRoomRecord { return { ...base, gameId: "carcassonne", game: null }; }
  capacity() { return CARCASSONNE_PLAYER_LIMITS.max; }
  project(room: CarcassonneRoomRecord, viewerId: string): CarcassonneRoomView {
    return { id: room.id, gameId: "carcassonne", matchId: room.matchId, revision: room.revision, hostPlayerId: room.hostPlayerId,
      members: room.members.map(({ id, name, color }) => ({ id, name, color, isHost: id === room.hostPlayerId })),
      game: room.game ? projectCarcassonne(room.game, viewerId) : null };
  }
  start(room: CarcassonneRoomRecord) {
    if (room.members.length < CARCASSONNE_PLAYER_LIMITS.min || room.members.length > CARCASSONNE_PLAYER_LIMITS.max) throw new RoomError("NOT_ENOUGH_PLAYERS", "卡卡颂需要 2–5 人");
    const matchId = randomUUID();
    room.game = createCarcassonne(matchId, room.members.map(({ id, name, color }) => ({ id, name, color })), room.seed);
    room.matchId = matchId; room.startedAt = this.now(); room.appliedCommands.clear();
  }
  reset(room: CarcassonneRoomRecord) { room.game = null; room.matchId = null; room.startedAt = 0; room.appliedCommands.clear(); }
  command(room: CarcassonneRoomRecord, playerId: string, commandId: string, command: PlaceCommand): CarcassonneRoomView {
    if (!room.game) throw new RoomError("GAME_NOT_STARTED", "游戏尚未开始");
    if (room.game.id !== command.matchId) throw new RoomError("STALE_MATCH", "操作属于上一局，请刷新");
    const key = `${playerId}:${commandId}`;
    if (room.appliedCommands.has(key)) return this.project(room, playerId);
    let next;
    try { next = executeCarcassonne(room.game, playerId, command); }
    catch (e) { if (e instanceof CarcassonneError) throw new RoomError(e.code, e.message); throw e; }
    // Persist before changing memory, so a failed final write leaves the exact move retryable.
    if (next.phase.kind === "finished" && this.repository) {
      const data: CarcassonneSettlementV1 = { playerCount: next.players.length, tilesPlaced: next.board.length, winnerIds: [...next.phase.winnerIds],
        players: next.players.map((p) => ({ id: p.id, name: p.name, score: p.score, rank: 1 + next.players.filter((q) => q.score > p.score).length })) };
      this.repository.save({ gameId: "carcassonne", matchId: next.id, dataVersion: 1, startedAt: room.startedAt, finishedAt: this.now(), data },
        room.members.flatMap((m) => m.accountId === null ? [] : [{ accountId: m.accountId, playerId: m.id }]));
    }
    room.game = next; room.revision++; room.appliedCommands.add(key); this.notify(room);
    return this.project(room, playerId);
  }
}
