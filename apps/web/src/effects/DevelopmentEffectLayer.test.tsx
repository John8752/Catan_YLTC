// @vitest-environment jsdom

import type { PublicGameEffectView } from "@catan/protocol";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevelopmentEffectLayer } from "./DevelopmentEffectLayer.js";

describe("DevelopmentEffectLayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("shows the public monopoly result and the viewer's own loss", () => {
    const onComplete = vi.fn();
    const effect = {
      id: "4:development-card:player_1:monopoly",
      revision: 4,
      kind: "development-card-play",
      playerId: "player_1",
      card: { type: "monopoly", resource: "ore", total: 5, ownLoss: 3 },
    } satisfies PublicGameEffectView;

    const { getByRole } = render(
      <DevelopmentEffectLayer
        effect={effect}
        currentPlayerId="player_2"
        playerName={() => "林"}
        onComplete={onComplete}
      />,
    );

    expect(getByRole("status").textContent).toContain("林使用了「垄断」");
    expect(getByRole("status").textContent).toContain("共获得 5 张");
    expect(getByRole("status").textContent).toContain("你交出 3 张");
    act(() => vi.advanceTimersByTime(1_650));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("uses second-person instructions for the player who played road building", () => {
    const { getByRole } = render(
      <DevelopmentEffectLayer
        effect={{
          id: "5:development-card:player_1:road-building",
          revision: 5,
          kind: "development-card-play",
          playerId: "player_1",
          card: { type: "road-building", roadsGranted: 2 },
        }}
        currentPlayerId="player_1"
        playerName={() => "林"}
        onComplete={vi.fn()}
      />,
    );

    expect(getByRole("status").textContent).toContain("你使用了「道路建设」");
    expect(getByRole("status").textContent).toContain("可免费放置 2 条道路");
  });

  it("pulses the authoritative road target and reports completion", () => {
    const road = document.createElementNS("http://www.w3.org/2000/svg", "g");
    road.setAttribute("data-piece-location", "edge_4");
    const animate = vi.fn();
    Object.defineProperty(road, "animate", { configurable: true, value: animate });
    document.body.append(road);

    const { getByRole } = render(
      <DevelopmentEffectLayer
        effect={{
          id: "6:free-road:player_1:edge_4",
          revision: 6,
          kind: "free-road-built",
          playerId: "player_1",
          edgeId: "edge_4",
          placed: 2,
          total: 2,
          completed: true,
        }}
        currentPlayerId="player_2"
        playerName={() => "林"}
        onComplete={vi.fn()}
      />,
    );

    expect(getByRole("status").textContent).toContain("2/2 · 放置完成");
    expect(animate).toHaveBeenCalledOnce();
  });

  it("keeps a short readable status while suppressing travel motion", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    const road = document.createElementNS("http://www.w3.org/2000/svg", "g");
    road.setAttribute("data-piece-location", "edge_reduced");
    const animate = vi.fn();
    Object.defineProperty(road, "animate", { configurable: true, value: animate });
    document.body.append(road);
    const onComplete = vi.fn();

    render(
      <DevelopmentEffectLayer
        effect={{
          id: "7:free-road:player_1:edge_reduced",
          revision: 7,
          kind: "free-road-built",
          playerId: "player_1",
          edgeId: "edge_reduced",
          placed: 1,
          total: 2,
          completed: false,
        }}
        currentPlayerId="player_1"
        playerName={() => "林"}
        onComplete={onComplete}
      />,
    );

    expect(animate.mock.calls[0]?.[0]).toEqual([
      { filter: "brightness(1)" },
      { filter: "brightness(1.5)" },
      { filter: "brightness(1)" },
    ]);
    act(() => vi.advanceTimersByTime(699));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
