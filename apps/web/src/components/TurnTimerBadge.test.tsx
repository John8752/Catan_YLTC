// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBaseGame, type GameState } from "@catan/game-core";
import { projectGameForPlayer } from "@catan/protocol";
import { OpponentStrip } from "./OpponentStrip.js";
import { PlayerDock } from "./PlayerDock.js";
import { TurnTimerBadge } from "./TurnTimerBadge.js";

const PLAYERS = [
  { id: "player_1", name: "林", color: "terracotta" as const },
  { id: "player_2", name: "周", color: "ocean" as const },
  { id: "player_3", name: "陈", color: "pine" as const },
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TurnTimerBadge", () => {
  it("counts a roll deadline down from five seconds using the server clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(900_000);
    render(<TurnTimerBadge timer={{
      playerId: "player_1",
      kind: "roll",
      durationMs: 5_000,
      deadlineAt: 105_000,
      serverNow: 100_000,
    }} />);

    expect(screen.getByRole("timer").textContent).toContain("0:05");
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole("timer").textContent).toContain("0:04");
    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.getByRole("timer").textContent).toContain("0:00");
  });

  it("formats the action deadline as two minutes", () => {
    vi.useFakeTimers();
    render(<TurnTimerBadge timer={{
      playerId: "player_2",
      kind: "action",
      durationMs: 120_000,
      deadlineAt: 220_000,
      serverNow: 100_000,
    }} />);

    expect(screen.getByRole("timer").textContent).toContain("2:00");
    expect(screen.getByRole("timer").getAttribute("aria-label")).toContain("操作倒计时");
  });

  it("places the timer outside the active opponent card and above the local dock", () => {
    const opponentGame = turnView("player_2", "roll");
    const { container: opponents } = render(<OpponentStrip game={opponentGame} />);
    expect(opponents.querySelector('[data-player-id="player_2"] [data-turn-timer-slot="opponent"] [role="timer"]')).not.toBeNull();
    expect(opponents.querySelector('[data-player-id="player_3"] [role="timer"]')).toBeNull();
    cleanup();

    const ownGame = turnView("player_1", "action");
    const { container: dock } = render(<PlayerDock
      game={ownGame}
      busy={false}
      onCommand={() => undefined}
      buildMode={null}
      selectedRobberHexId={null}
      onBuildModeChange={() => undefined}
    />);
    expect(dock.querySelector('[data-turn-timer-slot="self"] [role="timer"]')).not.toBeNull();
    expect(dock.querySelector('[data-current-player="true"] [role="timer"]')).toBeNull();
  });
});

function turnView(activePlayerId: string, step: "roll" | "action") {
  const base = createBaseGame({ id: "game_timer_badge", seed: 34, players: PLAYERS });
  const state: GameState = {
    ...base,
    phase: { kind: "turn", activePlayerId, step, turnNumber: 1 },
  };
  return projectGameForPlayer(state, "player_1", [], {
    playerId: activePlayerId,
    kind: step,
    durationMs: step === "roll" ? 5_000 : 120_000,
    deadlineAt: 105_000,
    serverNow: 100_000,
  });
}
