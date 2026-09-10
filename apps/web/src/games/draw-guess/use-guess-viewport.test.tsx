// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useGuessViewport } from "./use-guess-viewport.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("uses window resizing when VisualViewport is unavailable", () => {
  vi.useFakeTimers();
  vi.stubGlobal("visualViewport", undefined);
  const { result } = renderHook(() => useGuessViewport(true));
  expect(result.current.style).toMatchObject({ width: innerWidth, height: innerHeight, top: 0 });
  act(() => { vi.stubGlobal("innerHeight", 350); window.dispatchEvent(new Event("resize")); vi.runAllTimers(); });
  expect(result.current.style?.height).toBe(350);
  expect(result.current.compact).toBe(true);
});

it("preserves pinch magnification and releases viewport tracking after the task ends", () => {
  vi.useFakeTimers();
  const viewport = Object.assign(new EventTarget(), { width: 393, height: 659, offsetTop: 0, offsetLeft: 0, scale: 1 });
  vi.stubGlobal("visualViewport", viewport);
  const remove = vi.spyOn(viewport, "removeEventListener");
  const { result, rerender } = renderHook(({ enabled }) => useGuessViewport(enabled), { initialProps: { enabled: true } });
  act(() => { Object.assign(viewport, { scale: 2, width: 196.5, height: 329.5 }); viewport.dispatchEvent(new Event("resize")); vi.runAllTimers(); });
  expect(result.current.style).toMatchObject({ width: 393, height: 659 });
  act(() => { Object.assign(viewport, { scale: 1, width: 393, height: 350 }); viewport.dispatchEvent(new Event("resize")); vi.runAllTimers(); });
  expect(result.current.style?.height).toBe(350);
  rerender({ enabled: false });
  expect(result.current.style).toBeUndefined();
  expect(remove.mock.calls.map(([type]) => type)).toEqual(["resize", "scroll"]);
  act(() => { viewport.dispatchEvent(new Event("resize")); vi.runAllTimers(); });
  expect(result.current.style).toBeUndefined();
});
