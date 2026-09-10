import { expect, it } from "vitest";
import { createDrawGuess, executeDrawGuess, taskFor } from "./index.js";

const players = ["a", "b", "c"].map((id) => ({ id, name: id }));
const strokes = [{ color: "#222222", width: 8, points: [[10, 20]] as const }];
it("rerolls only an active opening, preserves ink, clears the word and fences older checkpoints", () => {
  const state = createDrawGuess("reroll", players, 42), taskId = taskFor(state, "a")!.id;
  const page = { kind: "opening" as const, word: state.suggestions.a![0]!, strokes, background: "#fff3bf" };
  const command = { type: "reroll" as const, matchId: state.id, taskId, sequence: 2, page };
  const next = executeDrawGuess(state, "a", command);
  expect(next).toEqual(executeDrawGuess(state, "a", command));
  expect(next.suggestions.a).toHaveLength(6);
  expect(next.suggestions.a!.every((word) => !Object.values(state.suggestions).flat().includes(word))).toBe(true);
  expect(next.suggestions.b).toEqual(state.suggestions.b);
  expect(next.drafts.a).toEqual({ sequence: 2, page: { ...page, word: "" } });
  expect(next.albums).toEqual(state.albums); expect(next.phase).toEqual(state.phase);
  expect(executeDrawGuess(next, "a", { ...command, type: "draft", sequence: 1 })).toBe(next);
  expect(() => executeDrawGuess(next, "a", command)).toThrow();
  expect(() => executeDrawGuess(next, "a", { type: "submit", matchId: state.id, taskId, page })).toThrow();
  expect(() => executeDrawGuess(state, "a", { ...command, page: { ...page, word: "任意词" } })).toThrow();
  const submitted = executeDrawGuess(next, "a", { type: "submit", matchId: state.id, taskId, page: { ...page, word: next.suggestions.a![0]! } });
  expect(() => executeDrawGuess(submitted, "a", { ...command, sequence: 3 })).toThrow();
  const later = executeDrawGuess(next, null, { type: "expire", matchId: state.id, step: 0 });
  expect(later.albums[0]!.pages[0]!.content.kind).toBe("missing");
  expect(() => executeDrawGuess(later, "a", { ...command, taskId: taskFor(later, "a")!.id })).toThrow();
});

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
