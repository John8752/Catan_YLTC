import { DRAW_BACKGROUNDS, type DrawingData } from "@catan/game-core/draw-guess";

export interface DrawingHistory { readonly past: readonly DrawingData[]; readonly present: DrawingData; readonly future: readonly DrawingData[] }
export function normalizedDrawing(data: DrawingData): DrawingData { return { strokes: data.strokes, background: data.background ?? DRAW_BACKGROUNDS[0] }; }
export function drawingHistory(data: DrawingData): DrawingHistory { return { past: [], present: normalizedDrawing(data), future: [] }; }
export function recordDrawing(history: DrawingHistory, next: DrawingData): DrawingHistory {
  return { past: [...history.past, history.present].slice(-100), present: normalizedDrawing(next), future: [] };
}
export function undoDrawing(history: DrawingHistory): DrawingHistory {
  const previous = history.past.at(-1);
  return previous ? { past: history.past.slice(0, -1), present: previous, future: [...history.future, history.present] } : history;
}
export function redoDrawing(history: DrawingHistory): DrawingHistory {
  const next = history.future.at(-1);
  return next ? { past: [...history.past, history.present], present: next, future: history.future.slice(0, -1) } : history;
}
