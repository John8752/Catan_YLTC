import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type WheelEvent } from "react";

// Below 1 so the whole board can always be pulled into view. The layout sizes the
// board from an assumed chrome height, so on a short window it is laid out taller
// than the space it actually gets and the bottom row is clipped; zooming out has to
// be able to compensate, whatever the layout got wrong.
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.6;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface ViewTransform extends Point {
  readonly scale: number;
}

interface GestureStart {
  readonly view: ViewTransform;
  readonly point: Point;
  readonly midpoint?: Point;
  readonly distance?: number;
}

const RESET_VIEW: ViewTransform = { x: 0, y: 0, scale: 1 };

export function useBoardViewport() {
  const [view, setView] = useState<ViewTransform>(RESET_VIEW);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<GestureStart | null>(null);
  const suppressClick = useRef(false);

  const reset = () => setView(RESET_VIEW);
  const zoomBy = (amount: number) => setView((current) => boundedView({ ...current, scale: current.scale + amount }));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    pointers.current.set(event.pointerId, eventPoint(event));
    gesture.current = gestureFromPointers(pointers.current, view);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || gesture.current === null) return;
    pointers.current.set(event.pointerId, eventPoint(event));
    const points = [...pointers.current.values()];
    const start = gesture.current;
    const first = points[0];
    if (first === undefined) return;

    if (points.length >= 2 && start.midpoint !== undefined && start.distance !== undefined) {
      const second = points[1];
      if (second === undefined) return;
      const midpoint = pointMidpoint(first, second);
      const distance = pointDistance(first, second);
      if (Math.abs(distance - start.distance) > 3) {
        suppressClick.current = true;
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
      }
      const scale = start.view.scale * (distance / Math.max(start.distance, 1));
      setView(boundedView({
        scale,
        x: start.view.x + midpoint.x - start.midpoint.x,
        y: start.view.y + midpoint.y - start.midpoint.y,
      }));
      return;
    }

    const dx = first.x - start.point.x;
    const dy = first.y - start.point.y;
    if (Math.hypot(dx, dy) > 5) {
      suppressClick.current = true;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    }
    setView(boundedView({ scale: start.view.scale, x: start.view.x + dx, y: start.view.y + dy }));
  };

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gesture.current = gestureFromPointers(pointers.current, view);
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 0.15 : -0.15);
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return {
    scale: view.scale,
    transformStyle: {
      "--board-pan-x": `${view.x}px`,
      "--board-pan-y": `${view.y}px`,
      "--board-zoom": view.scale,
    } as CSSProperties,
    viewportProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
      onWheel,
      onDoubleClick: reset,
      onClickCapture,
    },
    reset,
    zoomIn: () => zoomBy(0.2),
    zoomOut: () => zoomBy(-0.2),
  };
}

function gestureFromPointers(pointers: ReadonlyMap<number, Point>, view: ViewTransform): GestureStart | null {
  const points = [...pointers.values()];
  if (points.length === 0) return null;
  const first = points[0];
  if (first === undefined) return null;
  if (points.length === 1) return { view, point: first };
  const second = points[1];
  if (second === undefined) return { view, point: first };
  return {
    view,
    point: first,
    midpoint: pointMidpoint(first, second),
    distance: pointDistance(first, second),
  };
}

function boundedView(view: ViewTransform): ViewTransform {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale));
  // Panning only means something once the board is larger than its frame. Deriving
  // the bound straight from the scale would go negative below 1 and snap the board
  // to a corner, so it is floored instead.
  const maxOffset = Math.max(0, 240 * (scale - 1));
  return {
    scale,
    x: maxOffset === 0 ? 0 : Math.min(maxOffset, Math.max(-maxOffset, view.x)),
    y: maxOffset === 0 ? 0 : Math.min(maxOffset, Math.max(-maxOffset, view.y)),
  };
}

function eventPoint(event: PointerEvent<HTMLDivElement>): Point {
  return { x: event.clientX, y: event.clientY };
}

function pointMidpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function pointDistance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}
