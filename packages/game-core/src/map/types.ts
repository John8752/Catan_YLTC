import type { EdgeId, HexId, PortId, VertexId } from "../primitives/index.js";
import type { ResourceType } from "../resources/index.js";

export type TerrainType = ResourceType | "desert";

export interface AxialCoordinate {
  readonly q: number;
  readonly r: number;
}

export interface HexTile extends AxialCoordinate {
  readonly id: HexId;
  readonly terrain: TerrainType;
  readonly numberToken: number | null;
}

export interface BoardHex extends HexTile {
  readonly adjacentHexIds: readonly HexId[];
  readonly vertexIds: readonly VertexId[];
  readonly edgeIds: readonly EdgeId[];
}

export interface MapVertex {
  readonly id: VertexId;
  readonly x: number;
  readonly y: number;
  readonly adjacentHexIds: readonly HexId[];
  readonly adjacentVertexIds: readonly VertexId[];
  readonly edgeIds: readonly EdgeId[];
}

export interface MapEdge {
  readonly id: EdgeId;
  readonly vertexIds: readonly [VertexId, VertexId];
  readonly adjacentHexIds: readonly HexId[];
}

export type MapPort =
  | {
      readonly id: PortId;
      readonly kind: "generic";
      readonly resource: null;
      readonly edgeId: EdgeId;
      readonly vertexIds: readonly [VertexId, VertexId];
    }
  | {
      readonly id: PortId;
      readonly kind: "resource";
      readonly resource: ResourceType;
      readonly edgeId: EdgeId;
      readonly vertexIds: readonly [VertexId, VertexId];
    };

export interface GameMap {
  readonly generationVersion: 2;
  readonly hexes: readonly BoardHex[];
  readonly vertices: readonly MapVertex[];
  readonly edges: readonly MapEdge[];
  readonly ports: readonly MapPort[];
  readonly robberHexId: HexId;
}
