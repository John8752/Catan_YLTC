import { describe, expect, it, vi } from "vitest";
import { CamelRoomGame } from "./room-game.js";
import { RoomRegistry } from "../../rooms.js";
import { buildApp } from "../../app.js";
import type { RoomBase } from "../../room-base.js";
import { camelCommandSchema } from "./routes.js";
const base = (): RoomBase => ({ id: "ABCDEF", matchId: null, startedAt: 0, hostPlayerId: "p0", seed: 1, revision: 1, lastActiveAt: 0, appliedCommands: new Set(),
  members: ["p0", "p1", "p2"].map((id, i) => ({ id, name: id, seatToken: `seat${i}`, accountId: `account${i}`, color: (["coral", "ocean", "wheat"] as const)[i]! })) });
describe("camel-up authoritative room adapter", () => {
  it("deduplicates retries before consuming random values and rejects stale / out-of-turn inputs", () => {
    const pick = vi.fn(() => 0), notify = vi.fn(), adapter = new CamelRoomGame(() => 100, notify, pick), room = adapter.create(base());
    adapter.start(room); const count = pick.mock.calls.length;
    const command = { type: "roll", matchId: room.matchId!, expectedRevision: 0 } as const;
    expect(() => adapter.command(room, "p1", "wrong", command)).toThrow(); expect(pick).toHaveBeenCalledTimes(count);
    adapter.command(room, "p0", "once", command); const after = pick.mock.calls.length;
    const duplicate = adapter.command(room, "p0", "once", command);
    expect(duplicate.game?.revision).toBe(1); expect(pick).toHaveBeenCalledTimes(after); expect(notify).toHaveBeenCalledTimes(1);
    expect(() => adapter.command(room, "p1", "new", command)).toThrow();
    expect(() => adapter.command(room, "p0", "once", { ...command, matchId: "old" })).toThrow();
  });
  it("writes exactly one final settlement, returns to lobby and allocates a fresh match", () => {
    const save = vi.fn(), adapter = new CamelRoomGame(() => 123, () => {}, () => 0), room = adapter.create(base());
    adapter.repository = { save, history: () => ({ matches: [], nextOffset: null }) };
    adapter.start(room); const oldMatch = room.matchId; let step = 0;
    while (room.game?.phase.kind === "racing" && step < 200) {
      const g = room.game; adapter.command(room, g.phase.kind === "racing" ? g.phase.activePlayerId : "", `roll${step++}`, { type: "roll", matchId: g.id, expectedRevision: g.revision });
    }
    expect(room.game?.phase.kind).toBe("finished"); expect(save).toHaveBeenCalledTimes(1);
    const [record, owners] = save.mock.calls[0]!;
    expect(record).toMatchObject({ gameId: "camel-up", matchId: oldMatch, dataVersion: 1 }); expect(owners).toHaveLength(3);
    expect(record.data).not.toHaveProperty("stacks"); expect(record.data).not.toHaveProperty("finishBets");
    adapter.reset(room); expect(room.game).toBeNull(); adapter.start(room); expect(room.matchId).not.toBe(oldMatch); expect(room.appliedCommands.size).toBe(0);
  });
  it("rejects a caller-supplied roll outcome at the transport boundary", () => {
    expect(camelCommandSchema.safeParse({ seatToken: "seat", commandId: "id", command: { type: "roll", matchId: "m", expectedRevision: 0, value: 3, die: "blue" } }).success).toBe(false);
  });
  it("preserves platform seats, wrong-game dispatch, host start, privacy and recovery", async () => {
    const registry = new RoomRegistry(), app = await buildApp(registry);
    try {
      const create = await app.inject({ method: "POST", url: "/api/rooms", payload: { playerName: "host", gameId: "camel-up" } });
      expect(create.statusCode).toBe(201); const a = create.json();
      const b = registry.joinRoom(a.roomId, "b"), c = registry.joinRoom(a.roomId, "c");
      expect(() => registry.startRoom(a.roomId, b.seatToken)).toThrow();
      const started = registry.startRoom(a.roomId, a.seatToken); if (started.gameId !== "camel-up" || !started.game) throw Error("wrong game");
      for (const seat of [a, b, c]) expect(JSON.stringify(started)).not.toContain(seat.seatToken);
      const changes: unknown[] = []; const unsubscribe = registry.subscribe(a.roomId, b.seatToken, r => changes.push(r));
      const response = await app.inject({ method: "POST", url: `/api/rooms/${a.roomId}/camel-up/commands`, payload: { seatToken: a.seatToken, commandId: "bet", command: { type: "finish-bet", camel: "purple", kind: "winner", matchId: started.matchId, expectedRevision: 0 } } });
      expect(response.statusCode).toBe(200); expect(response.json().game.ownFinishBets).toHaveLength(1);
      const recovered = registry.getRoom(a.roomId, c.seatToken); expect(recovered.gameId).toBe("camel-up");
      if (recovered.gameId !== "camel-up") throw Error(); expect(recovered.game?.ownFinishBets).toEqual([]); expect(recovered.game?.revealedFinishBets).toBeNull(); expect(changes).toHaveLength(2);
      expect(() => registry.executeDrawCommand(a.roomId, a.seatToken, "x", { type: "reroll", matchId: started.matchId!, taskId: "x" } as never)).toThrow();
      const unauthorized = await app.inject({ method: "POST", url: `/api/rooms/${a.roomId}/camel-up/commands`, payload: { seatToken: "invalid", commandId: "x", command: { type: "roll", matchId: started.matchId, expectedRevision: 1 } } });
      expect(unauthorized.statusCode).toBe(400); unsubscribe();
    } finally { await app.close(); }
  });
});
