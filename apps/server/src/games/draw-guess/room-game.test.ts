import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnyRoomView, RoomSession, MatchRecord } from "@catan/protocol/platform";
import { REVEAL_INTERVAL_MS, type DrawGuessRoomView } from "@catan/protocol/draw-guess";
import { RoomRegistry } from "../../rooms.js";
import { buildApp } from "../../app.js";

const registries: RoomRegistry[] = [];
afterEach(() => { for (const registry of registries.splice(0)) registry.dispose(); vi.useRealTimers(); });
function setup(count = 6, accountId: string | null = "account-a") {
  let seed = 40;
  const registry = new RoomRegistry({ nextSeed: () => ++seed }); registries.push(registry);
  const host = registry.createRoom("甲", accountId, "draw-guess");
  const sessions = [host, ...Array.from({ length: count - 1 }, (_, i) => registry.joinRoom(host.roomId, `朋友${i}`))];
  registry.startRoom(host.roomId, host.seatToken);
  return { registry, host, sessions };
}
function view(registry: RoomRegistry, session: RoomSession): DrawGuessRoomView {
  const room = registry.getRoom(session.roomId, session.seatToken); if (room.gameId !== "draw-guess") throw Error("wrong game"); return room;
}
function finishWork(registry: RoomRegistry, sessions: RoomSession[]) {
  for (let step = 0; step < sessions.length; step++) {
    const views = sessions.map((session) => view(registry, session));
    sessions.forEach((session, i) => { const game = views[i]!.game!, task = game.task!;
      registry.executeDrawCommand(session.roomId, session.seatToken, `submit-${step}-${i}`, { type: "submit", matchId: game.id, taskId: task.id,
        page: task.kind === "opening" ? { kind: "opening", word: task.suggestions[0]!, strokes: [{ color: "#222222", width: 8, points: [[5, 5], [50, 50]] }] } : task.kind === "drawing" ? { kind: "drawing", strokes: [{ color: "#222222", width: 8, points: [[5, 5], [50, 50]] }] } : { kind: "text", text: `PRIVATE_${step}_${i}` } }); });
  }
}
describe("draw-guess server", () => {
  it.each([3, 4, 5, 6])("accepts all %i same-snapshot submissions, reveals in order, settles and replays in-place", (count) => {
    vi.useFakeTimers();
    const { registry, sessions, host } = setup(count);
    const records: MatchRecord[] = [];
    registry.configureMatchRepository({ save: (record) => records.push(record), history: () => ({ matches: [], nextOffset: null }) });
    const before = view(registry, host).game!;
    finishWork(registry, sessions);
    expect(view(registry, host).game?.phase).toEqual({ kind: "reveal", cursor: 0 });
    expect(() => registry.returnToLobby(host.roomId, host.seatToken, before.id)).toThrow();
    for (let cursor = 0; cursor < count ** 2; cursor++) {
      vi.advanceTimersByTime(REVEAL_INTERVAL_MS);
      expect(view(registry, host).game?.albums.flatMap((album) => album.pages)).toHaveLength(cursor + 1);
      expect(view(registry, sessions[1]!).game?.phase).toEqual({ kind: "reveal", cursor: cursor + 1 });
    }
    expect(records).toHaveLength(0);
    vi.advanceTimersByTime(REVEAL_INTERVAL_MS);
    expect(view(registry, host).game?.phase.kind).toBe("finished");
    expect(records).toHaveLength(1); expect(records[0]).toMatchObject({ gameId: "draw-guess", matchId: before.id, dataVersion: 1 });
    expect(JSON.stringify(records)).not.toContain("PRIVATE_"); expect(JSON.stringify(records)).not.toContain("strokes");
    const lobby = registry.returnToLobby(host.roomId, host.seatToken, before.id);
    expect(lobby.gameId).toBe("draw-guess"); expect(lobby.game).toBeNull(); expect(lobby.matchId).toBeNull(); expect(lobby.members).toHaveLength(count);
    const newMatch = registry.startRoom(host.roomId, host.seatToken);
    expect(newMatch.matchId).not.toBe(before.id);
    expect(() => registry.executeDrawCommand(host.roomId, host.seatToken, "old-submit", { type: "submit", matchId: before.id, taskId: before.task!.id, page: { kind: "text", text: "上一局" } })).toThrow();
  });
  it("keeps drafts private, ignores stale sequences, survives disconnect and times out once", () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    const { registry, host, sessions } = setup(3); const guest = sessions[1]!;
    const updates: AnyRoomView[] = [];
    registry.subscribe(host.roomId, guest.seatToken, (room) => updates.push(room));
    const game = view(registry, host).game!;
    const command = { type: "draft" as const, matchId: game.id, taskId: game.task!.id, sequence: 2, page: { kind: "opening" as const, word: game.task!.suggestions[0]!, strokes: [{ color: "#222222", width: 8, points: [[5, 5]] as const }] } };
    registry.executeDrawCommand(host.roomId, host.seatToken, "draft", command);
    registry.executeDrawCommand(host.roomId, host.seatToken, "older", { ...command, sequence: 1, page: { ...command.page, word: game.task!.suggestions[1]! } });
    expect(updates).toHaveLength(1); expect(JSON.stringify(view(registry, guest))).not.toContain(command.page.word);
    expect(view(registry, host).game?.task?.draft?.sequence).toBe(2);
    vi.advanceTimersByTime(90_000);
    expect(view(registry, host).game?.phase).toEqual({ kind: "work", step: 1 }); expect(updates).toHaveLength(2);
    expect(view(registry, guest).game?.task?.input).toEqual({ kind: "drawing", strokes: command.page.strokes });
    const deadline = view(registry, host).game?.deadline;
    expect(deadline?.deadlineAt).toBe(Date.now() + 60_000);
    expect(() => registry.executeDrawCommand(host.roomId, host.seatToken, "late", command)).toThrow();
    registry.disbandRoom(host.roomId, host.seatToken); vi.advanceTimersByTime(300_000); expect(registry.roomCount).toBe(0);
  });
  it("automatically retries a failed final settlement without losing or duplicating it", () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { registry, host, sessions } = setup(3); finishWork(registry, sessions);
      vi.advanceTimersByTime(REVEAL_INTERVAL_MS * 9);
      const save = vi.fn().mockImplementationOnce(() => { throw Error("disk full"); });
      registry.configureMatchRepository({ save, history: () => ({ matches: [], nextOffset: null }) });
      vi.advanceTimersByTime(REVEAL_INTERVAL_MS);
      expect(view(registry, host).game?.phase).toEqual({ kind: "reveal", cursor: 9 });
      vi.advanceTimersByTime(REVEAL_INTERVAL_MS);
      expect(view(registry, host).game?.phase.kind).toBe("finished");
      vi.advanceTimersByTime(REVEAL_INTERVAL_MS * 5);
      expect(save).toHaveBeenCalledTimes(2);
    } finally { log.mockRestore(); }
  });
  it("continues revealing after the host disconnects and cancels timers on disband", () => {
    vi.useFakeTimers();
    const { registry, host, sessions } = setup(3);
    const disconnect = registry.subscribe(host.roomId, host.seatToken, () => {});
    finishWork(registry, sessions); disconnect();
    vi.advanceTimersByTime(REVEAL_INTERVAL_MS * 2);
    expect(view(registry, sessions[1]!).game?.phase).toEqual({ kind: "reveal", cursor: 2 });
    registry.disbandRoom(host.roomId, host.seatToken);
    vi.advanceTimersByTime(REVEAL_INTERVAL_MS * 20);
    expect(registry.roomCount).toBe(0);
  });
  it("deduplicates an opening submission after advancement without restarting the deadline", () => {
    vi.useFakeTimers();
    const { registry, host, sessions } = setup(3);
    const game = view(registry, host).game!;
    const command = { type: "submit" as const, matchId: game.id, taskId: game.task!.id, page: { kind: "opening" as const, word: game.task!.suggestions[0]!, strokes: [{ color: "#222222", width: 8, points: [[1, 2]] as const }] } };
    registry.executeDrawCommand(host.roomId, host.seatToken, "opening", command);
    vi.advanceTimersByTime(90_000);
    const deadline = view(registry, sessions[1]!).game?.deadline?.deadlineAt;
    const duplicate = registry.executeDrawCommand(host.roomId, host.seatToken, "opening", command);
    expect(duplicate.game?.phase).toEqual({ kind: "work", step: 1 });
    expect(duplicate.game?.deadline?.deadlineAt).toBe(deadline);
  });
  it("validates HTTP game scope, rejects forged expiry and oversized drawing payloads", async () => {
    const { registry, host } = setup(3, null); const app = await buildApp(registry);
    try {
      const game = view(registry, host).game!;
      const post = (command: unknown) => app.inject({ method: "POST", url: `/api/rooms/${host.roomId}/draw-guess/commands`, payload: { seatToken: host.seatToken, commandId: "x", command } });
      expect((await post({ type: "expire", matchId: game.id, step: 0 })).statusCode).toBe(400);
      expect((await post({ type: "reveal", matchId: game.id, expectedCursor: 0 })).statusCode).toBe(400);
      expect((await post({ type: "submit", matchId: game.id, taskId: game.task!.id, page: { kind: "text", text: "a".repeat(81) } })).statusCode).toBe(400);
      expect((await app.inject({ method: "POST", url: `/api/rooms/${host.roomId}/commands`, payload: { seatToken: host.seatToken, expectedRevision: 1, commandId: "x", command: { type: "RollDice" } } })).json()).toMatchObject({ error: { code: "WRONG_GAME" } });
      const catan = registry.createRoom("卡坦玩家");
      expect((await app.inject({ method: "POST", url: `/api/rooms/${catan.roomId}/draw-guess/commands`, payload: { seatToken: catan.seatToken, commandId: "x", command: { type: "submit", matchId: "fake", taskId: "fake", page: { kind: "text", text: "hi" } } } })).json()).toMatchObject({ error: { code: "WRONG_GAME" } });
    } finally { await app.close(); }
  });
});
