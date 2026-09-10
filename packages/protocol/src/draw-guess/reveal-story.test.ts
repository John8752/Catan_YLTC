import { expect, it } from "vitest";
import { createDrawGuess, executeDrawGuess, taskFor } from "@catan/game-core/draw-guess";
import { projectDrawGuess } from "./index.js";

it("reveals first-person contributions and historical host replies without leaking future answers", () => {
  const players = ["a", "b", "c"].map((id) => ({ id, name: id }));
  let state = createDrawGuess("story", players, 9);
  state = { ...state, suggestions: Object.fromEntries(players.map((p) => [p.id, ["生日蛋糕"]])) };
  const strokes = [{ color: "#e34b4b", width: 8, points: [[5, 5]] as const }, { color: "#222222", width: 32, tool: "eraser" as const, points: [[10, 10]] as const }];
  for (const p of players) state = executeDrawGuess(state, p.id, { type: "submit", matchId: state.id, taskId: taskFor(state, p.id)!.id, page: { kind: "opening", word: "生日蛋糕", strokes, background: "#fff3bf" } });
  const input = projectDrawGuess(state, "b", null).task?.input;
  expect(input).toEqual({ kind: "drawing", strokes, background: "#fff3bf" });
  expect(JSON.stringify(projectDrawGuess(state, "b", null))).not.toContain("生日蛋糕");
  for (const p of players) state = executeDrawGuess(state, p.id, { type: "submit", matchId: state.id, taskId: taskFor(state, p.id)!.id, page: { kind: "text", text: "蓝色气球" } });
  for (const p of players) state = executeDrawGuess(state, p.id, { type: "submit", matchId: state.id, taskId: taskFor(state, p.id)!.id, page: { kind: "drawing", strokes } });
  state = executeDrawGuess(state, null, { type: "reveal", matchId: state.id, expectedCursor: 0 });
  const first = projectDrawGuess(state, "b", null);
  expect(first.albums[0]?.pages[0]?.perspective).toBe("我的题目是「生日蛋糕」，我先画给大家看。");
  expect(first.albums[0]?.pages[0]?.narration).toContain("亲自画了第一张");
  expect(JSON.stringify(first)).not.toContain("蓝色气球");
  for (const cursor of [1, 2]) state = executeDrawGuess(state, null, { type: "reveal", matchId: state.id, expectedCursor: cursor });
  const pages = projectDrawGuess(state, "a", null).albums[0]!.pages;
  expect(pages[1]?.perspective).toBe("看了上一位的画，我猜的是「蓝色气球」。");
  expect(pages[2]?.perspective).toBe("我要画的是「蓝色气球」，我是这样画的。");
  expect(pages[0]?.narration).toBe(first.albums[0]?.pages[0]?.narration);
  expect(pages[1]?.narration).toContain("到你这楼歪了");
});
