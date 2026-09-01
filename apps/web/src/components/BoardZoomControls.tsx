import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { PointerEvent } from "react";
import { Button } from "./ui/button.js";

export interface BoardZoomControlsProps {
  readonly scale: number;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly isDefault: boolean;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly reset: () => void;
}

/**
 * Sits in the board's bottom-right corner, inside the pan viewport.
 *
 * The viewport starts a drag on pointerdown anywhere inside it, so every button
 * here stops that event: without it, pressing a control both zooms and begins a
 * pan, and the pan's click suppression can then swallow the click entirely.
 */
export function BoardZoomControls({
  scale,
  canZoomIn,
  canZoomOut,
  isDefault,
  zoomIn,
  zoomOut,
  reset,
}: BoardZoomControlsProps) {
  const keepGestureOut = (event: PointerEvent<HTMLDivElement>) => event.stopPropagation();

  return (
    <div
      className="board-zoom-controls"
      aria-label="地图缩放"
      onPointerDown={keepGestureOut}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        aria-label="缩小地图"
        disabled={!canZoomOut}
        onClick={zoomOut}
      >
        <ZoomOut />
      </Button>
      <span className="board-zoom-level" aria-hidden="true">{Math.round(scale * 100)}%</span>
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        aria-label="恢复地图大小"
        disabled={isDefault}
        onClick={reset}
      >
        <RotateCcw />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        aria-label="放大地图"
        disabled={!canZoomIn}
        onClick={zoomIn}
      >
        <ZoomIn />
      </Button>
    </div>
  );
}
