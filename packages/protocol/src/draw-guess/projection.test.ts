import { createDrawGuess, executeDrawGuess, taskFor, type DrawGuessState, type EditablePage } from "@catan/game-core/draw-guess";
import { expect, it } from "vitest";
import { projectDrawGuess } from "./index.js";
const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));
const strokes = [{ color: "#222222", width: 8, points: [[12, 34]] as const }];
function submit(state: DrawGuessState, id: string, page: EditablePage) {
  return executeDrawGuess(state, id, { type: "submit", matchId: state.id, taskId: taskFor(state, id)!.id, page });
}
it("keeps choices, opening words and drafts private while exposing only a drawing and length", () => {
  let state = createDrawGuess("match", players, 71);
  const word = state.suggestions.a![0]!;
  state = executeDrawGuess(state, "a", { type: "draft", matchId: state.id, taskId: taskFor(state, "a")!.id, sequence: 1, page: { kind: "opening", word, strokes } });
  expect(JSON.stringify(projectDrawGuess(state, "b", null))).not.toContain(word);
  expect(projectDrawGuess(state, "a", null).task?.draft?.page).toEqual({ kind: "opening", word, strokes });
  for (const player of players) state = submit(state, player.id, { kind: "opening", word: state.suggestions[player.id]![0]!, strokes });
  const guesser = projectDrawGuess(state, "b", null);
  expect(guesser.task).toMatchObject({ kind: "text", input: { kind: "drawing", strokes }, hintLength: [...word].length, suggestions: [], draft: null });
  for (const choices of Object.values(state.suggestions)) for (const secret of choices) expect(JSON.stringify(guesser)).not.toContain(secret);
  expect(guesser.albums).toEqual([]); expect(guesser.narration).toBeNull();
  for (const player of players) state = submit(state, player.id, { kind: "text", text: "猫 🐈 上 天" });
  for (const player of players) state = submit(state, player.id, { kind: "drawing", strokes });
  const nextGuess = projectDrawGuess(state, "d", null);
  expect(nextGuess.task?.hintLength).toBe(4);
  expect(JSON.stringify(nextGuess)).not.toContain("猫 🐈 上 天");
  state = executeDrawGuess(state, null, { type: "expire", matchId: state.id, step: 3 });
  expect(projectDrawGuess(state, "b", null).albums).toEqual([]);
  expect(projectDrawGuess(state, "b", null).narration).toContain("系统主持人");
  state = executeDrawGuess(state, null, { type: "reveal", matchId: state.id, expectedCursor: 0 });
  const first = projectDrawGuess(state, "b", null);
  expect(first.albums).toHaveLength(1); expect(first.albums[0]!.pages).toHaveLength(1);
  expect(first.narration).toContain(word);
  expect(JSON.stringify(first)).not.toContain(state.suggestions.b![0]!);
  expect(JSON.stringify(first)).not.toContain("猫 🐈 上 天");
  expect(first.task).toBeNull();
  expect(() => projectDrawGuess(state, "outsider", null)).toThrow();
});

it("omits the count when a timed-out opening has no source word", () => {
  let state = createDrawGuess("missing", players, 71);
  state = executeDrawGuess(state, null, { type: "expire", matchId: state.id, step: 0 });
  expect(projectDrawGuess(state, "b", null).task).toMatchObject({ hintLength: null, input: { kind: "missing" } });
});
