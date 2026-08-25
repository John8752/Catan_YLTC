import { createBaseGame, type GameState } from "@catan/game-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTION_TIMEOUT_MS, ROLL_TIMEOUT_MS, TurnTimerManager } from "./turn-timer.js";

const PLAYERS = [
  { id: "player_1", name: "林", color: "terracotta" as const },
  { id: "player_2", name: "周", color: "ocean" as const },
  { id: "player_3", name: "陈", color: "pine" as const },
];

afterEach(() => {
  vi.useRealTimers();
});

describe("server phase timer", () => {
  it("does not schedule setup or mandatory resolution stages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const manager = new TurnTimerManager(() => Date.now());
    const game = createBaseGame({ id: "game_timer_setup", seed: 31, players: PLAYERS });
    const expired = vi.fn();

    manager.sync("room_1", game, expired);
    expect(manager.view("room_1")).toBeNull();
    manager.sync("room_1", withPhase(game, { kind: "turn", activePlayerId: "player_1", step: "robber", turnNumber: 1 }), expired);
    expect(manager.view("room_1")).toBeNull();
    vi.advanceTimersByTime(10 * 60_000);
    expect(expired).not.toHaveBeenCalled();
  });

  it("expires roll after five seconds and preserves one action deadline across commands", () => {
    vi.useFakeTimers();
    vi.setSystemTime(200_000);
    const manager = new TurnTimerManager(() => Date.now());
    const base = createBaseGame({ id: "game_timer_turn", seed: 32, players: PLAYERS });
    const expired = vi.fn();
    const roll = withPhase(base, { kind: "turn", activePlayerId: "player_1", step: "roll", turnNumber: 1 });

    manager.sync("room_1", roll, expired);
    expect(manager.view("room_1")).toEqual({
      playerId: "player_1",
      kind: "roll",
      durationMs: ROLL_TIMEOUT_MS,
      deadlineAt: 200_000 + ROLL_TIMEOUT_MS,
      serverNow: 200_000,
    });
    vi.advanceTimersByTime(ROLL_TIMEOUT_MS - 1);
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expired).toHaveBeenCalledWith(expect.objectContaining({
      playerId: "player_1",
      command: { type: "RollDice" },
    }));

    const action = withPhase(base, { kind: "turn", activePlayerId: "player_1", step: "action", turnNumber: 1 });
    manager.sync("room_1", action, expired);
    const originalDeadline = manager.view("room_1")?.deadlineAt;
    vi.advanceTimersByTime(60_000);
    manager.sync("room_1", { ...action, revision: action.revision + 1 }, expired);
    expect(manager.view("room_1")?.deadlineAt).toBe(originalDeadline);
    vi.advanceTimersByTime(ACTION_TIMEOUT_MS - 60_000);
    expect(expired).toHaveBeenLastCalledWith(expect.objectContaining({
      playerId: "player_1",
      command: { type: "EndTurn" },
    }));
  });

  it("gives a paired player their own action deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(300_000);
    const manager = new TurnTimerManager(() => Date.now());
    const base = createBaseGame({ id: "game_timer_pair", seed: 33, players: PLAYERS });
    manager.sync("room_1", withPhase(base, {
      kind: "turn",
      activePlayerId: "player_2",
      primaryPlayerId: "player_1",
      step: "paired-action",
      turnNumber: 1,
    }), vi.fn());

    expect(manager.view("room_1")).toMatchObject({
      playerId: "player_2",
      kind: "action",
      durationMs: ACTION_TIMEOUT_MS,
    });
  });
});

function withPhase(game: GameState, phase: GameState["phase"]): GameState {
  return { ...game, phase };
}
