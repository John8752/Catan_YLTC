// @vitest-environment jsdom
import { createBaseGame, type GameState } from "@catan/game-core";
import { projectGameForPlayer } from "@catan/protocol";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ATTENTION_DURATION_MS, useActionAttention } from "./use-action-attention.js";

const base = createBaseGame({ id: "attention-ui", seed: 7, players: [
  { id: "p1", name: "自己", color: "terracotta" }, { id: "p2", name: "对手", color: "ocean" }, { id: "p3", name: "丙", color: "pine" },
] });
const view = (revision: number, step: Extract<GameState["phase"], { kind: "turn" }>["step"], activePlayerId = "p1", turnNumber = 1) => projectGameForPlayer({
  ...base, revision, phase: { kind: "turn", step, activePlayerId, turnNumber },
}, "p1");

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("shows a live prompt once for 1.5 seconds, without resetting on duplicate snapshots", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ game }) => useActionAttention(game, 1, true), { initialProps: { game: view(1, "action", "p2") } });
  expect(result.current).toBeNull();
  rerender({ game: view(2, "roll") });
  expect(result.current?.notice).toBe("轮到你了");
  act(() => vi.advanceTimersByTime(1_000));
  rerender({ game: view(2, "roll") });
  rerender({ game: view(3, "action") });
  act(() => vi.advanceTimersByTime(ATTENTION_DURATION_MS - 1_000));
  expect(result.current).toBeNull();
  rerender({ game: view(4, "action") });
  expect(result.current).toBeNull();
  rerender({ game: view(5, "roll", "p1", 2) });
  expect(result.current?.notice).toBe("轮到你了");
});

it("suppresses initial and reconnect snapshots and stale deliveries", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ game, epoch, live }) => useActionAttention(game, epoch, live), {
    initialProps: { game: view(1, "roll"), epoch: 1, live: true },
  });
  expect(result.current).toBeNull();
  rerender({ game: view(2, "action", "p2"), epoch: 1, live: false });
  rerender({ game: view(3, "roll", "p1", 2), epoch: 2, live: true });
  expect(result.current).toBeNull();
  rerender({ game: view(1, "roll"), epoch: 2, live: true });
  expect(result.current).toBeNull();
  rerender({ game: view(4, "action", "p1", 2), epoch: 2, live: true });
  expect(result.current).toBeNull();
});

it("cancels resolved notices immediately and distinguishes robber duty from a turn", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ game }) => useActionAttention(game, 1, true), { initialProps: { game: view(1, "roll") } });
  rerender({ game: view(2, "robber") });
  expect(result.current?.notice).toBe("请移动强盗");
  rerender({ game: view(3, "action") });
  expect(result.current).toBeNull();
  rerender({ game: view(4, "free-road") });
  expect(result.current?.notice).toBe("请放置免费道路");
  rerender({ game: view(5, "action", "p2") });
  expect(result.current).toBeNull();
});
