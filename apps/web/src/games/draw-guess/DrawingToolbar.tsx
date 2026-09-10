import { useState } from "react";
import { Palette, Pencil, Eraser, PaintBucket, Undo2, Redo2, Trash2 } from "lucide-react";
import { DRAW_COLORS, DRAW_WIDTHS, DRAW_BACKGROUNDS, type DrawingTool } from "@catan/game-core/draw-guess";
import { Button } from "../../components/ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.js";
import { cn } from "../../lib/utils.js";

const colorNames = ["黑色", "白色", "红色", "橙色", "黄色", "绿色", "蓝色", "紫色"];
const backgroundNames = ["白色", "奶黄色", "浅蓝色", "浅绿色", "浅粉色", "深灰色"];
interface Props {
  readonly disabled: boolean; readonly tool: DrawingTool; readonly color: string; readonly width: number; readonly eraserWidth: number; readonly background: string;
  readonly onTool: (tool: DrawingTool) => void; readonly onColor: (color: string) => void; readonly onWidth: (width: number) => void;
  readonly onEraserWidth: (width: number) => void; readonly onBackground: (color: string) => void;
  readonly canUndo: boolean; readonly canRedo: boolean; readonly canClear: boolean;
  readonly onUndo: () => void; readonly onRedo: () => void; readonly onClear: () => void;
}
export function DrawingToolbar(props: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const toolButton = "relative h-11 min-w-0 rounded-xl px-1 [&_svg]:size-5";
  const panel = "w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl border-slate-200 bg-white p-4 text-slate-900 shadow-xl";
  const popover = (id: string) => ({ open: open === id, onOpenChange: (value: boolean) => setOpen(value ? id : null) });
  function widths(eraser: boolean) {
    const selected = eraser ? props.eraserWidth : props.width;
    return <div className="grid gap-3" role="group" aria-label={eraser ? "橡皮擦大小" : "画笔粗细"}>
      <p className="text-sm font-bold">{eraser ? "橡皮擦大小" : "画笔粗细"}</p>
      <div className="grid grid-cols-4 gap-2">{DRAW_WIDTHS.map((size) => <Button key={size} variant={selected === size ? "default" : "outline"} className="grid h-16 justify-items-center gap-1 px-1" aria-label={`${size} 像素`} aria-pressed={selected === size} onClick={() => { (eraser ? props.onEraserWidth : props.onWidth)(size); setOpen(null); }}>
        <span className="block rounded-full bg-current" style={{ width: Math.max(3, size * .6), height: Math.max(3, size * .6) }} /><span className="text-xs">{size}</span>
      </Button>)}</div>
    </div>;
  }
  return <div className="shrink-0">
    <fieldset disabled={props.disabled} className="grid grid-cols-7 gap-1 rounded-2xl border border-slate-200 bg-stone-50 p-1" aria-label="画笔工具">
      <Popover {...popover("color")}><PopoverTrigger asChild><Button variant="ghost" className={toolButton} aria-label="选择颜色"><Palette aria-hidden="true" /><span className="absolute bottom-1 right-1 size-3 rounded-full border border-slate-400" style={{ backgroundColor: props.color }} /></Button></PopoverTrigger>
        <PopoverContent side="top" align="start" collisionPadding={12} className={panel}><p className="mb-3 text-sm font-bold">画笔颜色</p><div className="grid grid-cols-4 gap-2">{DRAW_COLORS.map((color, i) => <button key={color} className={cn("size-11 rounded-full border-2 border-slate-300 outline-offset-2 focus-visible:outline-2", props.color === color && "ring-2 ring-slate-700 ring-offset-2")} style={{ backgroundColor: color }} aria-label={`${colorNames[i]}画笔`} aria-pressed={props.color === color} onClick={() => { props.onColor(color); props.onTool("pen"); setOpen(null); }} />)}</div></PopoverContent>
      </Popover>
      <Popover {...popover("pen")}><PopoverTrigger asChild><Button variant={props.tool === "pen" ? "default" : "ghost"} className={toolButton} aria-label="画笔" aria-pressed={props.tool === "pen"} onClick={() => props.onTool("pen")}><Pencil aria-hidden="true" /><span className="absolute bottom-0.5 right-1 text-[10px] font-bold">{props.width}</span></Button></PopoverTrigger><PopoverContent side="top" collisionPadding={12} className={panel}>{widths(false)}</PopoverContent></Popover>
      <Popover {...popover("eraser")}><PopoverTrigger asChild><Button variant={props.tool === "eraser" ? "default" : "ghost"} className={toolButton} aria-label="橡皮擦" aria-pressed={props.tool === "eraser"} onClick={() => props.onTool("eraser")}><Eraser aria-hidden="true" /><span className="absolute bottom-0.5 right-1 text-[10px] font-bold">{props.eraserWidth}</span></Button></PopoverTrigger><PopoverContent side="top" collisionPadding={12} className={panel}>{widths(true)}</PopoverContent></Popover>
      <Popover {...popover("background")}><PopoverTrigger asChild><Button variant="ghost" className={toolButton} aria-label="画布背景"><PaintBucket aria-hidden="true" /><span className="absolute bottom-1 right-1 size-3 rounded-full border border-slate-400" style={{ backgroundColor: props.background }} /></Button></PopoverTrigger>
        <PopoverContent side="top" collisionPadding={12} className={panel}><p className="mb-3 text-sm font-bold">画布背景</p><div className="grid grid-cols-3 gap-2">{DRAW_BACKGROUNDS.map((color, i) => <Button key={color} variant="outline" className={cn("grid h-16 justify-items-center gap-1 px-1", props.background === color && "ring-2 ring-slate-700")} aria-label={`${backgroundNames[i]}背景`} aria-pressed={props.background === color} onClick={() => { props.onBackground(color); setOpen(null); }}><span className="size-6 rounded-md border border-slate-300" style={{ backgroundColor: color }} /><span className="text-xs">{backgroundNames[i]}</span></Button>)}</div></PopoverContent>
      </Popover>
      <Button variant="ghost" className={toolButton} aria-label="撤销" disabled={!props.canUndo} onClick={props.onUndo}><Undo2 aria-hidden="true" /></Button>
      <Button variant="ghost" className={toolButton} aria-label="重做" disabled={!props.canRedo} onClick={props.onRedo}><Redo2 aria-hidden="true" /></Button>
      <Button variant="ghost" className={toolButton} aria-label="清空画布" disabled={!props.canClear} onClick={props.onClear}><Trash2 aria-hidden="true" /></Button>
    </fieldset>
    <p className="sr-only" role="status">{props.tool === "eraser" ? `橡皮擦 · ${props.eraserWidth} 像素` : `画笔 · ${props.width} 像素`} · 支持撤销和重做</p>
  </div>;
}
