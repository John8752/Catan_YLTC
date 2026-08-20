import { RESOURCE_TYPES, type ResourceType } from "../resources/index.js";
import type { GameMap } from "./types.js";

export type ResourceStrength = "strong" | "balanced" | "weak";
export type MapFairnessGrade = "excellent" | "balanced" | "variable";

export interface MapResourceAnalysis {
  readonly resource: ResourceType;
  readonly tileCount: number;
  readonly productionPips: number;
  readonly pipsPerTile: number;
  readonly relativeProduction: number;
  readonly strength: ResourceStrength;
}

export interface MapFairnessAnalysis {
  readonly score: number;
  readonly grade: MapFairnessGrade;
  readonly resourceBalanceScore: number;
  readonly startingPositionScore: number;
  readonly terrainSpreadScore: number;
  readonly strongVertexCount: number;
  readonly bestVertexPips: number;
  readonly resources: readonly MapResourceAnalysis[];
  readonly mostAbundantResource: ResourceType;
  readonly scarcestResource: ResourceType;
}

export function analyzeMap(map: GameMap): MapFairnessAnalysis {
  const producingHexes = map.hexes.filter((hex) => hex.numberToken !== null && hex.terrain !== "desert");
  const averagePipsPerTile = producingHexes.reduce(
    (total, hex) => total + diceProbabilityPips(hex.numberToken ?? 7),
    0,
  ) / producingHexes.length;

  const resources = RESOURCE_TYPES.map((resource): MapResourceAnalysis => {
    const tiles = producingHexes.filter((hex) => hex.terrain === resource);
    const productionPips = tiles.reduce(
      (total, hex) => total + diceProbabilityPips(hex.numberToken ?? 7),
      0,
    );
    const pipsPerTile = productionPips / tiles.length;
    const relativeProduction = pipsPerTile / averagePipsPerTile;
    return {
      resource,
      tileCount: tiles.length,
      productionPips,
      pipsPerTile: rounded(pipsPerTile),
      relativeProduction: rounded(relativeProduction),
      strength: relativeProduction >= 1.12 ? "strong" : relativeProduction <= 0.88 ? "weak" : "balanced",
    };
  });

  const normalizedDeviations = resources.map((resource) => resource.relativeProduction - 1);
  const coefficientOfVariation = Math.sqrt(
    normalizedDeviations.reduce((total, deviation) => total + deviation ** 2, 0) / resources.length,
  );
  const resourceBalanceScore = score(100 - coefficientOfVariation * 170);

  const vertexPips = map.vertices
    .map((vertex) => vertex.adjacentHexIds.reduce((total, hexId) => {
      const token = map.hexes.find((hex) => hex.id === hexId)?.numberToken;
      return total + (token === null || token === undefined ? 0 : diceProbabilityPips(token));
    }, 0))
    .sort((first, second) => second - first);
  const requiredStrongVertices = map.hexes.length > 19 ? 12 : 8;
  const strongVertexCount = vertexPips.filter((value) => value >= 8).length;
  const cutoffPips = vertexPips[requiredStrongVertices - 1] ?? 0;
  const availabilityScore = Math.min(100, (strongVertexCount / requiredStrongVertices) * 100);
  const cutoffScore = Math.min(100, Math.max(0, (cutoffPips - 6) * 25));
  const startingPositionScore = score(availabilityScore * 0.55 + cutoffScore * 0.45);

  const hexById = new Map(map.hexes.map((hex) => [hex.id, hex]));
  let adjacentPairs = 0;
  let sameTerrainPairs = 0;
  for (const hex of map.hexes) {
    for (const adjacentId of hex.adjacentHexIds) {
      if (hex.id >= adjacentId) continue;
      const adjacent = hexById.get(adjacentId);
      if (adjacent === undefined || hex.terrain === "desert" || adjacent.terrain === "desert") continue;
      adjacentPairs += 1;
      if (hex.terrain === adjacent.terrain) sameTerrainPairs += 1;
    }
  }
  const terrainSpreadScore = score(100 - (sameTerrainPairs / Math.max(1, adjacentPairs)) * 100);
  const overallScore = score(
    resourceBalanceScore * 0.55 + startingPositionScore * 0.30 + terrainSpreadScore * 0.15,
  );
  const byTotalProduction = [...resources].sort((first, second) =>
    first.productionPips - second.productionPips || RESOURCE_TYPES.indexOf(first.resource) - RESOURCE_TYPES.indexOf(second.resource));

  return {
    score: overallScore,
    grade: overallScore >= 90 ? "excellent" : overallScore >= 82 ? "balanced" : "variable",
    resourceBalanceScore,
    startingPositionScore,
    terrainSpreadScore,
    strongVertexCount,
    bestVertexPips: vertexPips[0] ?? 0,
    resources,
    mostAbundantResource: byTotalProduction.at(-1)?.resource ?? "grain",
    scarcestResource: byTotalProduction[0]?.resource ?? "ore",
  };
}

export function diceProbabilityPips(numberToken: number): number {
  return numberToken === 7 ? 0 : 6 - Math.abs(7 - numberToken);
}

function score(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}
