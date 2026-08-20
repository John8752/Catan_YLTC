import { describe, expect, it } from "vitest";
import { createStandardMap } from "../map/index.js";
import type { RoadState } from "../buildables/index.js";
import { longestRoadLength } from "./longest-road.js";

describe("longest road graph", () => {
  it("counts a connected trail and stops through an opponent building", () => {
    const map = createStandardMap(42);
    const chain = findChain(map, 6);
    const roads: RoadState[] = chain.map((edgeId) => ({ ownerId: "player_1", edgeId }));

    expect(longestRoadLength(map, [], roads, "player_1")).toBe(6);

    const third = map.edges.find((edge) => edge.id === chain[2]);
    const fourth = map.edges.find((edge) => edge.id === chain[3]);
    const blockingVertex = third?.vertexIds.find((id) => fourth?.vertexIds.includes(id));
    if (blockingVertex === undefined) throw new Error("Chain has no blocking vertex");
    expect(longestRoadLength(
      map,
      [{ ownerId: "player_2", vertexId: blockingVertex, kind: "settlement" }],
      roads,
      "player_1",
    )).toBeLessThan(6);
  });
});

function findChain(map: ReturnType<typeof createStandardMap>, length: number): readonly string[] {
  const edgeByVertex = new Map<string, string[]>();
  for (const edge of map.edges) {
    for (const vertexId of edge.vertexIds) {
      edgeByVertex.set(vertexId, [...(edgeByVertex.get(vertexId) ?? []), edge.id]);
    }
  }

  function search(vertexId: string, used: readonly string[], visitedVertices: ReadonlySet<string>): readonly string[] | null {
    if (used.length === length) return used;
    for (const edgeId of edgeByVertex.get(vertexId) ?? []) {
      if (used.includes(edgeId)) continue;
      const edge = map.edges.find((candidate) => candidate.id === edgeId);
      const next = edge?.vertexIds.find((candidate) => candidate !== vertexId);
      if (next === undefined || visitedVertices.has(next)) continue;
      const result = search(next, [...used, edgeId], new Set([...visitedVertices, next]));
      if (result !== null) return result;
    }
    return null;
  }

  for (const vertex of map.vertices) {
    const result = search(vertex.id, [], new Set([vertex.id]));
    if (result !== null) return result;
  }
  throw new Error("Unable to find road chain");
}
