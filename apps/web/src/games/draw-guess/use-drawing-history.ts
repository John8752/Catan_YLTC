import { useEffect, useRef, useState } from "react";
import type { DrawingData } from "@catan/game-core/draw-guess";
import { drawingHistory, normalizedDrawing, recordDrawing, redoDrawing, undoDrawing, type DrawingHistory } from "./drawing-history.js";

export function useDrawingHistory(data: DrawingData, onChange: (data: DrawingData) => void) {
  const [history, setHistory] = useState(() => drawingHistory(data));
  const current = useRef(history), published = useRef(history.present);
  useEffect(() => {
    const incoming = normalizedDrawing(data);
    if (incoming.strokes !== published.current.strokes || incoming.background !== published.current.background) {
      const next = drawingHistory(incoming); current.current = next; published.current = next.present; setHistory(next);
    }
  }, [data.strokes, data.background]);
  function publish(next: DrawingHistory) {
    if (next === current.current) return;
    current.current = next; published.current = next.present; setHistory(next); onChange(next.present);
  }
  return {
    value: current.current.present,
    record: (next: DrawingData) => publish(recordDrawing(current.current, next)),
    continueGesture: (next: DrawingData) => publish({ ...current.current, present: normalizedDrawing(next) }),
    undo: () => publish(undoDrawing(current.current)), redo: () => publish(redoDrawing(current.current)),
    canUndo: history.past.length > 0, canRedo: history.future.length > 0,
  };
}
