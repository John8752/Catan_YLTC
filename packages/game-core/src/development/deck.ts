import { createSeededRandom, shuffled } from "../primitives/index.js";
import type { DevelopmentCardType } from "./types.js";

export const BASE_DEVELOPMENT_CARDS: readonly DevelopmentCardType[] = [
  ...Array<DevelopmentCardType>(14).fill("knight"),
  ...Array<DevelopmentCardType>(5).fill("victory-point"),
  "road-building",
  "road-building",
  "monopoly",
  "monopoly",
  "resource-choice",
  "resource-choice",
];

export const FIVE_SIX_PLAYER_ADDITIONAL_DEVELOPMENT_CARDS: readonly DevelopmentCardType[] = [
  ...Array<DevelopmentCardType>(6).fill("knight"),
  "road-building",
  "monopoly",
  "resource-choice",
];

export function createDevelopmentDeck(
  seed: number,
  cards: readonly DevelopmentCardType[] = BASE_DEVELOPMENT_CARDS,
): readonly DevelopmentCardType[] {
  return shuffled(cards, createSeededRandom(seed ^ 0x44455643));
}
