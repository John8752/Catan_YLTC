import type { ResourceType } from "../resources/index.js";

export type TerrainType = ResourceType | "desert";

export interface AxialCoordinate {
  readonly q: number;
  readonly r: number;
}

export interface HexTile extends AxialCoordinate {
  readonly id: string;
  readonly terrain: TerrainType;
  readonly numberToken: number | null;
}
