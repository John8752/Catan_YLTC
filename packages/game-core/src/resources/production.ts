import type { BuildingState } from "../buildables/index.js";
import type { GameMap } from "../map/index.js";
import type { PlayerId } from "../primitives/index.js";
import { RESOURCE_TYPES, emptyResourceHand, type ResourceHand, type ResourceType } from "./types.js";

export interface ProductionClaim {
  readonly playerId: PlayerId;
  readonly resource: ResourceType;
  readonly amount: number;
}

export interface ProductionResolution {
  readonly bank: ResourceHand;
  readonly grants: ReadonlyMap<PlayerId, ResourceHand>;
}

export function calculateProductionClaims(
  map: GameMap,
  buildings: readonly BuildingState[],
  roll: number,
): readonly ProductionClaim[] {
  const vertexById = new Map(map.vertices.map((vertex) => [vertex.id, vertex]));
  const hexById = new Map(map.hexes.map((hex) => [hex.id, hex]));
  const claims: ProductionClaim[] = [];

  for (const building of buildings) {
    const vertex = vertexById.get(building.vertexId);
    if (vertex === undefined) continue;

    for (const hexId of vertex.adjacentHexIds) {
      const hex = hexById.get(hexId);
      if (
        hex === undefined ||
        hex.id === map.robberHexId ||
        hex.numberToken !== roll ||
        hex.terrain === "desert"
      ) {
        continue;
      }
      claims.push({
        playerId: building.ownerId,
        resource: hex.terrain,
        amount: building.kind === "city" ? 2 : 1,
      });
    }
  }

  return claims;
}

export function resolveProductionClaims(
  bank: ResourceHand,
  claims: readonly ProductionClaim[],
): ProductionResolution {
  const grants = new Map<PlayerId, ResourceHand>();
  const totals = emptyResourceHand();

  for (const claim of claims) {
    grants.set(claim.playerId, grants.get(claim.playerId) ?? emptyResourceHand());
    totals[claim.resource] += claim.amount;
  }

  const nextBank = { ...bank };
  for (const resource of RESOURCE_TYPES) {
    if (totals[resource] > bank[resource]) continue;
    nextBank[resource] -= totals[resource];
    for (const claim of claims) {
      if (claim.resource !== resource) continue;
      const playerGrant = grants.get(claim.playerId);
      if (playerGrant !== undefined) playerGrant[resource] += claim.amount;
    }
  }

  return { bank: nextBank, grants };
}
