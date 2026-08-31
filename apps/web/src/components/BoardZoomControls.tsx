import { Map, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "./ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.js";

interface Props {
  readonly compact: boolean;
  readonly scale: number;
  readonly zoomOut: () => void;
  readonly zoomIn: () => void;
  readonly reset: () => void;
}

export function BoardZoomControls({ compact, scale, zoomOut, zoomIn, reset }: Props) {
  const controls = <div className={compact ? "flex items-center gap-2" : "board-zoom-controls"} aria-label="地图缩放">
    <Button type="button" size={compact ? "icon" : "icon-sm"} variant="secondary" aria-label="缩小地图" disabled={scale <= 1} onClick={zoomOut}><ZoomOut /></Button>
    <Button type="button" size={compact ? "icon" : "icon-sm"} variant="secondary" aria-label="恢复地图大小" disabled={scale === 1} onClick={reset}><RotateCcw /></Button>
    <Button type="button" size={compact ? "icon" : "icon-sm"} variant="secondary" aria-label="放大地图" disabled={scale >= 2.6} onClick={zoomIn}><ZoomIn /></Button>
  </div>;
  if (!compact) return controls;
  return <Popover>
    <PopoverTrigger asChild><Button type="button" size="sm" variant="secondary" aria-label="地图工具"><Map aria-hidden="true" />地图</Button></PopoverTrigger>
    <PopoverContent align="start" aria-label="地图工具">
      {controls}
      <p className="mt-2 mb-0 text-xs text-muted-foreground">双指缩放 · 拖动查看</p>
    </PopoverContent>
  </Popover>;
}
