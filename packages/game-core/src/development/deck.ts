import { createSeededRandom, shuffled } from "../primitives/index.js";
import type { DevelopmentCardType } from "./types.js";

const DEVELOPMENT_DECK: readonly DevelopmentCardType[] = [
  ...Array<DevelopmentCardType>(14).fill("knight"),
  ...Array<DevelopmentCardType>(5).fill("victory-point"),
  "road-building",
  "road-building",
  "monopoly",
  "monopoly",
  "resource-choice",
  "resource-choice",
];

export function createDevelopmentDeck(seed: number): readonly DevelopmentCardType[] {
  return shuffled(DEVELOPMENT_DECK, createSeededRandom(seed ^ 0x44455643));
}
