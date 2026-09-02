import { createGame } from "@catan/game-core";
import { projectGameForPlayer } from "@catan/protocol";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TurnForecastBar } from "./TurnForecastBar.js";

const players = [
  { id: "p1", name: "阿木", color: "terracotta" as const },
  { id: "p2", name: "小林", color: "ocean" as const },
  { id: "p3", name: "老周", color: "pine" as const },
  { id: "p4", name: "小陈", color: "wheat" as const },
  { id: "p5", name: "布局验收", color: "plum" as const },
  { id: "p6", name: "阿禾", color: "charcoal" as const },
];

describe("TurnForecastBar", () => {
  it("shows current, next and the viewer's paired opportunity", () => {
    const base = createGame({ id: "forecast", seed: 42, players, ruleProfile: "extended-5-6" });
    const game = projectGameForPlayer({
      ...base,
      phase: { kind: "turn", activePlayerId: "p1", step: "action", turnNumber: 4 },
    }, "p5");

    const markup = renderToStaticMarkup(<TurnForecastBar game={game} />);

    expect(markup).toContain("再过 2 次操作 · 搭档行动");
    expect(markup).toContain('data-turn-queue-player="p1"');
    expect(markup).toContain('data-turn-queue-player="p2"');
    expect(markup).toContain('data-turn-queue-player="p3"');
    expect(markup).toContain('data-turn-queue-player="p4"');
    expect(markup).toContain('data-turn-queue-player="p5"');
    expect(markup).toContain('data-turn-queue-player="p6"');
    expect(markup).not.toContain("+1");
    expect(markup).toContain("你");
  });

  it("turns into an immediate prompt when the viewer is active", () => {
    const base = createGame({ id: "forecast_self", seed: 42, players, ruleProfile: "extended-5-6" });
    const game = projectGameForPlayer({
      ...base,
      phase: { kind: "turn", activePlayerId: "p4", primaryPlayerId: "p1", step: "paired-action", turnNumber: 4 },
    }, "p4");

    const markup = renderToStaticMarkup(<TurnForecastBar game={game} />);

    expect(markup).toContain("轮到你了 · 搭档行动");
    expect(markup).toContain('data-turn-forecast-distance="0"');
    expect(markup).toContain('data-turn-queue-current="true"');
    expect(markup).toContain('data-turn-queue-self="true"');
  });

  it("shows only operation order and leaves the timer to player information", () => {
    const base = createGame({ id: "forecast_timer", seed: 42, players, ruleProfile: "extended-5-6" });
    const game = projectGameForPlayer({
      ...base,
      phase: { kind: "turn", activePlayerId: "p1", step: "action", turnNumber: 4 },
    }, "p5", [], {
      playerId: "p1", kind: "action", durationMs: 120_000, deadlineAt: 220_000, serverNow: 100_000,
    });

    const markup = renderToStaticMarkup(<TurnForecastBar game={game} />);

    expect(markup).not.toContain('data-turn-timer-player="p1"');
    expect(markup).not.toContain('role="timer"');
  });
});
