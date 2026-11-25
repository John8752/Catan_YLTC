import { randomInt, randomUUID } from "node:crypto";
import { CamelError, createCamelUp, executeCamelUp, RACING_CAMELS, type CamelCommand, type Face, type RollInput } from "@catan/game-core/camel-up";
import { projectCamelUp, type CamelRoomView, type CamelSettlementV1 } from "@catan/protocol/camel-up";
import type { RoomBase } from "../../room-base.js";
import type { CamelRoomRecord } from "./room-types.js";
import type { MatchRepository } from "../../database/match-repository.js";
import { RoomError } from "../../room-errors.js";
export class CamelRoomGame {
  repository: MatchRepository | null = null;
  constructor(private readonly now: () => number, private readonly notify: (room: CamelRoomRecord) => void,
    private readonly pick: (maximum: number) => number = randomInt) {}
  create(base: RoomBase): CamelRoomRecord { return { ...base, gameId: "camel-up", game: null }; }
  project(room: CamelRoomRecord, viewerId: string): CamelRoomView {
    return { id: room.id, gameId: "camel-up", matchId: room.matchId, revision: room.revision, hostPlayerId: room.hostPlayerId,
      members: room.members.map(({ id, name, color }) => ({ id, name, color, isHost: id === room.hostPlayerId })), game: room.game ? projectCamelUp(room.game, viewerId) : null };
  }
  start(room: CamelRoomRecord) {
    if (room.members.length < 3 || room.members.length > 6) throw new RoomError("NOT_ENOUGH_PLAYERS", "骆驼大赛需要 3–6 人");
    const order = [...RACING_CAMELS];
    for (let i = order.length - 1; i > 0; i--) { const j = this.pick(i + 1); [order[i], order[j]] = [order[j]!, order[i]!]; }
    const face = () => (this.pick(3) + 1) as Face;
    const id = randomUUID();
    room.game = createCamelUp(id, room.members.map(({ id, name }) => ({ id, name })), { order, positions: RACING_CAMELS.map(face), crazyPositions: [face(), face()] });
    room.matchId = id; room.startedAt = this.now();
  }
  reset(room: CamelRoomRecord) { room.game = null; room.matchId = null; room.startedAt = 0; room.appliedCommands.clear(); }
  command(room: CamelRoomRecord, playerId: string, commandId: string, command: CamelCommand): CamelRoomView {
    const state = room.game; if (!state) throw new RoomError("GAME_NOT_STARTED", "游戏尚未开始");
    if (command.matchId !== state.id) throw new RoomError("STALE_MATCH", "操作属于上一局，请刷新");
    const key = `${playerId}:${commandId}`;
    if (room.appliedCommands.has(key)) return this.project(room, playerId);
    if (command.expectedRevision !== state.revision) throw new RoomError("STALE_REVISION", "赛场已更新，请重新操作");
    if (state.phase.kind !== "racing" || state.phase.activePlayerId !== playerId) throw new RoomError("INVALID_REQUEST", "请等待自己的行动回合");
    let roll: RollInput | undefined;
    if (command.type === "roll") roll = { die: state.remainingDice[this.pick(state.remainingDice.length)]!, value: (this.pick(3) + 1) as Face, crazy: this.pick(2) === 0 ? "black" : "white" };
    let next;
    try { next = executeCamelUp(state, playerId, command, roll); }
    catch (error) { if (error instanceof CamelError) throw new RoomError(error.code, error.message); throw error; }
    if (next.phase.kind === "finished" && this.repository) {
      const data: CamelSettlementV1 = { players: next.players.map(({ id, name, coins }) => ({ id, name, coins })), winnerIds: next.phase.winnerIds, ranking: projectCamelUp(next, playerId).ranking, legs: next.leg };
      this.repository.save({ gameId: "camel-up", matchId: next.id, dataVersion: 1, startedAt: room.startedAt, finishedAt: this.now(), data },
        room.members.flatMap(m => m.accountId === null ? [] : [{ accountId: m.accountId, playerId: m.id }]));
    }
    room.game = next; room.revision++; room.appliedCommands.add(key); this.notify(room); return this.project(room, playerId);
  }
}
