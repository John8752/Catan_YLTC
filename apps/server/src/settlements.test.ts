import { expect, it, vi } from "vitest";
import { RoomRegistry } from "./rooms.js";
import type { RoomRecord } from "./room-types.js";
import { SqliteDatabase } from "./database/sqlite-database.js";
import { SqliteAccountRepository } from "./database/sqlite-account-repository.js";
import { SqliteMatchRepository } from "./database/match-repository.js";

it("persists exactly one final settlement before broadcasting, survives retry, omits credentials and releases completed accounts", () => {
  const database = new SqliteDatabase(":memory:");
  new SqliteAccountRepository(database).insert({ id: "a", username: "alice", displayName: "甲", status: "active", passwordHash: "hash" }, 1);
  const registry = new RoomRegistry({ nextSeed: () => 81 });
  const repository = new SqliteMatchRepository(database);
  registry.configureMatchRepository(repository);
  const host = registry.createRoom("甲", "a"); registry.joinRoom(host.roomId, "游客");
  registry.updateSettings(host.roomId, host.seatToken, 2, { ruleProfile: "base-3-4", victoryPointsToWin: 5 });
  registry.startRoom(host.roomId, host.seatToken);
  const room = (registry as unknown as { rooms: Map<string, RoomRecord> }).rooms.get(host.roomId)!;
  expect(JSON.stringify(room.game)).not.toContain("accountId");
  expect(JSON.stringify(room.game)).not.toContain("seatToken");
  const game = room.game!;
  const points = game.developmentDeck.filter((card) => card === "victory-point");
  room.game = { ...game, phase: { kind: "turn", step: "roll", activePlayerId: host.playerId, turnNumber: 5 },
    developmentDeck: game.developmentDeck.filter((card) => card !== "victory-point"),
    players: game.players.map((player) => player.id === host.playerId ? { ...player, developmentCards: points.map((card, index) => ({ id: `vp_${index}`, type: card, acquiredTurn: 1 })) } : player) };
  const before = room.game;
  const save = vi.spyOn(repository, "save").mockImplementationOnce(() => { throw new Error("disk full"); });
  expect(() => registry.executeCommand(host.roomId, host.seatToken, "winning", before.revision, { type: "RollDice" })).toThrow("disk full");
  expect(room.game).toBe(before);
  expect(repository.history("a", "catan", 0, 20).matches).toHaveLength(0);
  let finalBroadcast = false;
  registry.subscribe(host.roomId, host.seatToken, (view) => {
    if (view.game?.phase.kind !== "finished") return;
    finalBroadcast = true;
    expect(repository.history("a", "catan", 0, 20).matches).toHaveLength(1);
  });
  const result = registry.executeCommand(host.roomId, host.seatToken, "winning", before.revision, { type: "RollDice" });
  expect(result.room.game?.phase.kind).toBe("finished");
  expect(finalBroadcast).toBe(true);
  registry.executeCommand(host.roomId, host.seatToken, "winning", before.revision, { type: "RollDice" });
  expect(save).toHaveBeenCalledTimes(2); // Failed attempt and successful retry only.
  const history = repository.history("a", "catan", 0, 20).matches;
  expect(history[0]).toMatchObject({ gameId: "catan", dataVersion: 1, playerId: host.playerId, data: { winnerId: host.playerId, victoryPointsToWin: 5, ruleProfile: "base-3-4",
    players: room.members.map(({ id, name, color }) => ({ id, name, color })), summary: result.room.game?.summary } });
  expect(JSON.stringify(history)).not.toMatch(/"(seatToken|accountId|developmentCards|developmentDeck|password|history|mapSeed)":/);
  expect(registry.accountSeat("a")).toBeNull();
  expect(registry.createRoom("第二局", "a").roomId).not.toBe(host.roomId);
  registry.disbandRoom(host.roomId, host.seatToken);
  expect(repository.history("a", "catan", 0, 20).matches).toHaveLength(1);
  registry.dispose(); database.close();
});

it("never archives unfinished disbanded or abandoned rooms", () => {
  const database = new SqliteDatabase(":memory:"); const repository = new SqliteMatchRepository(database);
  const registry = new RoomRegistry({ now: () => 100 }); registry.configureMatchRepository(repository);
  const first = registry.createRoom("游客"); registry.joinRoom(first.roomId, "朋友"); registry.startRoom(first.roomId, first.seatToken);
  registry.disbandRoom(first.roomId, first.seatToken);
  registry.createRoom("另一位"); registry.evictIdleRooms(0);
  expect(database.db.prepare("SELECT count(*) n FROM match_results").get()?.n).toBe(0);
  registry.dispose(); database.close();
});
