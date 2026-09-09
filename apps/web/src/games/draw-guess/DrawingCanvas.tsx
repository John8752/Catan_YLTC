import { useEffect, useRef, useState, type PointerEvent } from "react";
import { DRAW_COLORS, DRAW_WIDTHS, DRAW_LIMITS, type Stroke } from "@catan/game-core/draw-guess";
import { Button } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";

export function paint(context: CanvasRenderingContext2D, strokes: readonly Stroke[]) {
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, DRAW_LIMITS.width, DRAW_LIMITS.height);
  context.lineCap = "round"; context.lineJoin = "round";
  for (const stroke of strokes) {
    context.strokeStyle = stroke.color; context.fillStyle = stroke.color; context.lineWidth = stroke.width;
    const first = stroke.points[0]; if (!first) continue;
    if (stroke.points.length === 1) { context.beginPath(); context.arc(first[0], first[1], stroke.width / 2, 0, Math.PI * 2); context.fill(); continue; }
    context.beginPath(); context.moveTo(first[0], first[1]); for (const point of stroke.points.slice(1)) context.lineTo(point[0], point[1]); context.stroke();
  }
}
export function DrawingPreview({ strokes, label = "传来的画作" }: { readonly strokes: readonly Stroke[]; readonly label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const ctx = ref.current?.getContext("2d"); if (ctx) paint(ctx, strokes); }, [strokes]);
  return <canvas ref={ref} width={800} height={600} role="img" aria-label={label} className="block aspect-[4/3] w-full rounded-xl border border-slate-200 bg-white" />;
}
const colorNames = ["黑色", "白色橡皮", "红色", "橙色", "黄色", "绿色", "蓝色", "紫色"];
export function DrawingCanvas({ strokes, onChange, disabled }: { readonly strokes: readonly Stroke[]; readonly onChange: (strokes: readonly Stroke[]) => void; readonly disabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activePointer = useRef<number | null>(null);
  const latest = useRef(strokes); latest.current = strokes;
  const [color, setColor] = useState<string>(DRAW_COLORS[0]);
  const [width, setWidth] = useState<number>(8);
  const [redo, setRedo] = useState<readonly Stroke[]>([]);
  const [clearBackup, setClearBackup] = useState<readonly Stroke[] | null>(null);
  const [limit, setLimit] = useState(false);
  useEffect(() => { const ctx = ref.current?.getContext("2d"); if (ctx) paint(ctx, strokes); }, [strokes]);
  const count = () => latest.current.reduce((total, stroke) => total + stroke.points.length, 0);
  const position = (event: PointerEvent<HTMLCanvasElement>): readonly [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.round(Math.max(0, Math.min(800, (event.clientX - rect.left) / rect.width * 800))), Math.round(Math.max(0, Math.min(600, (event.clientY - rect.top) / rect.height * 600)))];
  };
  function publish(next: readonly Stroke[]) { latest.current = next; onChange(next); }
  function down(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || activePointer.current !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (latest.current.length >= DRAW_LIMITS.strokes || count() >= DRAW_LIMITS.points) { setLimit(true); return; }
    event.preventDefault(); activePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); setRedo([]); setClearBackup(null); setLimit(false);
    publish([...latest.current, { color, width, points: [position(event)] }]);
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || activePointer.current !== event.pointerId) return;
    event.preventDefault();
    if (count() >= DRAW_LIMITS.points) { setLimit(true); return; }
    const last = latest.current.at(-1); if (!last) return;
    const point = position(event), previous = last.points.at(-1)!;
    if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) < 4) return;
    publish([...latest.current.slice(0, -1), { ...last, points: [...last.points, point] }]);
  }
  function up(event: PointerEvent<HTMLCanvasElement>) {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <div className="grid min-w-0 gap-3">
    <canvas ref={ref} width={800} height={600} aria-label="画布" role="img" className={cn("block aspect-[4/3] w-full touch-none rounded-xl border-2 border-slate-300 bg-white", disabled ? "cursor-default" : "cursor-crosshair")}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={() => { activePointer.current = null; }} />
    <fieldset disabled={disabled} className="flex flex-wrap items-center gap-2" aria-label="画笔工具">
      {DRAW_COLORS.map((value, i) => <button key={value} type="button" aria-label={colorNames[i]} aria-pressed={color === value} onClick={() => setColor(value)}
        className={cn("size-9 rounded-full border-2 border-slate-300 outline-offset-2 focus-visible:outline-2 disabled:opacity-40", color === value && "ring-2 ring-slate-700 ring-offset-2")} style={{ backgroundColor: value }} />)}
      <label className="ml-auto flex items-center gap-2 text-sm">粗细<select className="h-10 rounded-lg border bg-white px-2" value={width} onChange={(event) => setWidth(Number(event.target.value))} aria-label="画笔粗细">
        {DRAW_WIDTHS.map((value) => <option key={value} value={value}>{value === 3 ? "细" : value === 8 ? "中" : "粗"}</option>)}
      </select></label>
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={disabled || (strokes.length === 0 && !clearBackup)} onClick={() => {
        if (strokes.length === 0 && clearBackup) { publish(clearBackup); setClearBackup(null); }
        else { const last = strokes.at(-1)!; setRedo([...redo, last]); publish(strokes.slice(0, -1)); }
        setLimit(false);
      }}>撤销</Button>
      <Button variant="outline" disabled={disabled || redo.length === 0} onClick={() => { publish([...strokes, redo.at(-1)!]); setRedo(redo.slice(0, -1)); }}>重做</Button>
      <Button variant="outline" disabled={disabled || strokes.length === 0} onClick={() => { setClearBackup(strokes); publish([]); setRedo([]); setLimit(false); }}>清空画布</Button>
    </div>
    {limit && <p className="text-sm text-amber-800" role="status">画笔容量已满，可以撤销几笔或提交当前画作。</p>}
  </div>;
}
