import { describe, expect, it } from "vitest";
import { createDrawGuess, executeDrawGuess, taskFor, type DrawGuessState } from "./index.js";

const drawing = { kind: "drawing" as const, strokes: [{ color: "#222222", width: 8, points: [[10, 20], [50, 60]] as readonly (readonly [number, number])[] }] };
function game(count = 6) { return createDrawGuess("match-1", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `玩家${i}` })), 42); }
function finishWork(state: DrawGuessState) {
  while (state.phase.kind === "work") {
    for (const player of state.players) {
      const task = taskFor(state, player.id)!;
      state = executeDrawGuess(state, player.id, { type: "submit", matchId: state.id, taskId: task.id,
        page: task.kind === "drawing" ? drawing : { kind: "text", text: `词语${task.id}` } });
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
      expect(album.pages.map((page) => page.content.kind)).toEqual(Array.from({ length: count }, (_, step) => step % 2 ? "drawing" : "text"));
    }
    expect(finishWork(game(count))).toEqual(state);
  });
  it("does not reject a player's valid task when another player submits", () => {
    const initial = game(); const task = taskFor(initial, "p1")!;
    const afterFirst = executeDrawGuess(initial, "p0", { type: "submit", matchId: initial.id, taskId: taskFor(initial, "p0")!.id, page: { kind: "text", text: "会飞的面条" } });
    const afterSecond = executeDrawGuess(afterFirst, "p1", { type: "submit", matchId: initial.id, taskId: task.id, page: { kind: "text", text: "熊猫修水管" } });
    expect(afterSecond.albums[1]!.pages[0]!.content).toEqual({ kind: "text", text: "熊猫修水管" });
  });
  it("keeps monotonic drafts and times out missing players without blocking", () => {
    let state = game(3); const task = taskFor(state, "p0")!;
    state = executeDrawGuess(state, "p0", { type: "draft", matchId: state.id, taskId: task.id, sequence: 2, page: { kind: "text", text: "最新草稿" } });
    expect(executeDrawGuess(state, "p0", { type: "draft", matchId: state.id, taskId: task.id, sequence: 1, page: { kind: "text", text: "旧草稿" } })).toBe(state);
    state = executeDrawGuess(state, null, { type: "expire", matchId: state.id, step: 0 });
    expect(state.phase).toEqual({ kind: "work", step: 1 });
    expect(state.albums[0]!.pages[0]!.content).toEqual({ kind: "text", text: "最新草稿" });
    expect(state.albums[1]!.pages[0]!.content.kind).toBe("missing");
    expect(() => executeDrawGuess(state, null, { type: "expire", matchId: state.id, step: 0 })).toThrow();
  });
  it("rejects wrong match, forged tasks, editing submitted pages and empty text", () => {
    const state = game(); const command = { type: "submit" as const, matchId: state.id, taskId: taskFor(state, "p0")!.id, page: { kind: "text" as const, text: "原稿" } };
    expect(() => executeDrawGuess(state, "p0", { ...command, matchId: "old" })).toThrow();
    expect(() => executeDrawGuess(state, "p1", command)).toThrow();
    expect(() => executeDrawGuess(state, "p0", { ...command, page: { kind: "text", text: "  " } })).toThrow();
    expect(() => executeDrawGuess(executeDrawGuess(state, "p0", command), "p0", command)).toThrow();
  });
  it("enforces host-only sequential reveal and finishes exactly at the last page", () => {
    let state = finishWork(game(3));
    expect(() => executeDrawGuess(state, "p1", { type: "reveal", matchId: state.id, expectedCursor: 0 }, "p0")).toThrow();
    for (let cursor = 0; cursor < 9; cursor++) state = executeDrawGuess(state, "p0", { type: "reveal", matchId: state.id, expectedCursor: cursor }, "p0");
    expect(state.phase).toEqual({ kind: "finished" });
  });
  it("validates drawing bounds without mutating the input", () => {
    const initial = game(3);
    const state = executeDrawGuess(initial, null, { type: "expire", matchId: initial.id, step: 0 });
    const task = taskFor(state, "p0")!;
    expect(() => executeDrawGuess(state, "p0", { type: "submit", matchId: state.id, taskId: task.id, page: { ...drawing, strokes: [{ ...drawing.strokes[0]!, points: [[NaN, 3]] }] } })).toThrow();
    expect(state.revision).toBe(1); expect(initial.revision).toBe(0);
  });
});
