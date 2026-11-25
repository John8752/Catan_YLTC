import type { PlayerColor } from "../primitives/index.js";

export type FeatureKind = "city" | "road" | "field" | "monastery";
export interface FeatureDefinition {
  readonly id: string;
  readonly kind: FeatureKind;
  /** City/road: N,E,S,W = 0..3. Field: clockwise half-edges = 0..7. */
  readonly ports: readonly number[];
  readonly cities: readonly string[];
  readonly shields: number;
}
export interface TileDefinition { readonly id: string; readonly count: number; readonly features: readonly FeatureDefinition[] }
export interface Placement { readonly x: number; readonly y: number; readonly rotation: number }
export interface PlacedTile extends Placement { readonly id: string; readonly type: string }
export interface Meeple { readonly playerId: string; readonly tileId: string; readonly featureId: string }
export interface CarcassonnePlayer { readonly id: string; readonly name: string; readonly color: PlayerColor; readonly score: number }
export type CarcassonnePhase = { readonly kind: "turn"; readonly playerId: string; readonly turn: number } | { readonly kind: "finished"; readonly winnerIds: readonly string[] };
export interface ScoreEntry {
  readonly id: number; readonly kind: FeatureKind; readonly points: number; readonly playerIds: readonly string[];
  readonly tileIds: readonly string[]; readonly final: boolean;
}
export interface CarcassonneState {
  readonly id: string; readonly revision: number; readonly phase: CarcassonnePhase;
  readonly players: readonly CarcassonnePlayer[]; readonly board: readonly PlacedTile[]; readonly meeples: readonly Meeple[];
  readonly deck: readonly string[]; readonly currentTile: string | null; readonly discarded: readonly string[];
  readonly scores: readonly ScoreEntry[];
}
export interface PlaceCommand extends Placement {
  readonly type: "place"; readonly matchId: string; readonly turn: number; readonly meeple: string | null;
}
export interface Region {
  readonly id: string; readonly kind: FeatureKind; readonly refs: readonly string[]; readonly tileIds: readonly string[];
  readonly openEnds: number; readonly complete: boolean; readonly shields: number;
  readonly followers: Readonly<Record<string, number>>; readonly winnerIds: readonly string[];
  readonly completedCityIds: readonly string[]; readonly points: number;
}
export class CarcassonneError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "CarcassonneError"; }
}
