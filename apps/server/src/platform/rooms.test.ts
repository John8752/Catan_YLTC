import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatanRoomRecord } from "../games/catan/room-types.js";
import { RoomRegistry } from "../rooms.js";
import { buildApp } from "../app.js";
const registries: RoomRegistry[] = [];
afterEach(() => { for (const registry of registries.splice(0)) registry.dispose(); vi.useRealTimers(); });
function registry() { let seed = 42; const rooms = new RoomRegistry({ nextSeed: () => seed++ }); registries.push(rooms); return rooms; }
describe("platform room lifecycle", () => {
  it("selects a game at creation, enforces its capacity and rejects switching settings", async () => {
    const rooms = registry(); const app = await buildApp(rooms);
    try {
      const created = await app.inject({ method: "POST", url: "/api/rooms", payload: { playerName: "甲", gameId: "draw-guess" } });
      const host = created.json<{ roomId: string; seatToken: string; room: { gameId: string; revision: number } }>();
      expect(created.statusCode).toBe(201); expect(host.room.gameId).toBe("draw-guess"); expect(JSON.stringify(created.json())).not.toContain("previewMap");
      expect(() => rooms.startRoom(host.roomId, host.seatToken)).toThrow();
      const guest = rooms.joinRoom(host.roomId, "乙");
      expect(() => rooms.startRoom(host.roomId, guest.seatToken)).toThrow("房主");
      for (let i = 0; i < 4; i++) rooms.joinRoom(host.roomId, `朋友${i}`);
      expect(() => rooms.joinRoom(host.roomId, "第七位")).toThrow("满");
      expect((await app.inject({ method: "PATCH", url: `/api/rooms/${host.roomId}/settings`, payload: { seatToken: host.seatToken, expectedRevision: 6, gameId: "catan", ruleProfile: "extended-5-6", victoryPointsToWin: 10 } })).statusCode).toBe(400);
      expect((await app.inject({ method: "POST", url: "/api/rooms", payload: { playerName: "甲", gameId: "unknown" } })).statusCode).toBe(400);
      rooms.leaveRoom(host.roomId, host.seatToken); expect(rooms.getRoom(host.roomId, guest.seatToken).hostPlayerId).toBe(guest.playerId);
    } finally { await app.close(); }
  });
  it("shares optional identities across games and rotates all tokens before notifying the old login", () => {
    const rooms = registry(); const host = rooms.createRoom("甲", "account-a", "draw-guess");
    expect(rooms.createRoom("甲", "account-a", "catan").roomId).toBe(host.roomId);
    const guest = rooms.joinRoom(host.roomId, "乙"); let invalidDuringClose = false;
    rooms.subscribe(host.roomId, host.seatToken, () => {}, undefined, () => {
      try { rooms.getRoom(host.roomId, host.seatToken); } catch { invalidDuringClose = true; }
    });
    rooms.prepareAccountTakeover("account-a")(); expect(invalidDuringClose).toBe(true);
    const replacement = rooms.accountSeat("account-a")!;
    expect(replacement.room.gameId).toBe("draw-guess"); expect(replacement.playerId).toBe(host.playerId); expect(replacement.seatToken).not.toBe(host.seatToken);
    expect(JSON.stringify(rooms.getRoom(guest.roomId, guest.seatToken))).not.toContain("account-a");
  });
  it("gives Catan replays new match IDs and rejects old and unscoped legacy commands", () => {
    const rooms = registry(), host = rooms.createRoom("甲"); rooms.joinRoom(host.roomId, "乙");
    const first = rooms.startCatanRoom(host.roomId, host.seatToken);
    const records = (rooms as unknown as { rooms: Map<string, CatanRoomRecord> }).rooms;
    const room = records.get(host.roomId)!;
    // Fixture of a completed state; scoring legality is covered by Catan replay tests.
    room.game = { ...room.game!, phase: { kind: "finished", winnerId: host.playerId } };
    rooms.returnToLobby(host.roomId, host.seatToken, first.matchId!);
    const second = rooms.startCatanRoom(host.roomId, host.seatToken); expect(second.matchId).not.toBe(first.matchId);
    const command = { type: "PlaceInitialSettlement" as const, vertexId: second.game!.interaction.vertexIds[0]! };
    expect(() => rooms.executeCommand(host.roomId, host.seatToken, "old", second.game!.revision, command, "ack", first.matchId!)).toThrow("上一局");
    expect(() => rooms.executeCommand(host.roomId, host.seatToken, "legacy", second.game!.revision, command)).toThrow("旧客户端");
    expect(rooms.executeCommand(host.roomId, host.seatToken, "new", second.game!.revision, command, "ack", second.matchId!)).toMatchObject({ matchId: second.matchId });
  });
});
