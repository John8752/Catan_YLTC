import type { BuildingState, RoadState } from "../buildables/index.js";
import type { GameMap } from "../map/index.js";
import type { EdgeId, PlayerId, VertexId } from "../primitives/index.js";

export function longestRoadLength(
  map: GameMap,
  buildings: readonly BuildingState[],
  roads: readonly RoadState[],
  playerId: PlayerId,
): number {
  const ownedEdgeIds = new Set(roads.filter((road) => road.ownerId === playerId).map((road) => road.edgeId));
  if (ownedEdgeIds.size === 0) return 0;
  const edgeById = new Map(map.edges.map((edge) => [edge.id, edge]));
  const edgeIdsByVertex = new Map<VertexId, EdgeId[]>();
  const blockedVertices = new Set(
    buildings.filter((building) => building.ownerId !== playerId).map((building) => building.vertexId),
  );

  for (const edgeId of ownedEdgeIds) {
    const edge = edgeById.get(edgeId);
    if (edge === undefined) continue;
    for (const vertexId of edge.vertexIds) {
      edgeIdsByVertex.set(vertexId, [...(edgeIdsByVertex.get(vertexId) ?? []), edgeId]);
    }
  }

  function walk(vertexId: VertexId, used: ReadonlySet<EdgeId>, arrived: boolean): number {
    if (arrived && blockedVertices.has(vertexId)) return used.size;
    let best = used.size;
    for (const edgeId of edgeIdsByVertex.get(vertexId) ?? []) {
      if (used.has(edgeId)) continue;
      const edge = edgeById.get(edgeId);
      const nextVertex = edge?.vertexIds.find((candidate) => candidate !== vertexId);
      if (nextVertex === undefined) continue;
      best = Math.max(best, walk(nextVertex, new Set([...used, edgeId]), true));
    }
    return best;
  }

  return Math.max(...[...edgeIdsByVertex.keys()].map((vertexId) => walk(vertexId, new Set(), false)));
}
