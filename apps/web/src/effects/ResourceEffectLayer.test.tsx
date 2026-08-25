// @vitest-environment jsdom

import { resourceAmounts } from "@catan/game-core";
import type { PublicGameEffectView } from "@catan/protocol";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measureFlights, measureRobberMove, ResourceEffectLayer } from "./ResourceEffectLayer.js";

describe("resource flight measurement", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("merges equal resources and aims at the private resource card or public player row", () => {
    const root = document.createElement("div");
    document.body.append(root);
    addRect(root, "hex-id", "hex_1", 80, 80, 40, 40);
    addRect(root, "hex-id", "hex_2", 180, 80, 40, 40);
    addRect(root, "resource-target", "player_1:brick", 480, 580, 80, 50);
    addRect(root, "player-target", "player_2", 900, 420, 220, 70);

    const effect: PublicGameEffectView = {
      id: "9:resources-produced",
      revision: 9,
      kind: "resource-grant",
      reason: "production",
      grants: [
        { playerId: "player_1", resources: resourceAmounts({ brick: 2 }) },
        { playerId: "player_2", resources: resourceAmounts({ ore: 1 }) },
      ],
      sources: [
        { playerId: "player_1", resource: "brick", amount: 1, hexId: "hex_1", vertexId: "vertex_1" },
        { playerId: "player_1", resource: "brick", amount: 1, hexId: "hex_2", vertexId: "vertex_2" },
        { playerId: "player_2", resource: "ore", amount: 1, hexId: "hex_2", vertexId: "vertex_3" },
      ],
      triggeredHexIds: ["hex_1", "hex_2"],
    };

    const flights = measureFlights(effect, root);

    expect(flights).toHaveLength(2);
    expect(flights[0]).toMatchObject({
      playerId: "player_1",
      resource: "brick",
      amount: 2,
      startX: 150,
      startY: 100,
      endX: 520,
      endY: 605,
    });
    expect(flights[1]).toMatchObject({ playerId: "player_2", resource: "ore", endX: 1010, endY: 455 });
  });

  it("starts player transfers at the source player and uses a concealed card when required", () => {
    const root = document.createElement("div");
    document.body.append(root);
    addRect(root, "player-target", "player_1", 600, 500, 120, 60);
    addRect(root, "player-target", "player_2", 900, 300, 120, 60);

    const flights = measureFlights({
      id: "12:robber-transfer:player_1",
      revision: 12,
      kind: "resource-transfer",
      reason: "robber",
      transfers: [{ playerId: "player_1", sourcePlayerId: "player_2", amount: 1, resource: null }],
    }, root);

    expect(flights).toEqual([
      expect.objectContaining({ resource: "unknown", startX: 960, startY: 330, endX: 660, endY: 530 }),
    ]);
  });

  it("moves spent cards from the player's resource row into the new board piece", () => {
    const root = document.createElement("div");
    document.body.append(root);
    addRect(root, "resource-target", "player_1:brick", 100, 500, 80, 50);
    addRect(root, "resource-target", "player_1:lumber", 200, 500, 80, 50);
    addRect(root, "piece-location", "edge_4", 500, 250, 100, 20);

    const flights = measureFlights({
      id: "14:resource-spend:player_1:road",
      revision: 14,
      kind: "resource-spend",
      playerId: "player_1",
      resources: resourceAmounts({ brick: 1, lumber: 1 }),
      destination: { kind: "build", piece: "road", locationId: "edge_4" },
    }, root);

    expect(flights).toHaveLength(2);
    expect(flights).toEqual(expect.arrayContaining([
      expect.objectContaining({ resource: "brick", direction: "spend", startX: 140, endX: 550, endY: 260 }),
      expect.objectContaining({ resource: "lumber", direction: "spend", startX: 240, endX: 550, endY: 260 }),
    ]));
  });

  it("measures a robber arc between the authoritative source and destination hexes", () => {
    const root = document.createElement("div");
    document.body.append(root);
    addRect(root, "hex-id", "hex_old", 100, 200, 60, 60);
    addRect(root, "hex-id", "hex_new", 400, 500, 60, 60);

    expect(measureRobberMove({
      id: "15:robber-move:player_1",
      revision: 15,
      kind: "robber-move",
      playerId: "player_1",
      fromHexId: "hex_old",
      toHexId: "hex_new",
    }, root)).toEqual({ startX: 130, startY: 230, midX: 280, midY: 334, endX: 430, endY: 530 });
  });

  it("renders the shared resource card inside a visible flight", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    addRect(document.body, "resource-source", "bank", 900, 100, 80, 50);
    addRect(document.body, "resource-target", "player_1:grain", 300, 600, 80, 50);

    const { container } = render(
      <ResourceEffectLayer
        effect={{
          id: "13:maritime-trade:player_1",
          revision: 13,
          kind: "resource-grant",
          reason: "maritime-trade",
          grants: [{ playerId: "player_1", resources: resourceAmounts({ grain: 1 }), origin: { kind: "bank" } }],
          sources: [],
          triggeredHexIds: [],
        }}
        onComplete={vi.fn()}
      />,
    );

    const flight = container.querySelector<HTMLElement>('[data-resource-flight="player_1:grain"]');
    expect(flight?.querySelector('[data-resource-card="grain"]')).not.toBeNull();
    expect(flight?.style.getPropertyValue("--flight-duration")).toBe("1000ms");
    expect(container.querySelector<HTMLElement>(".resource-arrival-pop")?.style.getPropertyValue("--arrival-delay")).toBe("900ms");
  });

  it("removes flight motion while retaining a short reduced-motion feedback cycle", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    const onComplete = vi.fn();
    const { container } = render(
      <ResourceEffectLayer
        effect={{
          id: "10:resources-produced",
          revision: 10,
          kind: "resource-grant",
          reason: "production",
          grants: [{ playerId: "player_1", resources: resourceAmounts({ wool: 1 }) }],
          sources: [{ playerId: "player_1", resource: "wool", amount: 1, hexId: "hex_1", vertexId: "vertex_1" }],
          triggeredHexIds: ["hex_1"],
        }}
        onComplete={onComplete}
      />,
    );

    expect(container.querySelectorAll("[data-resource-flight]")).toHaveLength(0);
    act(() => vi.advanceTimersByTime(321));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shakes a triggered hex even when the event grants no resources", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    const hex = document.createElementNS("http://www.w3.org/2000/svg", "g");
    hex.setAttribute("data-hex-id", "hex_unclaimed");
    const content = document.createElementNS("http://www.w3.org/2000/svg", "g");
    content.setAttribute("class", "hex-content");
    const animate = vi.fn();
    Object.defineProperty(content, "animate", { configurable: true, value: animate });
    hex.append(content);
    document.body.append(hex);

    const { container } = render(
      <ResourceEffectLayer
        effect={{
          id: "11:resources-produced",
          revision: 11,
          kind: "resource-grant",
          reason: "production",
          grants: [],
          sources: [],
          triggeredHexIds: ["hex_unclaimed"],
        }}
        onComplete={vi.fn()}
      />,
    );

    expect(container.querySelectorAll("[data-resource-flight]")).toHaveLength(0);
    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.calls[0]?.[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ transform: expect.stringContaining("translateX") }),
    ]));
  });

  it("keeps the robber in flight for one second before completing the effect", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    addRect(document.body, "hex-id", "hex_old", 100, 200, 60, 60);
    addRect(document.body, "hex-id", "hex_new", 400, 500, 60, 60);
    const robber = document.createElementNS("http://www.w3.org/2000/svg", "g");
    robber.setAttribute("data-robber-piece", "true");
    document.body.append(robber);
    const onComplete = vi.fn();

    const { container } = render(<ResourceEffectLayer effect={{
      id: "16:robber-move:player_1",
      revision: 16,
      kind: "robber-move",
      playerId: "player_1",
      fromHexId: "hex_old",
      toHexId: "hex_new",
    }} onComplete={onComplete} />);

    expect(container.querySelector(".robber-flight")).not.toBeNull();
    expect(container.querySelector<HTMLElement>(".robber-flight")?.style.getPropertyValue("--robber-flight-duration")).toBe("1000ms");
    expect(robber.style.opacity).toBe("0");
    act(() => vi.advanceTimersByTime(899));
    expect(onComplete).not.toHaveBeenCalled();
    expect(robber.style.opacity).toBe("0");
    act(() => vi.advanceTimersByTime(1));
    expect(robber.style.opacity).toBe("");
    act(() => vi.advanceTimersByTime(280));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shows a prominent named score gain through its full feedback window", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    const onComplete = vi.fn();
    const { container } = render(<ResourceEffectLayer effect={{
      id: "17:score:player_1:city",
      revision: 17,
      kind: "score-change",
      playerId: "player_1",
      delta: 1,
      reason: "city",
    }} playerName={() => "林"} onComplete={onComplete} />);

    expect(container.querySelector(".score-effect")?.textContent).toContain("林");
    expect(container.querySelector(".score-effect")?.textContent).toContain("+1 分");
    expect(container.querySelector(".score-effect")?.textContent).toContain("村庄升级为城市");
    act(() => vi.advanceTimersByTime(1_849));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});

function addRect(
  root: HTMLElement,
  dataName: string,
  dataValue: string,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  const element = document.createElement("div");
  element.setAttribute(`data-${dataName}`, dataValue);
  element.getBoundingClientRect = () => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  });
  root.append(element);
}
