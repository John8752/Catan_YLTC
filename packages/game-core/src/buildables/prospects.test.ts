import { describe, expect, it } from "vitest";
import { createStandardMap } from "../map/index.js";
import { findLegalSettlementVertices } from "./placement.js";
import { findSettlementProspects } from "./prospects.js";
import type { BuildingState, RoadState } from "./types.js";

const map = createStandardMap(404);

describe("settlement prospects", () => {
  it("agrees with the build rules on the sites already in reach", () => {
    const { home, roads } = twoRoadChain();
    const buildings: BuildingState[] = [{ ownerId: "p1", vertexId: home.id, kind: "settlement" }];

    const immediate = findSettlementProspects(map, buildings, roads, "p1", 3)
      .filter((prospect) => prospect.roadsNeeded === 0)
      .map((prospect) => prospect.vertexId)
      .sort();

    expect(immediate).toEqual([...findLegalSettlementVertices(map, buildings, roads, "p1")].sort());
    // The chain runs two edges out, so its far end clears the distance rule.
    expect(immediate.length).toBeGreaterThan(0);
  });

  it("reaches further sites and prices each one in roads", () => {
    const home = map.vertices[10];
    if (home === undefined) throw new Error("Missing test vertex");
    const buildings: BuildingState[] = [{ ownerId: "p1", vertexId: home.id, kind: "settlement" }];

    const prospects = findSettlementProspects(map, buildings, [], "p1", 3);
    expect(prospects.every((prospect) => prospect.roadsNeeded >= 1)).toBe(true);
    expect(Math.max(...prospects.map((prospect) => prospect.roadsNeeded))).toBe(3);
    // The distance rule still applies, so nothing next door counts as a site.
    expect(prospects.some((prospect) => home.adjacentVertexIds.includes(prospect.vertexId))).toBe(false);
    expect(prospects.some((prospect) => prospect.vertexId === home.id)).toBe(false);
  });

  it("treats another player's building as a severed network, not a detour", () => {
    const home = map.vertices[10];
    if (home === undefined) throw new Error("Missing test vertex");
    const neighbour = home.adjacentVertexIds[0];
    if (neighbour === undefined) throw new Error("Missing test neighbour");

    const open = findSettlementProspects(map, [{ ownerId: "p1", vertexId: home.id, kind: "settlement" }], [], "p1", 3);
    const blocked = findSettlementProspects(
      map,
      [
        { ownerId: "p1", vertexId: home.id, kind: "settlement" },
        { ownerId: "p2", vertexId: neighbour, kind: "settlement" },
      ],
      [],
      "p1",
      3,
    );

    const openIds = new Set(open.map((prospect) => prospect.vertexId));
    const blockedIds = new Set(blocked.map((prospect) => prospect.vertexId));
    expect(blockedIds.size).toBeLessThan(openIds.size);
    expect([...blockedIds].every((vertexId) => openIds.has(vertexId))).toBe(true);
    expect(blockedIds.has(neighbour)).toBe(false);
  });

  it("cannot route through an edge another player already built on", () => {
    const home = map.vertices[10];
    if (home === undefined) throw new Error("Missing test vertex");
    const takenEdges = home.edgeIds.map((edgeId): RoadState => ({ ownerId: "p2", edgeId }));

    const fenced = findSettlementProspects(
      map,
      [{ ownerId: "p1", vertexId: home.id, kind: "settlement" }],
      takenEdges,
      "p1",
      3,
    );

    expect(fenced).toEqual([]);
  });
});

/** A settlement plus two roads, far enough out that the far end is buildable. */
function twoRoadChain() {
  const home = map.vertices[10];
  if (home === undefined) throw new Error("Missing test vertex");
  const edgeById = new Map(map.edges.map((edge) => [edge.id, edge]));

  for (const firstEdgeId of home.edgeIds) {
    const middleId = edgeById.get(firstEdgeId)?.vertexIds.find((id) => id !== home.id);
    const middle = middleId === undefined ? undefined : map.vertices.find((v) => v.id === middleId);
    if (middle === undefined) continue;
    for (const secondEdgeId of middle.edgeIds) {
      if (secondEdgeId === firstEdgeId) continue;
      const farId = edgeById.get(secondEdgeId)?.vertexIds.find((id) => id !== middle.id);
      if (farId === undefined || farId === home.id || home.adjacentVertexIds.includes(farId)) continue;
      return {
        home,
        roads: [
          { ownerId: "p1", edgeId: firstEdgeId },
          { ownerId: "p1", edgeId: secondEdgeId },
        ] satisfies RoadState[],
      };
    }
  }

  throw new Error("Standard map should offer a two-road chain");
}
