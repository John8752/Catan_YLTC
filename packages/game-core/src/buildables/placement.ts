import type { GameMap } from "../map/index.js";
import type { EdgeId, PlayerId, VertexId } from "../primitives/index.js";
import type { BuildingState, RoadState } from "./types.js";

export function findLegalRoadEdges(
  map: GameMap,
  buildings: readonly BuildingState[],
  roads: readonly RoadState[],
  playerId: PlayerId,
): readonly EdgeId[] {
  const occupiedEdges = new Set(roads.map((road) => road.edgeId));
  const edgeById = new Map(map.edges.map((edge) => [edge.id, edge]));
  const buildingByVertex = new Map(buildings.map((building) => [building.vertexId, building]));

  return map.edges
    .filter((edge) => {
      if (occupiedEdges.has(edge.id)) return false;
      return edge.vertexIds.some((vertexId) => {
        const building = buildingByVertex.get(vertexId);
        if (building?.ownerId === playerId) return true;
        if (building !== undefined) return false;
        return roads.some((road) => {
          if (road.ownerId !== playerId) return false;
          return edgeById.get(road.edgeId)?.vertexIds.includes(vertexId) ?? false;
        });
      });
    })
    .map((edge) => edge.id);
}

export function findLegalSettlementVertices(
  map: GameMap,
  buildings: readonly BuildingState[],
  roads: readonly RoadState[],
  playerId: PlayerId,
): readonly VertexId[] {
  const occupied = new Set(buildings.map((building) => building.vertexId));
  const ownedRoads = new Set(roads.filter((road) => road.ownerId === playerId).map((road) => road.edgeId));
  return map.vertices
    .filter(
      (vertex) =>
        !occupied.has(vertex.id) &&
        vertex.adjacentVertexIds.every((adjacentId) => !occupied.has(adjacentId)) &&
        vertex.edgeIds.some((edgeId) => ownedRoads.has(edgeId)),
    )
    .map((vertex) => vertex.id);
}

export function findLegalCityVertices(
  buildings: readonly BuildingState[],
  playerId: PlayerId,
): readonly VertexId[] {
  return buildings
    .filter((building) => building.ownerId === playerId && building.kind === "settlement")
    .map((building) => building.vertexId);
}
