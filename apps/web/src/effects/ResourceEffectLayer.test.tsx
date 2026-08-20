// @vitest-environment jsdom

import { resourceAmounts } from "@catan/game-core";
import type { PublicGameEffectView } from "@catan/protocol";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { measureFlights, ResourceEffectLayer } from "./ResourceEffectLayer.js";

describe("resource flight measurement", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
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
        }}
        onComplete={onComplete}
      />,
    );

    expect(container.querySelectorAll("[data-resource-flight]")).toHaveLength(0);
    act(() => vi.advanceTimersByTime(321));
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
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
