import { describe, expect, it } from "vitest";
import { createDrawGuess, executeDrawGuess, taskFor, type DrawGuessState } from "./index.js";

const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));
const strokes = [{ color: "#222222", width: 8, points: [[10, 20]] as const }];
function opening() {
  let state = createDrawGuess("social", players, 42);
  state = { ...state, suggestions: Object.fromEntries(players.map((p) => [p.id, ["西湖绸伞"]])) };
  for (const p of players) state = executeDrawGuess(state, p.id, { type: "submit", matchId: state.id, taskId: taskFor(state, p.id)!.id, page: { kind: "opening", word: "西湖绸伞", strokes } });
  return state;
}
function submitText(state: DrawGuessState, text: string) {
  return executeDrawGuess(state, "b", { type: "submit", matchId: state.id, taskId: taskFor(state, "b")!.id, page: { kind: "text", text } });
}
function revealed() {
  let state = opening();
  while (state.phase.kind === "work") state = executeDrawGuess(state, null, { type: "expire", matchId: state.id, step: state.phase.step });
  return executeDrawGuess(state, null, { type: "reveal", matchId: state.id, expectedCursor: 0 });
}
describe("exact guess length", () => {
  it("rejects short/long guesses without locking a task, and counts Unicode excluding spaces", () => {
    const state = opening();
    for (const text of ["猫", "五个字答案", "猫   "]) expect(() => submitText(state, text)).toThrow("4 个字");
    expect(taskFor(state, "b")?.submitted).toBe(false);
    expect(submitText(state, "猫 🐈 上 天").albums[0]?.pages[1]?.content).toEqual({ kind: "text", text: "猫 🐈 上 天" });
  });
  it("saves incomplete drafts but only collects exact-length guesses at timeout", () => {
    let state = opening();
    for (const [id, text] of [["b", "猫"], ["c", "西 湖 绸 伞"]] as const) state = executeDrawGuess(state, id, { type: "draft", matchId: state.id, taskId: taskFor(state, id)!.id, sequence: 1, page: { kind: "text", text } });
    expect(state.drafts.b?.page).toEqual({ kind: "text", text: "猫" });
    state = executeDrawGuess(state, null, { type: "expire", matchId: state.id, step: 1 });
    expect(state.albums[0]?.pages[1]?.content.kind).toBe("missing");
    expect(state.albums[1]?.pages[1]?.content.kind).toBe("text");
  });
  it("allows a nonempty guess when the source is missing", () => {
    let state = createDrawGuess("social", players, 42);
    state = executeDrawGuess(state, null, { type: "expire", matchId: state.id, step: 0 });
    expect(submitText(state, "随便想象一下").albums[0]?.pages[1]?.content.kind).toBe("text");
  });
});
describe("page reactions", () => {
  const react = { type: "react" as const, matchId: "social", albumOwnerId: "a", step: 0, reaction: "up" as const };
  it("counts repeat and opposite reactions from all players immutably without advancing", () => {
    const initial = revealed();
    let state = executeDrawGuess(initial, "a", react);
    state = executeDrawGuess(state, "a", react);
    state = executeDrawGuess(state, "b", { ...react, reaction: "down" });
    expect(state.reactions["0:0"]).toEqual({ up: 2, down: 1 });
    expect(initial.reactions).toEqual({}); expect(state.albums).toBe(initial.albums); expect(state.phase).toEqual(initial.phase);
    while (state.phase.kind === "reveal") state = executeDrawGuess(state, null, { type: "reveal", matchId: state.id, expectedCursor: state.phase.cursor });
    expect(executeDrawGuess(state, "c", react).reactions["0:0"]?.up).toBe(3);
  });
  it("rejects premature, hidden, missing, foreign and forged targets", () => {
    expect(() => executeDrawGuess(opening(), "a", react)).toThrow();
    let state = revealed();
    for (const command of [{ ...react, albumOwnerId: "b" }, { ...react, step: 1 }, { ...react, step: -1 }, { ...react, step: 0.5 }, { ...react, matchId: "old" }]) expect(() => executeDrawGuess(state, "a", command)).toThrow();
    expect(() => executeDrawGuess(state, "outsider", react)).toThrow();
    expect(() => executeDrawGuess(state, null, react)).toThrow();
    expect(() => executeDrawGuess(state, "a", { ...react, reaction: "fake" as "up" })).toThrow();
    state = executeDrawGuess(state, null, { type: "reveal", matchId: state.id, expectedCursor: 1 });
    expect(() => executeDrawGuess(state, "a", { ...react, step: 1 })).toThrow();
  });
});
