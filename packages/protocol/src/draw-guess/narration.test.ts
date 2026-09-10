import { expect, it } from "vitest";
import type { AlbumPage, PageContent } from "@catan/game-core/draw-guess";
import { narrateReveal } from "./narration.js";
const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));
const opening: PageContent = { kind: "opening", word: "熊猫吃火锅", strokes: [] };
const drawing: PageContent = { kind: "drawing", strokes: [] };
const guess = (text: string): PageContent => ({ kind: "text", text });
function narration(contents: PageContent[], total = 4) {
  const pages: AlbumPage[] = contents.map((content, step) => ({ content, step, authorId: players[step]!.id, timedOut: false }));
  return narrateReveal([{ ownerId: "a", pages }], players, total, false);
}
it("introduces reveal briefly before any page is exposed", () => { const intro = narrateReveal([], players, 4, false); expect(intro).toContain("系统主持人"); expect(intro.length).toBeLessThan(35); });
it("uses the first detour line only when the earlier chain was intact", () => {
  expect(narration([opening, guess("熊猫跳舞")])).toContain("到你这楼歪了");
  expect(narration([opening, guess("熊猫跳舞"), drawing, guess("企鹅滑冰")])).not.toContain("前面都对了");
});
it("congratulates matching guesses only once an intact album is fully revealed", () => {
  expect(narration([opening, guess("熊猫吃火锅")])).not.toContain("一路都对");
  expect(narration([opening, guess("熊猫 吃火锅！"), drawing, guess("熊猫吃火锅")])).toContain("真厉害，一路都对");
  expect(narration([opening, guess("熊猫吃火锅"), { kind: "missing", expected: "drawing" }, guess("熊猫吃火锅")])).not.toContain("一路都对");
});
it("treats a missing entry separately and does not infer correctness from drawings", () => {
  expect(narration([opening, { kind: "missing", expected: "text" }])).toContain("没赶上");
  expect(narration([opening, guess("企鹅骑车"), drawing])).toContain("把收到的词画出来了");
});
