// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createCamelUp, executeCamelUp, RACING_CAMELS } from "@catan/game-core/camel-up";
import { projectCamelUp } from "@catan/protocol/camel-up";
import { useRaceFeedback } from "./use-race-feedback.js";
function states() {
  const first = createCamelUp("m", ["a", "b", "c"].map(id => ({ id, name: id })), { positions: [1, 2, 3, 1, 2], order: RACING_CAMELS, crazyPositions: [1, 2] });
  const next = executeCamelUp(first, "a", { type: "ticket", camel: "blue", matchId: "m", expectedRevision: 0 });
  return { first: projectCamelUp(first, "a"), next: projectCamelUp(next, "a") };
}
afterEach(() => vi.useRealTimers());
it("plays a live accepted action once and clears it after its display interval", () => {
  vi.useFakeTimers(); const { first, next } = states();
  const hook = renderHook(({ game, epoch }) => useRaceFeedback(game, epoch), { initialProps: { game: first, epoch: 1 } });
  expect(hook.result.current).toBeNull(); hook.rerender({ game: next, epoch: 1 }); expect(hook.result.current?.type).toBe("ticket");
  act(() => vi.advanceTimersByTime(2200)); expect(hook.result.current).toBeNull();
  hook.rerender({ game: { ...next }, epoch: 1 }); expect(hook.result.current).toBeNull();
});
it("does not replay an existing effect on mount, reconnect or a skipped revision", () => {
  const { first, next } = states();
  const hook = renderHook(({ game, epoch }) => useRaceFeedback(game, epoch), { initialProps: { game: next, epoch: 1 } }); expect(hook.result.current).toBeNull();
  hook.rerender({ game: { ...next, revision: 2 }, epoch: 2 }); expect(hook.result.current).toBeNull();
  hook.rerender({ game: { ...next, revision: 8 }, epoch: 2 }); expect(hook.result.current).toBeNull();
  hook.rerender({ game: { ...first, id: "new" }, epoch: 2 }); expect(hook.result.current).toBeNull();
});
