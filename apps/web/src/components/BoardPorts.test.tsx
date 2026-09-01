// @vitest-environment jsdom
import { createGame, type PlayerSeed } from "@catan/game-core";
import { projectGameForPlayer } from "@catan/protocol";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { BoardPorts } from "./BoardMap.js";
import { ResourceIcon } from "./ResourceIcon.js";

const players: PlayerSeed[] = [
  { id: "p1", name: "甲", color: "terracotta" }, { id: "p2", name: "乙", color: "ocean" },
  { id: "p3", name: "丙", color: "pine" }, { id: "p4", name: "丁", color: "wheat" },
  { id: "p5", name: "戊", color: "plum" }, { id: "p6", name: "己", color: "charcoal" },
];

it.each([4, 6] as const)("renders narrow icon-over-ratio ports without visible Chinese for %i seats", (count) => {
  const state = createGame({ id: "ports", seed: 42, players: players.slice(0, count), ruleProfile: count === 6 ? "extended-5-6" : "base-3-4" });
  const game = projectGameForPlayer(state, "p1");
  const document = new DOMParser().parseFromString(renderToStaticMarkup(<svg><BoardPorts map={game.map} /></svg>), "image/svg+xml");
  const ports = document.querySelectorAll("[data-port-id]");
  expect(ports).toHaveLength(game.map.ports.length);
  for (const port of ports) {
    const generic = port.getAttribute("data-port-resource") === "generic";
    const sign = port.querySelector(".port-sign")!;
    expect(sign.querySelector(":scope > rect")?.getAttribute("width")).toBe("48");
    expect(sign.querySelector(":scope > rect")?.getAttribute("height")).toBe("56");
    expect(sign.querySelector(".port-type-icon")?.getAttribute("transform")).toBe("translate(0 -13.5)");
    expect(sign.textContent).toBe(generic ? "3:1" : "2:1");
    expect(sign.querySelector(".port-resource-icon")?.getAttribute("transform")).toBe("scale(0.631578947368421)");
    expect(sign.querySelector(".port-ratio")?.getAttribute("y")).toBe("15");
    expect(sign.querySelector(".port-ratio")?.getAttribute("style")).toContain("font-size:21px");
    expect(port.getAttribute("aria-label")).toContain(generic ? "通用港口，三换一" : "港口，二换一");
    expect(sign.querySelector("[data-port-resource-icon]")?.getAttribute("data-port-resource-icon"))
      .toBe(generic ? "unknown" : port.getAttribute("data-port-resource"));
    if (generic) {
      expect(sign.querySelector(".port-type-icon circle")).toBeNull();
      expect(sign.querySelector(".port-type-icon path")).not.toBeNull();
    }
  }
});

it("keeps the unknown-card ring unchanged outside port icons", () => {
  const markup = renderToStaticMarkup(<svg><ResourceIcon kind="unknown" context="card" /></svg>);
  expect(markup).toContain('<circle class="resource-icon-primary" r="15"');
});
