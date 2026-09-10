import { describe, expect, it } from "vitest";
import { createDrawGuess, executeDrawGuess, taskFor, requiredGuessLength, type DrawGuessState } from "./index.js";

const drawing = { kind: "drawing" as const, strokes: [{ color: "#222222", width: 8, points: [[10, 20], [50, 60]] as readonly (readonly [number, number])[] }] };
function opening(state: DrawGuessState, id: string) { return { ...drawing, kind: "opening" as const, word: state.suggestions[id]![0]! }; }
function game(count = 6) { return createDrawGuess("match-1", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `玩家${i}` })), 42); }
function finishWork(state: DrawGuessState) {
  while (state.phase.kind === "work") {
    for (const player of state.players) {
      const task = taskFor(state, player.id)!;
      state = executeDrawGuess(state, player.id, { type: "submit", matchId: state.id, taskId: task.id,
        page: task.kind === "opening" ? opening(state, player.id) : task.kind === "drawing" ? drawing : { kind: "text", text: "猜".repeat(requiredGuessLength(state, task) ?? 3) } });
    }
  }
  return state;
}
describe("draw-guess deterministic rules", () => {
  it.each([3, 4, 5, 6])("routes %i simultaneous players through every album exactly once", (count) => {
    const state = finishWork(game(count));
    expect(state.phase).toEqual({ kind: "reveal", cursor: 0 });
    expect(state.albums).toHaveLength(count);
    for (const album of state.albums) {
      expect(album.pages).toHaveLength(count);
      expect(new Set(album.pages.map((page) => page.authorId)).size).toBe(count);
      expect(album.pages.map((page) => page.content.kind)).toEqual(Array.from({ length: count }, (_, step) => step === 0 ? "opening" : step % 2 ? "text" : "drawing"));
    }
    expect(finishWork(game(count))).toEqual(state);
  });
  it("does not reject a player's valid task when another player submits", () => {
    const initial = game(); const task = taskFor(initial, "p1")!;
    const afterFirst = executeDrawGuess(initial, "p0", { type: "submit", matchId: initial.id, taskId: taskFor(initial, "p0")!.id, page: opening(initial, "p0") });
    const afterSecond = executeDrawGuess(afterFirst, "p1", { type: "submit", matchId: initial.id, taskId: task.id, page: opening(initial, "p1") });
    expect(afterSecond.albums[1]!.pages[0]!.content).toEqual(opening(initial, "p1"));
  });
  it("keeps monotonic drafts and times out missing players without blocking", () => {
    let state = game(3); const task = taskFor(state, "p0")!;
    state = executeDrawGuess(state, "p0", { type: "draft", matchId: state.id, taskId: task.id, sequence: 2, page: opening(state, "p0") });
    expect(executeDrawGuess(state, "p0", { type: "draft", matchId: state.id, taskId: task.id, sequence: 1, page: { ...opening(state, "p0"), word: state.suggestions.p0![1]! } })).toBe(state);
    state = executeDrawGuess(state, null, { type: "expire", matchId: state.id, step: 0 });
    expect(state.phase).toEqual({ kind: "work", step: 1 });
    expect(state.albums[0]!.pages[0]!.content).toEqual(opening(state, "p0"));
    expect(state.albums[1]!.pages[0]!.content.kind).toBe("missing");
    expect(() => executeDrawGuess(state, null, { type: "expire", matchId: state.id, step: 0 })).toThrow();
  });
  it("rejects wrong match, forged tasks, editing submitted pages and empty text", () => {
    const state = game(); const command = { type: "submit" as const, matchId: state.id, taskId: taskFor(state, "p0")!.id, page: opening(state, "p0") };
    expect(() => executeDrawGuess(state, "p0", { ...command, matchId: "old" })).toThrow();
    expect(() => executeDrawGuess(state, "p1", command)).toThrow();
    expect(() => executeDrawGuess(state, "p0", { ...command, page: { kind: "text", text: "  " } })).toThrow();
    expect(() => executeDrawGuess(executeDrawGuess(state, "p0", command), "p0", command)).toThrow();
  });
  it("enforces server-only sequential reveal and holds the last page before finishing", () => {
    let state = finishWork(game(3));
    expect(() => executeDrawGuess(state, "p1", { type: "reveal", matchId: state.id, expectedCursor: 0 })).toThrow();
    for (let cursor = 0; cursor <= 9; cursor++) state = executeDrawGuess(state, null, { type: "reveal", matchId: state.id, expectedCursor: cursor });
    expect(state.phase).toEqual({ kind: "finished" });
  });
  it("validates drawing bounds without mutating the input", () => {
    const initial = game(3);
    const expired = executeDrawGuess(initial, null, { type: "expire", matchId: initial.id, step: 0 });
    const state = executeDrawGuess(expired, null, { type: "expire", matchId: initial.id, step: 1 });
    const task = taskFor(state, "p0")!;
    expect(() => executeDrawGuess(state, "p0", { type: "submit", matchId: state.id, taskId: task.id, page: { ...drawing, strokes: [{ ...drawing.strokes[0]!, points: [[NaN, 3]] }] } })).toThrow();
    expect(state.revision).toBe(2); expect(initial.revision).toBe(0);
  });
});
