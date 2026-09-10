import { expect, it } from "vitest";
import { createDrawGuess, executeDrawGuess, taskFor } from "./index.js";

const players = ["a", "b", "c"].map((id) => ({ id, name: id }));
const strokes = [{ color: "#222222", width: 8, points: [[10, 20]] as const }];
it("requires an opening bank choice and the owner's own drawing", () => {
  const state = createDrawGuess("opening", players, 42);
  expect(taskFor(state, "a")?.kind).toBe("opening");
  expect(state.suggestions.a).toHaveLength(6);
  const command = { type: "submit" as const, matchId: state.id, taskId: taskFor(state, "a")!.id };
  expect(() => executeDrawGuess(state, "a", { ...command, page: { kind: "text", text: state.suggestions.a![0]! } })).toThrow();
  expect(() => executeDrawGuess(state, "a", { ...command, page: { kind: "opening", word: "自定义词", strokes } })).toThrow();
  expect(() => executeDrawGuess(state, "a", { ...command, page: { kind: "opening", word: state.suggestions.a![0]!, strokes: [] } })).toThrow();
  const next = executeDrawGuess(state, "a", { ...command, page: { kind: "opening", word: state.suggestions.a![0]!, strokes } });
  expect(next.albums[0]?.pages[0]).toMatchObject({ authorId: "a", content: { kind: "opening", word: state.suggestions.a![0], strokes } });
});

it("does not publish incomplete opening drafts on expiry", () => {
  let state = createDrawGuess("opening", players, 42);
  state = executeDrawGuess(state, "a", { type: "draft", matchId: state.id, taskId: taskFor(state, "a")!.id, sequence: 1,
    page: { kind: "opening", word: state.suggestions.a![0]!, strokes: [] } });
  state = executeDrawGuess(state, null, { type: "expire", matchId: state.id, step: 0 });
  expect(state.albums[0]?.pages[0]?.content).toEqual({ kind: "missing", expected: "opening" });
  expect(taskFor(state, "b")?.kind).toBe("text");
});
