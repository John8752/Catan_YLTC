import { describe, expect, it } from "vitest";
import type { CarcassonneRoomView, PlaceCommand } from "@catan/protocol/carcassonne";
import type { AnyRoomView, RoomSession } from "@catan/protocol/platform";
import { RoomRegistry } from "../../rooms.js";
import { buildApp } from "../../app.js";
import { CarcassonneRoomGame } from "./room-game.js";
import { createCarcassonne } from "@catan/game-core/carcassonne";
import { SqliteDatabase } from "../../database/sqlite-database.js";
import { SqliteAccountRepository } from "../../database/sqlite-account-repository.js";
import { SqliteMatchRepository } from "../../database/match-repository.js";
function view(registry: RoomRegistry, s: RoomSession): CarcassonneRoomView {
  const room = registry.getRoom(s.roomId, s.seatToken);
  if (room.gameId !== "carcassonne") throw Error("wrong game"); return room;
}
function move(room: CarcassonneRoomView): PlaceCommand {
  const g = room.game!; if (g.phase.kind !== "turn") throw Error("finished");
  const p = g.placements[0]!;
  return { type: "place", matchId: g.id, turn: g.phase.turn, x: p.x, y: p.y, rotation: p.rotation, meeple: p.meepleOptions[0] ?? null };
}
describe("carcassonne authoritative room", () => {
  it("keeps a final move retryable when settlement storage fails",()=>{
    let writes=0,notifications=0;
    const adapter=new CarcassonneRoomGame(()=>10,()=>{notifications++;});
    adapter.repository={save:()=>{if(++writes===1)throw Error("storage unavailable");},history:()=>({matches:[],nextOffset:null})};
    const people=[{id:'a',name:'甲',color:'pine' as const},{id:'b',name:'乙',color:'ocean' as const}];
    const room=adapter.create({id:'R',matchId:'match',startedAt:1,seed:1,revision:1,hostPlayerId:'a',members:people.map((p)=>({...p,accountId:null,seatToken:`seat-${p.id}`})),appliedCommands:new Set(),lastActiveAt:0});
    room.game={...createCarcassonne('match',people,1),board:[{id:'0,0',type:'B',x:0,y:0,rotation:0}],currentTile:'B',deck:[]};
    const command:PlaceCommand={type:'place',matchId:'match',turn:1,x:1,y:0,rotation:0,meeple:'m0'};
    expect(()=>adapter.command(room,'a','final',command)).toThrow(/storage/);
    expect(room.game.board).toHaveLength(1);expect(room.appliedCommands.size).toBe(0);expect(notifications).toBe(0);
    const done=adapter.command(room,'a','final',command);expect(done.game!.phase.kind).toBe('finished');
    adapter.command(room,'a','final',command);expect(writes).toBe(2);expect(notifications).toBe(1);
  });
  it("serves isolated HTTP moves, broadcasts, rejects invalid actors and deduplicates retries", async () => {
    const registry = new RoomRegistry(), app = await buildApp(registry);
    const host = registry.createRoom("甲", null, "carcassonne"), guest = registry.joinRoom(host.roomId, "乙");
    registry.startRoom(host.roomId, host.seatToken);
    const seen: AnyRoomView[] = [];
    const unsubscribe = registry.subscribe(host.roomId, guest.seatToken, (r) => seen.push(r));
    try {
      const command = move(view(registry, host)), url = `/api/rooms/${host.roomId}/carcassonne/commands`;
      const bad = await app.inject({ method: "POST", url, payload: { seatToken: guest.seatToken, commandId: "bad", command } });
      expect(bad.statusCode).toBe(400);
      expect(view(registry, host).game!.board).toHaveLength(1);
      const payload = { seatToken: host.seatToken, commandId: "move-1", command };
      const response = await app.inject({ method: "POST", url, payload }); expect(response.statusCode).toBe(200);
      expect(response.json<CarcassonneRoomView>().game!.board).toHaveLength(2);
      expect(seen.at(-1)?.game?.revision).toBe(2);
      const retry = await app.inject({ method: "POST", url, payload }); expect(retry.statusCode).toBe(200);
      expect(retry.json<CarcassonneRoomView>().revision).toBe(response.json<CarcassonneRoomView>().revision);
      expect(seen).toHaveLength(2);
      const forged = await app.inject({ method: "POST", url, payload: { ...payload, commandId: "forged", command: { ...command, rotation: 9 } } });
      expect(forged.statusCode).toBe(400);
      expect(view(registry, guest).game!.placements.length).toBeGreaterThan(0);
      expect(JSON.stringify(seen.at(-1))).not.toMatch(/"deck"|"seed"|seatToken/);
    } finally { unsubscribe(); await app.close(); }
  });
  it("completes a five-seat game, settles only final safe results and starts a fresh match", () => {
    let seed = 40; const registry = new RoomRegistry({ nextSeed: () => ++seed });
    const database=new SqliteDatabase(":memory:"),repository=new SqliteMatchRepository(database);
    new SqliteAccountRepository(database).insert({id:"account-a",username:"test-owner",displayName:"甲",passwordHash:"test-only",status:"active"},1);
    registry.configureMatchRepository(repository);
    const host = registry.createRoom("甲", "account-a", "carcassonne");
    const sessions = [host, ...Array.from({ length: 4 }, (_, i) => registry.joinRoom(host.roomId, `朋友${i}`))];
    expect(() => registry.joinRoom(host.roomId, "第六位")).toThrow(/满/);
    registry.startRoom(host.roomId, host.seatToken);
    const match = view(registry, host).matchId!;
    expect(repository.history("account-a","carcassonne",0,20).matches).toHaveLength(0);
    let turns = 0;
    while (view(registry, host).game!.phase.kind === "turn") {
      const g = view(registry, host).game!, actor = sessions.find((s) => g.phase.kind === "turn" && s.playerId === g.phase.playerId)!;
      registry.executeCarcassonneCommand(host.roomId, actor.seatToken, `move-${turns++}`, move(view(registry, actor)));
      expect(turns).toBeLessThanOrEqual(71);
    }
    const results=repository.history("account-a","carcassonne",0,20).matches;
    expect(results).toHaveLength(1);
    expect(repository.history("account-a","catan",0,20).matches).toHaveLength(0);
    expect(database.integrity()).toBe(true);
    expect(results[0]).toMatchObject({ gameId: "carcassonne", matchId: match, dataVersion: 1 });
    expect(JSON.stringify(results[0])).not.toMatch(/"board"|"deck"|seatToken/);
    expect(view(registry, host).game!.board.length + view(registry, host).game!.discardedCount).toBe(72);
    registry.returnToLobby(host.roomId, host.seatToken, match);
    const fresh = registry.startRoom(host.roomId, host.seatToken);
    expect(fresh.gameId).toBe("carcassonne"); expect(fresh.matchId).not.toBe(match);
    expect(() => registry.executeCarcassonneCommand(host.roomId, host.seatToken, "old", { ...move(view(registry, host)), matchId: match })).toThrow(/上一局/);
    registry.dispose();database.close();
  });
  it("rotates linked credentials before replacement and recovers the same Carcassonne seat", () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom("甲", "account-a", "carcassonne"); registry.joinRoom(host.roomId, "乙"); registry.startRoom(host.roomId, host.seatToken);
    let rotatedBeforeClose = false;
    registry.subscribe(host.roomId, host.seatToken, () => {}, undefined, () => { rotatedBeforeClose = registry.accountSeat("account-a")!.seatToken !== host.seatToken; });
    registry.prepareAccountTakeover("account-a")();
    expect(rotatedBeforeClose).toBe(true);
    expect(() => registry.getRoom(host.roomId, host.seatToken)).toThrow();
    const recovered = registry.accountSeat("account-a")!;
    expect(recovered.playerId).toBe(host.playerId); expect(recovered.room.gameId).toBe("carcassonne");
    registry.dispose();
  });
});
