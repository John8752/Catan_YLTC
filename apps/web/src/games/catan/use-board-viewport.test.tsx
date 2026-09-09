// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type { MouseEvent, PointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBoardViewport } from "./use-board-viewport.js";

afterEach(() => cleanup());

describe("useBoardViewport", () => {
  it("pinches around the two-pointer midpoint and continues with one-pointer panning", () => {
    const target = pointerTarget();
    const { result } = renderHook(() => useBoardViewport(1));

    act(() => result.current.viewportProps.onPointerDown(pointer(1, 100, 150, target)));
    act(() => result.current.viewportProps.onPointerDown(pointer(2, 200, 150, target)));
    act(() => result.current.viewportProps.onPointerMove(pointer(2, 250, 150, target)));

    expect(result.current.zoom.scale).toBe(1.5);
    expect(transformValue(result.current.transformStyle, "--board-pan-x")).toBe("25px");
    expect(transformValue(result.current.transformStyle, "--board-pan-y")).toBe("0px");

    act(() => result.current.viewportProps.onPointerUp(pointer(2, 250, 150, target)));
    act(() => result.current.viewportProps.onPointerMove(pointer(1, 120, 165, target)));

    expect(transformValue(result.current.transformStyle, "--board-pan-x")).toBe("45px");
    expect(transformValue(result.current.transformStyle, "--board-pan-y")).toBe("15px");
  });

  it("clamps pinch zoom and suppresses the click produced by a multi-touch gesture", () => {
    const target = pointerTarget();
    const { result } = renderHook(() => useBoardViewport(1));

    act(() => result.current.viewportProps.onPointerDown(pointer(1, 145, 150, target)));
    act(() => result.current.viewportProps.onPointerDown(pointer(2, 155, 150, target)));
    act(() => result.current.viewportProps.onPointerMove(pointer(2, 400, 150, target)));
    expect(result.current.zoom.scale).toBe(2.6);

    const click = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent<HTMLDivElement>;
    act(() => result.current.viewportProps.onClickCapture(click));
    expect(click.preventDefault).toHaveBeenCalledOnce();
    expect(click.stopPropagation).toHaveBeenCalledOnce();
  });
});

function pointer(
  pointerId: number,
  clientX: number,
  clientY: number,
  currentTarget: HTMLDivElement,
): PointerEvent<HTMLDivElement> {
  return {
    button: 0,
    pointerType: "touch",
    pointerId,
    clientX,
    clientY,
    currentTarget,
  } as unknown as PointerEvent<HTMLDivElement>;
}

function pointerTarget(): HTMLDivElement {
  const captured = new Set<number>();
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 300 }),
    hasPointerCapture: (pointerId: number) => captured.has(pointerId),
    setPointerCapture: (pointerId: number) => captured.add(pointerId),
    releasePointerCapture: (pointerId: number) => captured.delete(pointerId),
  } as unknown as HTMLDivElement;
}

function transformValue(style: object, property: string): unknown {
  return (style as Record<string, unknown>)[property];
}
