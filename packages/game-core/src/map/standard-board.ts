import { createSeededRandom, shuffled } from "../primitives/index.js";
import type { AxialCoordinate, HexTile, TerrainType } from "./types.js";

const TERRAIN_DECK: readonly TerrainType[] = [
  "lumber",
  "lumber",
  "lumber",
  "lumber",
  "wool",
  "wool",
  "wool",
  "wool",
  "grain",
  "grain",
  "grain",
  "grain",
  "brick",
  "brick",
  "brick",
  "ore",
  "ore",
  "ore",
  "desert",
];

const NUMBER_TOKENS: readonly number[] = [
  5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11,
];

export const STANDARD_COORDINATES: readonly AxialCoordinate[] = [
  { q: 0, r: -2 },
  { q: 1, r: -2 },
  { q: 2, r: -2 },
  { q: -1, r: -1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: 2, r: -1 },
  { q: -2, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
  { q: -2, r: 1 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: 1, r: 1 },
  { q: -2, r: 2 },
  { q: -1, r: 2 },
  { q: 0, r: 2 },
];

export function createStandardBoard(seed: number): readonly HexTile[] {
  const terrainDeck = shuffled(TERRAIN_DECK, createSeededRandom(seed));
  let numberIndex = 0;

  return STANDARD_COORDINATES.map((coordinate, index) => {
    const terrain = terrainDeck[index];

    if (terrain === undefined) {
      throw new Error("Terrain deck is missing a tile");
    }

    const numberToken = terrain === "desert" ? null : (NUMBER_TOKENS[numberIndex] ?? null);

    if (terrain !== "desert") {
      numberIndex += 1;
    }

    return {
      id: `hex_${coordinate.q}_${coordinate.r}`,
      q: coordinate.q,
      r: coordinate.r,
      terrain,
      numberToken,
    };
  });
}
