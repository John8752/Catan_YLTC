import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDeck, DEFAULT_POKER_SETTINGS } from "@catan/game-core/texas-holdem";
import type { PokerAction, PokerCommand, PokerRoomView } from "@catan/protocol/texas-holdem";
import type { MatchRecord, RoomSession } from "@catan/protocol/platform";
import { RoomRegistry } from "../../rooms.js";
import { buildApp } from "../../app.js";
const registries: RoomRegistry[] = [];
afterEach(() => { registries.splice(0).forEach((r) => r.dispose()); vi.useRealTimers(); });
function setup(count = 2, settings = DEFAULT_POKER_SETTINGS) {
  const prefix = ["AS", "KS", "AD", "KD", "2C", "2D", "3H", "7C", "2H", "8D", "3C", "9S"] as ReturnType<typeof freshDeck>;
  const r = new RoomRegistry({ pokerDeck: () => [...prefix, ...freshDeck().filter((c) => !prefix.includes(c))] }); registries.push(r);
  const host = r.createRoom("房主", null, "texas-holdem");
  const seats = [host, ...Array.from({ length: count - 1 }, (_, i) => r.joinRoom(host.roomId, `朋友${i}`))];
  const room = r.getRoom(host.roomId, host.seatToken);
  r.updatePokerSettings(host.roomId, host.seatToken, room.revision, settings);
  r.startRoom(host.roomId, host.seatToken); return { r, host, seats };
}
function view(r: RoomRegistry, seat: RoomSession): PokerRoomView { const v = r.getRoom(seat.roomId, seat.seatToken); if (v.gameId !== "texas-holdem") throw Error("wrong game"); return v; }
function command(r: RoomRegistry, seat: RoomSession, action: PokerAction | { type: "next-hand" }): PokerCommand { const g = view(r, seat).game!; return { matchId: g.id, handNumber: g.handNumber, expectedRevision: g.revision, action }; }
function send(r: RoomRegistry, seat: RoomSession, action: PokerAction | { type: "next-hand" }, id = "cmd") { return r.executePokerCommand(seat.roomId, seat.seatToken, id, command(r, seat, action)); }
describe("texas-holdem server", () => {
  it("supports nine seats, caps capacity and privately projects websocket snapshots", () => {
    const { r, host, seats } = setup(9); const snapshots: PokerRoomView[] = [];
    r.subscribe(host.roomId, seats[1]!.seatToken, (room) => snapshots.push(room as PokerRoomView));
    expect(view(r, host).members).toHaveLength(9);
    const v = snapshots[0]!;
    expect(v.game!.players.filter((p) => p.hole !== null).map((p) => p.id)).toEqual([seats[1]!.playerId]);
    expect(JSON.stringify(v)).not.toContain("seatToken"); expect(v.game).not.toHaveProperty("deck");
    expect(() => r.joinRoom(host.roomId, "迟到")).toThrow();
    send(r, seats[3]!, { type: "call" });
    expect(snapshots).toHaveLength(2); expect(snapshots[1]!.game!.players[0]!.hole).toBeNull();
  });
  it("binds commands to match, revision and turn and deduplicates after advancement", () => {
    const { r, host, seats } = setup(); const c = command(r, host, { type: "call" });
    const next = r.executePokerCommand(host.roomId, host.seatToken, "once", c);
    expect(r.executePokerCommand(host.roomId, host.seatToken, "once", c)).toEqual(next);
    expect(() => r.executePokerCommand(host.roomId, host.seatToken, "twice", c)).toThrow();
    expect(() => send(r, host, { type: "fold" })).toThrow();
    expect(() => r.executePokerCommand(host.roomId, seats[1]!.seatToken, "old", { ...c, matchId: "old" })).toThrow();
    expect(view(r, seats[1]!).game!.players[0]!.chips).toBe(980);
  });
  it("times out to fold or check, never call, advances once and cancels on disband", () => {
    vi.useFakeTimers(); const { r, host } = setup();
    const before = view(r, host).game!;
    vi.advanceTimersByTime(30_000);
    expect(view(r, host).game!.phase.kind).toBe("hand-over");
    expect(view(r, host).game!.lastAction?.type).toBe("fold");
    vi.advanceTimersByTime(6000);
    expect(view(r, host).game!.handNumber).toBe(2);
    expect(view(r, host).game!.id).toBe(before.id);
    r.disbandRoom(host.roomId, host.seatToken); vi.advanceTimersByTime(100000); expect(r.roomCount).toBe(0);
  });
  it("checks on timeout when free, then gives the next actor a fresh deadline", () => {
    vi.useFakeTimers(); const { r, host, seats } = setup();
    send(r, host, { type: "call" }); vi.advanceTimersByTime(30_000);
    const v = view(r, seats[1]!).game!;
    expect(v.phase).toMatchObject({ street: "flop", actorId: seats[1]!.playerId });
    expect(v.lastAction?.type).toBe("check"); expect(v.deadline?.deadlineAt).toBe(Date.now() + 30_000);
  });
  it.each(["fixed-hands", "tournament"] as const)("settles %s without cards, then reopens with a unique match", (mode) => {
    const { r, host, seats } = setup(2, { ...DEFAULT_POKER_SETTINGS, mode, handLimit: 1 }); const records: MatchRecord[] = [];
    r.configureMatchRepository({ save: (record) => records.push(record), history: () => ({ matches: [], nextOffset: null }) });
    const id = view(r, host).matchId!;
    if (mode === "fixed-hands") send(r, host, { type: "fold" });
    else { send(r, host, { type: "all-in" }); send(r, seats[1]!, { type: "call" }); }
    expect(view(r, host).game!.phase.kind).toBe("finished");
    expect(records).toHaveLength(1); expect(records[0]!.data).toMatchObject({ mode, completedHands: 1 });
    expect(JSON.stringify(records)).not.toMatch(/hole|deck|board|seatToken/);
    const lobby = r.returnToLobby(host.roomId, host.seatToken, id); expect(lobby.game).toBeNull(); expect(lobby.gameId).toBe("texas-holdem");
    const next = r.startRoom(host.roomId, host.seatToken); expect(next.matchId).not.toBe(id);
    expect(() => r.executePokerCommand(host.roomId, host.seatToken, "old", { matchId: id, handNumber: 1, expectedRevision: 1, action: { type: "fold" } })).toThrow();
  });
  it("retries settlement timer failures without losing the final hand", () => {
    vi.useFakeTimers(); const { r, host } = setup(2, { ...DEFAULT_POKER_SETTINGS, handLimit: 1 });
    const save = vi.fn().mockImplementationOnce(() => { throw Error("disk"); }); const onError = vi.fn();
    r.configureMatchRepository({ save, history: () => ({ matches: [], nextOffset: null }) }, onError);
    vi.advanceTimersByTime(30_000); expect(view(r, host).game!.phase.kind).toBe("betting"); expect(onError).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(30_000); expect(view(r, host).game!.phase.kind).toBe("finished");
    vi.advanceTimersByTime(60000); expect(save).toHaveBeenCalledTimes(2);
  });
  it("accepts validated HTTP commands, rejects forged timeout/deck and protects settings", async () => {
    const { r, host, seats } = setup(); const app = await buildApp(r);
    try {
      const c = command(r, host, { type: "fold" });
      const post = (command: unknown) => app.inject({ method: "POST", url: `/api/rooms/${host.roomId}/texas-holdem/commands`, payload: { seatToken: host.seatToken, commandId: "http", command } });
      expect((await post({ ...c, action: { type: "expire" } })).statusCode).toBe(400);
      expect((await post({ ...c, deck: freshDeck() })).statusCode).toBe(400);
      expect((await post({ ...c, action: { type: "raise", to: 21 } })).statusCode).toBe(400);
      expect((await post(c)).statusCode).toBe(200);
      const retry = (await post(c)).json<PokerRoomView>(), current = view(r, host);
      expect({ ...retry.game, deadline: null }).toEqual({ ...current.game, deadline: null });
      expect(retry.game!.deadline!.deadlineAt).toBe(current.game!.deadline!.deadlineAt);
      expect(() => send(r, seats[1]!, { type: "next-hand" })).toThrow();
      expect(() => r.updatePokerSettings(host.roomId, host.seatToken, view(r, host).revision, DEFAULT_POKER_SETTINGS)).toThrow();
      const other = r.createRoom("卡坦");
      const wrong = await app.inject({ method: "POST", url: `/api/rooms/${other.roomId}/texas-holdem/commands`, payload: { seatToken: other.seatToken, commandId: "wrong", command: c } });
      expect(wrong.json()).toMatchObject({ error: { code: "WRONG_GAME" } });
    } finally { await app.close(); }
  });
});
