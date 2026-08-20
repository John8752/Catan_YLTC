import { describe, expect, it } from "vitest";
import { createExtendedMap, createStandardMap } from "./standard-map.js";

describe("standard map topology", () => {
  it("exposes the complete canonical land graph", () => {
    const map = createStandardMap(42);

    expect(map.hexes).toHaveLength(19);
    expect(map.vertices).toHaveLength(54);
    expect(map.edges).toHaveLength(72);
    expect(map.edges.filter((edge) => edge.adjacentHexIds.length === 1)).toHaveLength(30);
    expect(map.ports).toHaveLength(9);
    expect(map.hexes.find((hex) => hex.id === map.robberHexId)?.terrain).toBe("desert");
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

describe("extended 5–6 player map topology", () => {
  it("generates the official 30-hex composition with an expanded graph", () => {
    const map = createExtendedMap(42);
    const count = (terrain: string) => map.hexes.filter((hex) => hex.terrain === terrain).length;

    expect(map.hexes).toHaveLength(30);
    expect(map.vertices).toHaveLength(80);
    expect(map.edges).toHaveLength(109);
    expect(map.edges.filter((edge) => edge.adjacentHexIds.length === 1)).toHaveLength(38);
    expect(map.ports).toHaveLength(11);
    expect(count("lumber")).toBe(6);
    expect(count("wool")).toBe(6);
    expect(count("grain")).toBe(6);
    expect(count("brick")).toBe(5);
    expect(count("ore")).toBe(5);
    expect(count("desert")).toBe(2);
    expect(map.hexes.filter((hex) => hex.numberToken !== null)).toHaveLength(28);
    expect(map.hexes.find((hex) => hex.id === map.robberHexId)?.terrain).toBe("desert");
  });

  it("keeps hot numbers apart and adds the wool and generic extension ports", () => {
    const map = createExtendedMap(20260820);
    const hotHexes = map.hexes.filter((hex) => hex.numberToken === 6 || hex.numberToken === 8);

    expect(createExtendedMap(20260820)).toEqual(map);
    expect(hotHexes).toHaveLength(6);
    for (const hex of hotHexes) {
      expect(hotHexes.some((other) => other.id !== hex.id && hex.adjacentHexIds.includes(other.id))).toBe(false);
    }
    expect(map.ports.filter((port) => port.kind === "generic")).toHaveLength(5);
    expect(map.ports.filter((port) => port.kind === "resource" && port.resource === "wool")).toHaveLength(2);
  });
});
