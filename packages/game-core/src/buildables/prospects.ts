import type { GameMap } from "../map/index.js";
import type { PlayerId, VertexId } from "../primitives/index.js";
import type { BuildingState, RoadState } from "./types.js";

/** An open settlement site a player can still reach, and what the trip costs. */
export interface SettlementProspect {
  readonly vertexId: VertexId;
  readonly roadsNeeded: number;
}

/**
 * Where a player could still settle, and how many roads away each site is.
 *
 * `findLegalSettlementVertices` answers only for sites a player's roads already
 * touch, which is the question the build UI asks. Reading someone's intent needs
 * the next question -- where are they heading -- so this walks the edge graph
 * outwards from their network and records the road spend each site would cost.
 * An opponent's building severs a network here exactly as it does when building
 * roads, so a site behind one comes back unreachable rather than merely far.
 */
export function findSettlementProspects(
  map: GameMap,
  buildings: readonly BuildingState[],
  roads: readonly RoadState[],
  playerId: PlayerId,
  maxRoads: number,
): readonly SettlementProspect[] {
  const buildingByVertex = new Map(buildings.map((building) => [building.vertexId, building]));
  const occupiedEdges = new Set(roads.map((road) => road.edgeId));
  const edgeById = new Map(map.edges.map((edge) => [edge.id, edge]));
  const vertexById = new Map(map.vertices.map((vertex) => [vertex.id, vertex]));

  const roadsAway = new Map<VertexId, number>();
  const queue: VertexId[] = [];
  const reach = (vertexId: VertexId, steps: number) => {
    if (roadsAway.has(vertexId)) return;
    roadsAway.set(vertexId, steps);
    queue.push(vertexId);
  };

  for (const building of buildings) {
    if (building.ownerId === playerId) reach(building.vertexId, 0);
  }
  for (const road of roads) {
    if (road.ownerId !== playerId) continue;
    for (const vertexId of edgeById.get(road.edgeId)?.vertexIds ?? []) reach(vertexId, 0);
  }

  for (let head = 0; head < queue.length; head += 1) {
    const vertexId = queue[head];
    if (vertexId === undefined) continue;
    const steps = roadsAway.get(vertexId) ?? 0;
    if (steps >= maxRoads) continue;
    const standing = buildingByVertex.get(vertexId);
    if (standing !== undefined && standing.ownerId !== playerId) continue;
    for (const edgeId of vertexById.get(vertexId)?.edgeIds ?? []) {
      if (occupiedEdges.has(edgeId)) continue;
      for (const neighbourId of edgeById.get(edgeId)?.vertexIds ?? []) {
        if (neighbourId !== vertexId) reach(neighbourId, steps + 1);
      }
    }
  }

  return [...roadsAway]
    .filter(([vertexId]) => {
      const vertex = vertexById.get(vertexId);
      if (vertex === undefined || buildingByVertex.has(vertexId)) return false;
      return vertex.adjacentVertexIds.every((adjacentId) => !buildingByVertex.has(adjacentId));
    })
    .map(([vertexId, roadsNeeded]) => ({ vertexId, roadsNeeded }))
    .sort((first, second) =>
      first.roadsNeeded - second.roadsNeeded || first.vertexId.localeCompare(second.vertexId));
}
