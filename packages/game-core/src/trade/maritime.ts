import type { BuildingState } from "../buildables/index.js";
import type { GameMap } from "../map/index.js";
import type { PlayerId } from "../primitives/index.js";
import type { ResourceType } from "../resources/index.js";

export function calculateMaritimeRatio(
  map: GameMap,
  buildings: readonly BuildingState[],
  playerId: PlayerId,
  resource: ResourceType,
): 2 | 3 | 4 {
  const occupiedVertices = new Set(
    buildings.filter((building) => building.ownerId === playerId).map((building) => building.vertexId),
  );
  const ownedPorts = map.ports.filter((port) => port.vertexIds.some((vertexId) => occupiedVertices.has(vertexId)));
  if (ownedPorts.some((port) => port.kind === "resource" && port.resource === resource)) return 2;
  if (ownedPorts.some((port) => port.kind === "generic")) return 3;
  return 4;
}
