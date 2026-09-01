import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

const PAN_LIMIT = 160;
const KEYBOARD_PAN_STEP = 32;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface GestureStart {
  readonly view: Point;
  readonly point: Point;
}

const CENTER: Point = { x: 0, y: 0 };

export function useBoardViewport(scale = 1) {
  const [view, setView] = useState<Point>(CENTER);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<GestureStart | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => setView(CENTER), [scale]);

  const reset = () => setView(CENTER);

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

    const dx = first.x - start.point.x;
    const dy = first.y - start.point.y;
    if (Math.hypot(dx, dy) > 5) {
      suppressClick.current = true;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    }
    setView(boundedPoint({ x: start.view.x + dx, y: start.view.y + dy }, scale));
  };

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gesture.current = gestureFromPointers(pointers.current, view);
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const delta = {
      ArrowLeft: { x: -KEYBOARD_PAN_STEP, y: 0 },
      ArrowRight: { x: KEYBOARD_PAN_STEP, y: 0 },
      ArrowUp: { x: 0, y: -KEYBOARD_PAN_STEP },
      ArrowDown: { x: 0, y: KEYBOARD_PAN_STEP },
    }[event.key];
    if (event.key === "Home") {
      event.preventDefault();
      reset();
    } else if (delta !== undefined) {
      event.preventDefault();
      setView((current) => boundedPoint({ x: current.x + delta.x, y: current.y + delta.y }, scale));
    }
  };

  return {
    transformStyle: {
      "--board-pan-x": `${view.x}px`,
      "--board-pan-y": `${view.y}px`,
      "--board-scale": scale,
    } as CSSProperties,
    viewportProps: {
      role: "region" as const,
      "aria-label": "可移动地图视口",
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
      onDoubleClick: reset,
      onClickCapture,
      onKeyDown,
    },
  };
}

function gestureFromPointers(pointers: ReadonlyMap<number, Point>, view: Point): GestureStart | null {
  const points = [...pointers.values()];
  if (points.length === 0) return null;
  const first = points[0];
  if (first === undefined) return null;
  return { view, point: first };
}

function boundedPoint(view: Point, scale: number): Point {
  const maxOffset = scale > 1 ? PAN_LIMIT : 0;
  return {
    x: maxOffset === 0 ? 0 : Math.min(maxOffset, Math.max(-maxOffset, view.x)),
    y: maxOffset === 0 ? 0 : Math.min(maxOffset, Math.max(-maxOffset, view.y)),
  };
}

function eventPoint(event: PointerEvent<HTMLDivElement>): Point {
  return { x: event.clientX, y: event.clientY };
}
