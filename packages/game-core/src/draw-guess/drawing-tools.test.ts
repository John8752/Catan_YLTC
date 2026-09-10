import { expect, it } from "vitest";
import { createDrawGuess, executeDrawGuess, taskFor, validatePage, type EditablePage } from "./index.js";

const ink = { color: "#e34b4b", width: 8, points: [[10, 10], [100, 100]] as const };
const eraser = { color: "#222222", width: 32, tool: "eraser" as const, points: [[50, 50]] as const };
it("preserves a colored background and eraser strokes through validation and timeout", () => {
  const page = { kind: "drawing" as const, background: "#fff3bf", strokes: [ink, eraser] };
  expect(validatePage(page, "drawing", false)).toEqual(page);
  let state = createDrawGuess("tools", ["a", "b", "c"].map((id) => ({ id, name: id })), 42);
  const opening = { ...page, kind: "opening" as const, word: state.suggestions.a![0]! };
  state = executeDrawGuess(state, "a", { type: "draft", matchId: state.id, taskId: taskFor(state, "a")!.id, sequence: 1, page: opening });
  state = executeDrawGuess(state, null, { type: "expire", matchId: state.id, step: 0 });
  expect(state.albums[0]?.pages[0]?.content).toEqual(opening);
});
it("rejects arbitrary backgrounds/tools/widths and does not accept eraser-only drawings", () => {
  for (const page of [
    { kind: "drawing", background: "url(secret)", strokes: [ink] },
    { kind: "drawing", strokes: [{ ...ink, tool: "stamp" }] },
    { kind: "drawing", strokes: [{ ...ink, width: 99 }] },
    { kind: "drawing", background: "#fff3bf", strokes: [eraser] },
  ]) expect(() => validatePage(page as EditablePage, "drawing", false)).toThrow();
  expect(validatePage({ kind: "drawing", strokes: [ink] }, "drawing", false)).toEqual({ kind: "drawing", strokes: [ink] });
});
