import { expect, it } from "vitest";
import { RoomRegistry } from "../../rooms.js";
import { SqliteDatabase } from "../../database/sqlite-database.js";
import { SqliteAccountRepository } from "../../database/sqlite-account-repository.js";
import { SqliteMatchRepository } from "../../database/match-repository.js";
import { DEFAULT_POKER_SETTINGS } from "@catan/protocol/texas-holdem";
import type { PokerRoomView, PokerSettlementV1 } from "@catan/protocol/texas-holdem";

it("persists only immutable final poker rankings linked to the correct account", () => {
  const db = new SqliteDatabase(":memory:"), accounts = new SqliteAccountRepository(db), repository = new SqliteMatchRepository(db), r = new RoomRegistry();
  accounts.insert({ id: "a", username: "alice", displayName: "甲", passwordHash: "private-password-hash", status: "active" }, 1);
  accounts.insert({ id: "b", username: "bob", displayName: "乙", passwordHash: "other-private-hash", status: "active" }, 1);
  r.configureMatchRepository(repository);
  try {
    const host = r.createRoom("甲", "a", "texas-holdem"), guest = r.joinRoom(host.roomId, "乙", "b");
    const lobby = r.getRoom(host.roomId, host.seatToken);
    r.updatePokerSettings(host.roomId, host.seatToken, lobby.revision, { ...DEFAULT_POKER_SETTINGS, handLimit: 1 });
    r.startRoom(host.roomId, host.seatToken);
    expect(repository.history("a", "texas-holdem", 0, 20).matches).toEqual([]);
    const game = (r.getRoom(host.roomId, host.seatToken) as PokerRoomView).game!;
    r.executePokerCommand(host.roomId, host.seatToken, "fold", { matchId: game.id, handNumber: 1, expectedRevision: game.revision, action: { type: "fold" } });
    const history = repository.history("a", "texas-holdem", 0, 20), other = repository.history("b", "texas-holdem", 0, 20);
    expect(history.matches).toHaveLength(1); expect(other.matches).toHaveLength(1);
    expect(history.matches[0]!.playerId).toBe(host.playerId); expect(other.matches[0]!.playerId).toBe(guest.playerId);
    const data = history.matches[0]!.data as PokerSettlementV1; expect(data.standings.map((p) => p.chips)).toEqual([1010, 990]);
    expect(history.matches[0]).toMatchObject({ gameId: "texas-holdem", matchId: game.id, dataVersion: 1 });
    expect(repository.history("a", "catan", 0, 20).matches).toEqual([]);
    expect(JSON.stringify(history)).not.toMatch(/hole|deck|board|seatToken|password|alice/);
    r.returnToLobby(host.roomId, host.seatToken, game.id); r.startRoom(host.roomId, host.seatToken);
    expect(repository.history("a", "texas-holdem", 0, 20)).toEqual(history);
  } finally { r.dispose(); db.close(); }
});
