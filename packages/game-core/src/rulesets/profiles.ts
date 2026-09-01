import {
  BASE_DEVELOPMENT_CARDS,
  createDevelopmentDeck,
  FIVE_SIX_PLAYER_ADDITIONAL_DEVELOPMENT_CARDS,
  type DevelopmentCardType,
} from "../development/index.js";
import { createExtendedMap, createStandardMap, type GameMap, type TerrainType } from "../map/index.js";
import { createResourceBank, type ResourceHand } from "../resources/index.js";
import type { RuleProfile } from "./types.js";

export type PlayableRuleProfile = Exclude<RuleProfile, "two-player">;

export interface RuleProfileDefinition {
  readonly id: PlayableRuleProfile;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly resourceCardsPerType: number;
  readonly developmentDeckSize: number;
  readonly pairedPlayerTurns: boolean;
  readonly terrainCounts: Readonly<Record<TerrainType, number>>;
  readonly createMap: (seed: number) => GameMap;
  readonly createBank: () => ResourceHand;
  readonly createDevelopmentDeck: (seed: number) => readonly DevelopmentCardType[];
}

const BASE_RESOURCE_CARDS_PER_TYPE = 19;
const EXTENDED_RESOURCE_CARDS_PER_TYPE = 24;
const EXTENDED_DEVELOPMENT_CARDS = [
  ...BASE_DEVELOPMENT_CARDS,
  ...FIVE_SIX_PLAYER_ADDITIONAL_DEVELOPMENT_CARDS,
] as const;

const PROFILE_DEFINITIONS: Readonly<Record<PlayableRuleProfile, RuleProfileDefinition>> = {
  "base-3-4": {
    id: "base-3-4",
    // Two seats play the same standard game: the board, supplies and turn order
    // are unchanged, there is simply one opponent. The `two-player` profile in
    // RuleProfile stays reserved for a variant with its own neutral-player rules
    // (open question O1), which this is not.
    minPlayers: 2,
    maxPlayers: 4,
    resourceCardsPerType: BASE_RESOURCE_CARDS_PER_TYPE,
    developmentDeckSize: BASE_DEVELOPMENT_CARDS.length,
    pairedPlayerTurns: false,
    terrainCounts: { brick: 3, lumber: 4, wool: 4, grain: 4, ore: 3, desert: 1 },
    createMap: createStandardMap,
    createBank: () => createResourceBank(BASE_RESOURCE_CARDS_PER_TYPE),
    createDevelopmentDeck: (seed) => createDevelopmentDeck(seed),
  },
  "extended-5-6": {
    id: "extended-5-6",
    minPlayers: 5,
    maxPlayers: 6,
    resourceCardsPerType: EXTENDED_RESOURCE_CARDS_PER_TYPE,
    developmentDeckSize: EXTENDED_DEVELOPMENT_CARDS.length,
    pairedPlayerTurns: true,
    terrainCounts: { brick: 5, lumber: 6, wool: 6, grain: 6, ore: 5, desert: 2 },
    createMap: createExtendedMap,
    createBank: () => createResourceBank(EXTENDED_RESOURCE_CARDS_PER_TYPE),
    createDevelopmentDeck: (seed) => createDevelopmentDeck(seed, EXTENDED_DEVELOPMENT_CARDS),
  },
};

export function getRuleProfileDefinition(profile: PlayableRuleProfile): RuleProfileDefinition {
  return PROFILE_DEFINITIONS[profile];
}

export function isPlayableRuleProfile(profile: RuleProfile): profile is PlayableRuleProfile {
  return profile !== "two-player";
}
