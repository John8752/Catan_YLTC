import { DRAW_COLORS, DRAW_LIMITS, DRAW_WIDTHS, DrawGuessError, type EditablePage } from "./types.js";

export function validatePage(page: EditablePage, expected: EditablePage["kind"], allowEmpty: boolean): EditablePage {
  const invalid = () => { throw new DrawGuessError("INVALID_PAGE", "内容为空、过长或画笔数据无效"); };
  if (!page || page.kind !== expected) return invalid();
  if (page.kind === "text") {
    if (typeof page.text !== "string") return invalid();
    const text = page.text.trim();
    if ((!allowEmpty && !text) || text.length > DRAW_LIMITS.text) return invalid();
    return { kind: "text", text };
  }
  if (page.kind === "opening" && (typeof page.word !== "string" || page.word.length > DRAW_LIMITS.text || (!allowEmpty && !page.word))) return invalid();
  if (!Array.isArray(page.strokes) || page.strokes.length > DRAW_LIMITS.strokes || (!allowEmpty && page.strokes.length === 0)) return invalid();
  let points = 0;
  for (const stroke of page.strokes) {
    if (!stroke || !DRAW_COLORS.some((color) => color === stroke.color) || !DRAW_WIDTHS.some((width) => width === stroke.width) || !Array.isArray(stroke.points) || stroke.points.length === 0) return invalid();
    points += stroke.points.length;
    if (points > DRAW_LIMITS.points) return invalid();
    for (const point of stroke.points) {
      if (!Array.isArray(point) || point.length !== 2 || !Number.isInteger(point[0]) || !Number.isInteger(point[1]) || point[0] < 0 || point[0] > DRAW_LIMITS.width || point[1] < 0 || point[1] > DRAW_LIMITS.height) return invalid();
    }
  }
  const strokes = page.strokes.map((stroke) => ({ color: stroke.color, width: stroke.width, points: stroke.points.map(([x, y]: readonly [number, number]) => [x, y] as const) }));
  return page.kind === "opening" ? { kind: "opening", word: page.word, strokes } : { kind: "drawing", strokes };
}
export function pageIsEmpty(page: EditablePage): boolean { return page.kind === "text" ? !page.text.trim() : page.strokes.length === 0 || (page.kind === "opening" && !page.word); }
