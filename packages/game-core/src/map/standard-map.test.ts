import { describe, expect, it } from "vitest";
import { createStandardMap } from "./standard-map.js";

describe("standard map topology", () => {
  it("exposes the complete canonical land graph", () => {
    const map = createStandardMap(42);

    expect(map.hexes).toHaveLength(19);
    expect(map.vertices).toHaveLength(54);
    expect(map.edges).toHaveLength(72);
    expect(map.edges.filter((edge) => edge.adjacentHexIds.length === 1)).toHaveLength(30);
    expect(map.ports).toHaveLength(9);
  });

  it("keeps adjacency symmetric and references canonical locations", () => {
    const map = createStandardMap(42);
    const vertices = new Map(map.vertices.map((vertex) => [vertex.id, vertex]));

    for (const edge of map.edges) {
      expect(edge.vertexIds).toHaveLength(2);
      const [firstId, secondId] = edge.vertexIds;
      const first = vertices.get(firstId);
      const second = vertices.get(secondId);

      expect(first?.adjacentVertexIds).toContain(secondId);
      expect(second?.adjacentVertexIds).toContain(firstId);
    }
  });

  it("generates deterministic fair content and ports", () => {
    const first = createStandardMap(20260820);
    const second = createStandardMap(20260820);
    const hotHexes = first.hexes.filter((hex) => hex.numberToken === 6 || hex.numberToken === 8);

    expect(first).toEqual(second);
    expect(hotHexes).toHaveLength(4);

    for (const hex of hotHexes) {
      const neighbors = new Set(hex.adjacentHexIds);
      expect(hotHexes.some((other) => other.id !== hex.id && neighbors.has(other.id))).toBe(false);
    }

    expect(first.ports.filter((port) => port.kind === "generic")).toHaveLength(4);
    expect(first.ports.filter((port) => port.kind === "resource")).toHaveLength(5);
  });
});
