import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatanRoomRecord } from "../games/catan/room-types.js";
import { RoomRegistry } from "../rooms.js";
import { buildApp } from "../app.js";
import { DrawGuessRoomGame } from "../games/draw-guess/room-game.js";
import type { GameType } from "@catan/protocol/platform";
const registries: RoomRegistry[] = [];
afterEach(() => { for (const registry of registries.splice(0)) registry.dispose(); vi.useRealTimers(); });
function registry() { let seed = 42; const rooms = new RoomRegistry({ nextSeed: () => seed++ }); registries.push(rooms); return rooms; }
describe("platform room lifecycle", () => {
  it("requires players to specify a supported game when creating a room",async()=>{
    const rooms=registry(),app=await buildApp(rooms);
    try{
      for(const gameId of [undefined,null,"","unknown"]){
        const response=await app.inject({method:"POST",url:"/api/rooms",payload:{playerName:"明确选游戏",gameId}});
        expect(response.statusCode).toBe(400);expect(rooms.roomCount).toBe(0);
      }
      expect(()=>rooms.createRoom("未选择",null,undefined as unknown as GameType)).toThrow(/未知游戏|未注册/);
    } finally {await app.close();}
  });
  it("does not borrow drawing capacity for another game", () => {
    const capacity=vi.spyOn(DrawGuessRoomGame.prototype,"capacity").mockReturnValue(1);
    try {
      const rooms=registry();
      for(const [gameId,limit] of [["camel-up",6],["carcassonne",5],["catan",4]] as const){
        const host=rooms.createRoom("房主",null,gameId);
        for(let i=1;i<limit;i++)rooms.joinRoom(host.roomId,`朋友${i}`);
        expect(()=>rooms.joinRoom(host.roomId,"多余玩家")).toThrow("满");
      }
      expect(capacity).not.toHaveBeenCalled();
    } finally { capacity.mockRestore(); }
  });
  it("rejects an unknown stored game instead of projecting another game's lobby", () => {
    const rooms=registry(),host=rooms.createRoom("房主",null,"carcassonne");
    const records=(rooms as unknown as {rooms:Map<string,{gameId:string}>}).rooms;
    records.get(host.roomId)!.gameId="unregistered-game";
    expect(()=>rooms.getRoom(host.roomId,host.seatToken)).toThrow(/未知游戏|未注册/);
    expect(()=>rooms.createRoom("房主",null,"unregistered-game" as GameType)).toThrow(/未知游戏|未注册/);
  });
  it("keeps game settings local to their room and rejects settings for another game",()=>{
    const rooms=registry(),draw=rooms.createRoom("画家",null,"draw-guess"),otherDraw=rooms.createRoom("画家乙",null,"draw-guess"),
      catan=rooms.createRoom("岛主",null,"catan"),otherCatan=rooms.createRoom("岛主乙",null,"catan");
    rooms.updateDrawSettings(draw.roomId,draw.seatToken,draw.room.revision,{textSeconds:30,drawingSeconds:60});
    rooms.updateSettings(catan.roomId,catan.seatToken,catan.room.revision,{ruleProfile:"extended-5-6",victoryPointsToWin:12});
    expect(rooms.getRoom(otherDraw.roomId,otherDraw.seatToken)).toMatchObject({settings:otherDraw.room.gameId==='draw-guess'?otherDraw.room.settings:{}});
    expect(rooms.getRoom(otherCatan.roomId,otherCatan.seatToken)).toMatchObject({settings:{ruleProfile:"base-3-4",victoryPointsToWin:10}});
    for(const gameId of ["camel-up","carcassonne"] as const){
      const host=rooms.createRoom("房主",null,gameId);
      expect(()=>rooms.updateDrawSettings(host.roomId,host.seatToken,host.room.revision,{textSeconds:30,drawingSeconds:60})).toThrow("传画猜词");
      expect(()=>rooms.updateSettings(host.roomId,host.seatToken,host.room.revision,{ruleProfile:"base-3-4",victoryPointsToWin:10})).toThrow("卡坦");
      expect(rooms.getRoom(host.roomId,host.seatToken)).not.toHaveProperty("settings");
    }
  });
  it.each([["camel-up", 6], ["carcassonne", 5]] as const)("keeps %s seat capacity independent when both adapters coexist", (gameId, capacity) => {
    const rooms = registry(), host = rooms.createRoom("房主", null, gameId);
    for (let i = 1; i < capacity; i++) rooms.joinRoom(host.roomId, `朋友${i}`);
    expect(rooms.getRoom(host.roomId, host.seatToken)).toMatchObject({ gameId });
    expect(rooms.getRoom(host.roomId, host.seatToken).members).toHaveLength(capacity);
    expect(() => rooms.joinRoom(host.roomId, "超额座位")).toThrow("满");
  });
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
    expect(rooms.createRoom("甲", "account-a", "draw-guess").roomId).toBe(host.roomId);
    expect(()=>rooms.createRoom("甲","account-a","catan")).toThrow("先离开");
    const another=rooms.createRoom("另一个房主",null,"camel-up");
    expect(()=>rooms.joinRoom(another.roomId,"甲","account-a")).toThrow("先离开");
    expect(rooms.joinRoom(host.roomId,"甲","account-a").roomId).toBe(host.roomId);
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
    const rooms = registry(), host = rooms.createRoom("甲", null, "catan"); rooms.joinRoom(host.roomId, "乙");
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
