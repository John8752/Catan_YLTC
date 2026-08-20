export const RESOURCE_TYPES = ["brick", "lumber", "wool", "grain", "ore"] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type TerrainType = ResourceType | "desert";

export const PLAYER_COLORS = [
  "terracotta",
  "ocean",
  "pine",
  "wheat",
  "plum",
  "charcoal",
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];
export type RuleProfile = "base-3-4" | "two-player" | "extended-5-6";
export type GameId = string;
export type PlayerId = string;

export type ResourceHand = Record<ResourceType, number>;

export interface AxialCoordinate {
  readonly q: number;
  readonly r: number;
}

export interface HexTile extends AxialCoordinate {
  readonly id: string;
  readonly terrain: TerrainType;
  readonly numberToken: number | null;
}

export interface PlayerSeed {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: PlayerColor;
}

export interface PlayerState extends PlayerSeed {
  readonly resources: ResourceHand;
  readonly visibleVictoryPoints: number;
}

export type GamePhase =
  | {
      readonly kind: "setup";
      readonly placementOrder: readonly PlayerId[];
      readonly placementIndex: number;
    }
  | {
      readonly kind: "turn";
      readonly activePlayerId: PlayerId;
      readonly step: "roll" | "resolve-seven" | "trade-build";
      readonly turnNumber: number;
    }
  | {
      readonly kind: "finished";
      readonly winnerId: PlayerId;
    };

export interface GameState {
  readonly id: GameId;
  readonly ruleProfile: RuleProfile;
  readonly seed: number;
  readonly revision: number;
  readonly board: readonly HexTile[];
  readonly players: readonly PlayerState[];
  readonly phase: GamePhase;
}

export function emptyResourceHand(): ResourceHand {
  return {
    brick: 0,
    lumber: 0,
    wool: 0,
    grain: 0,
    ore: 0,
  };
}

export function resourceCardCount(hand: ResourceHand): number {
  return RESOURCE_TYPES.reduce((total, resource) => total + hand[resource], 0);
}
