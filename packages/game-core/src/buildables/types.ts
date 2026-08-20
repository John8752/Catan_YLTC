import type { EdgeId, PlayerId, VertexId } from "../primitives/index.js";

export type BuildingKind = "settlement" | "city";

export interface BuildingState {
  readonly ownerId: PlayerId;
  readonly vertexId: VertexId;
  readonly kind: BuildingKind;
}

export interface RoadState {
  readonly ownerId: PlayerId;
  readonly edgeId: EdgeId;
}

export interface PieceSupply {
  readonly roads: number;
  readonly settlements: number;
  readonly cities: number;
}

export function initialPieceSupply(): PieceSupply {
  return { roads: 15, settlements: 5, cities: 4 };
}
