import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

const PAN_LIMIT = 160;
const KEYBOARD_PAN_STEP = 32;
const MIN_SCALE = 1;
const MAX_SCALE = 2.6;
const SCALE_STEP = 0.2;

/** Resting zoom: slightly past fit, so the board owns its stage instead of floating in it. */
export const DEFAULT_BOARD_SCALE = 1.08;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface PanGestureStart {
  readonly kind: "pan";
  readonly pointerId: number;
  readonly view: Point;
  readonly point: Point;
}

interface PinchGestureStart {
  readonly kind: "pinch";
  readonly view: Point;
  readonly scale: number;
  readonly center: Point;
  readonly distance: number;
  readonly stageCenter: Point;
}

type GestureStart = PanGestureStart | PinchGestureStart;

interface ViewportState {
  readonly scale: number;
  readonly view: Point;
}

const CENTER: Point = { x: 0, y: 0 };

export function useBoardViewport(defaultScale = 1) {
  const [viewport, setViewport] = useState<ViewportState>({ scale: defaultScale, view: CENTER });
  const viewportRef = useRef(viewport);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<GestureStart | null>(null);
  const suppressClick = useRef(false);
  const clickReleaseTimer = useRef<number | null>(null);
  const [gestureActive, setGestureActive] = useState(false);

  const commitViewport = (next: ViewportState) => {
    viewportRef.current = next;
    setViewport(next);
  };

  useEffect(() => {
    const next = { scale: defaultScale, view: CENTER };
    viewportRef.current = next;
    setViewport(next);
  }, [defaultScale]);

  useEffect(() => () => {
    if (clickReleaseTimer.current !== null) window.clearTimeout(clickReleaseTimer.current);
  }, []);

  const reset = () => {
    commitViewport({ scale: defaultScale, view: CENTER });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (clickReleaseTimer.current !== null) {
      window.clearTimeout(clickReleaseTimer.current);
      clickReleaseTimer.current = null;
    }
    pointers.current.set(event.pointerId, eventPoint(event));
    if (pointers.current.size > 1) {
      suppressClick.current = true;
      capturePointers(event.currentTarget, pointers.current.keys());
    }
    gesture.current = gestureFromPointers(
      pointers.current,
      viewportRef.current,
      centerOf(event.currentTarget),
    );
    setGestureActive(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || gesture.current === null) return;
    pointers.current.set(event.pointerId, eventPoint(event));
    const start = gesture.current;

    if (start.kind === "pinch") {
      const [first, second] = [...pointers.current.values()];
      if (first === undefined || second === undefined) return;
      const currentCenter = midpoint(first, second);
      const nextScale = clampScale(start.scale * distance(first, second) / start.distance);
      const anchor = {
        x: (start.center.x - start.stageCenter.x - start.view.x) / start.scale,
        y: (start.center.y - start.stageCenter.y - start.view.y) / start.scale,
      };
      const nextView = boundedPoint({
        x: currentCenter.x - start.stageCenter.x - anchor.x * nextScale,
        y: currentCenter.y - start.stageCenter.y - anchor.y * nextScale,
      }, nextScale);
      suppressClick.current = true;
      capturePointers(event.currentTarget, pointers.current.keys());
      commitViewport({ scale: nextScale, view: nextView });
      return;
    }

    const current = pointers.current.get(start.pointerId);
    if (current === undefined) return;
    const dx = current.x - start.point.x;
    const dy = current.y - start.point.y;
    if (Math.hypot(dx, dy) > 5) {
      suppressClick.current = true;
      capturePointers(event.currentTarget, [event.pointerId]);
    }
    commitViewport({
      scale: viewportRef.current.scale,
      view: boundedPoint({ x: start.view.x + dx, y: start.view.y + dy }, viewportRef.current.scale),
    });
  };

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gesture.current = gestureFromPointers(
      pointers.current,
      viewportRef.current,
      centerOf(event.currentTarget),
    );
    if (gesture.current !== null) return;

    setGestureActive(false);
    clickReleaseTimer.current = window.setTimeout(() => {
      suppressClick.current = false;
      clickReleaseTimer.current = null;
    }, 0);
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
      const current = viewportRef.current;
      commitViewport({
        scale: current.scale,
        view: boundedPoint({ x: current.view.x + delta.x, y: current.view.y + delta.y }, current.scale),
      });
    }
  };

  const zoomTo = (next: number) => {
    const current = viewportRef.current;
    const scale = clampScale(next);
    commitViewport({ scale, view: boundedPoint(current.view, scale) });
  };

  const { scale, view } = viewport;

  return {
    zoom: {
      scale,
      zoomIn: () => zoomTo(scale + SCALE_STEP),
      zoomOut: () => zoomTo(scale - SCALE_STEP),
      reset,
      canZoomIn: scale < MAX_SCALE,
      canZoomOut: scale > MIN_SCALE,
      isDefault: scale === defaultScale && view.x === 0 && view.y === 0,
    },
    transformStyle: {
      "--board-pan-x": `${view.x}px`,
      "--board-pan-y": `${view.y}px`,
      "--board-scale": scale,
    } as CSSProperties,
    viewportProps: {
      role: "region" as const,
      "aria-label": "可移动地图视口",
      "data-gesture-active": gestureActive ? "true" : undefined,
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

function gestureFromPointers(
  pointers: ReadonlyMap<number, Point>,
  viewport: ViewportState,
  stageCenter: Point,
): GestureStart | null {
  const entries = [...pointers.entries()];
  const first = entries[0];
  if (first === undefined) return null;
  const second = entries[1];
  if (second === undefined) {
    return { kind: "pan", pointerId: first[0], view: viewport.view, point: first[1] };
  }
  return {
    kind: "pinch",
    view: viewport.view,
    scale: viewport.scale,
    center: midpoint(first[1], second[1]),
    distance: Math.max(1, distance(first[1], second[1])),
    stageCenter,
  };
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(scale.toFixed(2))));
}

function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function centerOf(element: HTMLDivElement): Point {
  const bounds = element.getBoundingClientRect();
  return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
}

function capturePointers(element: HTMLDivElement, pointerIds: Iterable<number>): void {
  for (const pointerId of pointerIds) {
    if (!element.hasPointerCapture(pointerId)) element.setPointerCapture(pointerId);
  }
}

function boundedPoint(view: Point, scale: number): Point {
  // At scale 1 the whole board already fits, so panning would only push it off
  // screen. Past that the slack grows with the zoom, or the far corners of a
  // magnified board stay out of reach.
  const maxOffset = scale > 1 ? PAN_LIMIT * scale : 0;
  return {
    x: maxOffset === 0 ? 0 : Math.min(maxOffset, Math.max(-maxOffset, view.x)),
    y: maxOffset === 0 ? 0 : Math.min(maxOffset, Math.max(-maxOffset, view.y)),
  };
}

function eventPoint(event: PointerEvent<HTMLDivElement>): Point {
  return { x: event.clientX, y: event.clientY };
}
