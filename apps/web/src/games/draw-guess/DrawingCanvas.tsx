import { useEffect, useRef, useState, type PointerEvent } from "react";
import { DRAW_COLORS, DRAW_BACKGROUNDS, DRAW_LIMITS, type DrawingData, type DrawingTool } from "@catan/game-core/draw-guess";
import { cn } from "../../lib/utils.js";
import { DrawingToolbar } from "./DrawingToolbar.js";
import { useDrawingHistory } from "./use-drawing-history.js";
import { paint } from "./drawing-paint.js";
export { paint } from "./drawing-paint.js";

export function DrawingPreview({ strokes, background, label = "传来的画作" }: DrawingData & { readonly label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const ctx = ref.current?.getContext("2d"); if (ctx) paint(ctx, strokes, background); }, [strokes, background]);
  return <canvas ref={ref} width={800} height={600} role="img" aria-label={label} className="block aspect-[4/3] w-full rounded-xl border border-slate-200 bg-white" />;
}
export function DrawingCanvas({ data, onChange, disabled }: { readonly data: DrawingData; readonly onChange: (data: DrawingData) => void; readonly disabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null), activePointer = useRef<number | null>(null);
  const history = useDrawingHistory(data, onChange);
  const latest = useRef(history.value); latest.current = history.value;
  const [tool, setTool] = useState<DrawingTool>("pen");
  const [color, setColor] = useState<string>(DRAW_COLORS[0]);
  const [width, setWidth] = useState(8), [eraserWidth, setEraserWidth] = useState(32);
  const [drawing, setDrawing] = useState(false), [limit, setLimit] = useState(false);
  useEffect(() => { const ctx = ref.current?.getContext("2d"); if (ctx) paint(ctx, history.value.strokes, history.value.background); }, [history.value]);
  const count = () => latest.current.strokes.reduce((total, stroke) => total + stroke.points.length, 0);
  const position = (event: PointerEvent<HTMLCanvasElement>): readonly [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.round(Math.max(0, Math.min(800, (event.clientX - rect.left) / rect.width * 800))), Math.round(Math.max(0, Math.min(600, (event.clientY - rect.top) / rect.height * 600)))];
  };
  function publish(next: DrawingData, start = false) { latest.current = next; if (start) history.record(next); else history.continueGesture(next); }
  function down(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || activePointer.current !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (latest.current.strokes.length >= DRAW_LIMITS.strokes || count() >= DRAW_LIMITS.points) { setLimit(true); return; }
    event.preventDefault(); activePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); setDrawing(true); setLimit(false);
    publish({ ...latest.current, strokes: [...latest.current.strokes, { color, width: tool === "eraser" ? eraserWidth : width, tool, points: [position(event)] }] }, true);
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || activePointer.current !== event.pointerId) return;
    event.preventDefault();
    if (count() >= DRAW_LIMITS.points) { setLimit(true); return; }
    const strokes = latest.current.strokes, last = strokes.at(-1); if (!last) return;
    const point = position(event), previous = last.points.at(-1)!;
    if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) < 4) return;
    publish({ ...latest.current, strokes: [...strokes.slice(0, -1), { ...last, points: [...last.points, point] }] });
  }
  function up(event: PointerEvent<HTMLCanvasElement>) {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null; setDrawing(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function undo() { setLimit(false); history.undo(); }
  function redo() { setLimit(false); history.redo(); }
  return <div className="grid min-w-0 gap-2">
    <div className="relative overflow-hidden rounded-2xl border-[3px] border-stone-600 shadow-sm">
      <canvas ref={ref} width={800} height={600} aria-label="画布" role="img" tabIndex={disabled ? -1 : 0} className={cn("block aspect-[4/3] w-full touch-none outline-offset-[-4px] focus-visible:outline-2", disabled ? "cursor-default" : "cursor-crosshair")}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={() => { activePointer.current = null; setDrawing(false); }}
        onKeyDown={(event) => { if (disabled || drawing || !(event.ctrlKey || event.metaKey)) return; if (event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); } else if (event.key.toLowerCase() === "y") { event.preventDefault(); redo(); } }} />
      {history.value.strokes.length === 0 && !disabled && <div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><span className="rounded-full bg-stone-800/65 px-4 py-2 text-sm text-white">手指滑动或拖动鼠标开始画画</span></div>}
    </div>
    <DrawingToolbar disabled={disabled || drawing} tool={tool} color={color} width={width} eraserWidth={eraserWidth} background={history.value.background ?? DRAW_BACKGROUNDS[0]}
      onTool={setTool} onColor={setColor} onWidth={setWidth} onEraserWidth={setEraserWidth}
      onBackground={(background) => { if (background !== history.value.background) history.record({ ...history.value, background }); }}
      canUndo={history.canUndo} canRedo={history.canRedo} canClear={history.value.strokes.length > 0} onUndo={undo} onRedo={redo}
      onClear={() => { history.record({ ...history.value, strokes: [] }); setLimit(false); }} />
    {limit && <p className="text-sm text-amber-800" role="status">画笔容量已满，可以撤销几笔或提交当前画作。</p>}
  </div>;
}
