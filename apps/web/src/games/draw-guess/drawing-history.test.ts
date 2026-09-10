import { expect, it } from "vitest";
import { drawingHistory, recordDrawing, redoDrawing, undoDrawing } from "./drawing-history.js";

it("undoes and redoes complete strokes, erasing, background changes and clear in order", () => {
  const ink = { color: "#222222", width: 8, points: [[1, 2]] as const };
  const eraser = { ...ink, tool: "eraser" as const, width: 32 };
  const initial = drawingHistory({ strokes: [] });
  const drawn = recordDrawing(initial, { strokes: [ink] });
  const erased = recordDrawing(drawn, { strokes: [ink, eraser] });
  const colored = recordDrawing(erased, { ...erased.present, background: "#dbeafe" });
  const cleared = recordDrawing(colored, { ...colored.present, strokes: [] });
  let history = cleared;
  for (const expected of [colored, erased, drawn, initial]) { history = undoDrawing(history); expect(history.present).toEqual(expected.present); }
  for (const expected of [drawn, erased, colored, cleared]) { history = redoDrawing(history); expect(history.present).toEqual(expected.present); }
  const branched = recordDrawing(undoDrawing(cleared), { strokes: [ink], background: "#fff3bf" });
  expect(redoDrawing(branched)).toBe(branched); expect(initial.present.strokes).toEqual([]);
});
it("bounds local history to 100 operations", () => {
  let history = drawingHistory({ strokes: [] });
  for (let i = 0; i < 120; i++) history = recordDrawing(history, { strokes: [], background: i % 2 ? "#dbeafe" : "#fff3bf" });
  expect(history.past).toHaveLength(100);
});
