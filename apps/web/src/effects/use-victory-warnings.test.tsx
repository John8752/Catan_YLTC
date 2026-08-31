// @vitest-environment jsdom
import { createBaseGame } from "@catan/game-core";
import { projectGameForPlayer, type GameView, type VictoryWarningEffectView } from "@catan/protocol";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useVictoryWarnings, VICTORY_WARNING_DURATION_MS } from "./use-victory-warnings.js";
import { useGameEffectQueue } from "./use-game-effect-queue.js";

const base = createBaseGame({ id: "warnings-ui", seed: 42, players: [
  { id: "p1", name: "林", color: "terracotta" }, { id: "p2", name: "周", color: "ocean" }, { id: "p3", name: "陈", color: "pine" },
] });
const warning = (tier: 3 | 2 | 1 = 3, revision = 2, playerId = "p1"): VictoryWarningEffectView => ({
  kind: "victory-warning", id: `warning:${playerId}:${tier}`, revision, playerId, playerName: playerId, publicPoints: 10 - tier, targetPoints: 10, tier,
});
function game(revision: number, warnings: readonly VictoryWarningEffectView[] = [], score = 7): GameView {
  return { ...projectGameForPlayer({ ...base, revision, phase: { kind: "turn", step: "action", activePlayerId: "p1", turnNumber: 1 },
    players: base.players.map((player) => ({ ...player, visibleVictoryPoints: score })),
  }, "p1"), effects: warnings };
}
const props = (value: GameView, blocked = false, epoch = 1, live = true) => ({ game: value, blocked, epoch, live });
const hook = ({ game, blocked, epoch, live }: ReturnType<typeof props>) => useVictoryWarnings(game, epoch, live, blocked);
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("gives each live milestone three seconds, ignoring duplicates and stale responses", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(hook, { initialProps: props(game(1)) });
  rerender(props(game(2, [warning()])));
  expect(result.current?.tier).toBe(3);
  act(() => vi.advanceTimersByTime(2_000));
  rerender(props(game(2, [warning()])));
  rerender(props(game(1)));
  act(() => vi.advanceTimersByTime(1_000));
  expect(result.current).toBeNull();
  rerender(props(game(3, [warning()])));
  expect(result.current).toBeNull();
});

it("waits behind action notices and restarts visible time if an action interrupts", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(hook, { initialProps: props(game(1)) });
  const update = game(2, [warning()]);
  rerender(props(update, true));
  act(() => vi.advanceTimersByTime(2_000));
  expect(result.current).toBeNull();
  rerender(props(update));
  expect(result.current?.tier).toBe(3);
  act(() => vi.advanceTimersByTime(2_000));
  rerender(props(update, true));
  act(() => vi.advanceTimersByTime(2_000));
  expect(result.current).toBeNull();
  rerender(props(update));
  act(() => vi.advanceTimersByTime(VICTORY_WARNING_DURATION_MS - 1));
  expect(result.current?.tier).toBe(3);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toBeNull();
});

it("upgrades pending milestones, queues different players and drops warnings after a score loss", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(hook, { initialProps: props(game(1)) });
  rerender(props(game(2, [warning()]), true));
  rerender(props(game(3, [warning(), warning(1, 3), warning(3, 3, "p2")], 9)));
  expect(result.current?.tier).toBe(1);
  act(() => vi.advanceTimersByTime(VICTORY_WARNING_DURATION_MS));
  expect(result.current?.playerId).toBe("p2");
  rerender(props(game(4, [warning(3, 3, "p2")], 6)));
  expect(result.current).toBeNull();
  rerender(props(game(5, [warning(3, 3, "p2")], 7)));
  expect(result.current).toBeNull();
});

it("suppresses initial/reconnect milestones and cancels on finish or seat change", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(hook, { initialProps: props(game(2, [warning()])) });
  expect(result.current).toBeNull();
  rerender(props(game(3, [warning(2, 3)], 8)));
  expect(result.current?.tier).toBe(2);
  rerender(props(game(3, [warning(2, 3)], 8), false, 1, false));
  expect(result.current).toBeNull();
  rerender(props(game(4, [warning(1, 4)], 9), false, 2));
  expect(result.current).toBeNull();
  rerender(props({ ...game(5, [warning(3, 5, "p2")]), phase: { kind: "finished", winnerId: "p1" } }, false, 2));
  expect(result.current).toBeNull();
  const other = game(6, [warning(3, 6, "p2")]);
  rerender(props({ ...other, you: { ...other.you, id: "p2" } }, false, 2));
  expect(result.current).toBeNull();
});

it("never puts a near-victory notice in the reward animation queue", () => {
  const { result, rerender } = renderHook(({ value }) => useGameEffectQueue(value), { initialProps: { value: game(1) } });
  rerender({ value: game(2, [warning()]) });
  expect(result.current.activeEffect).toBeNull();
});
